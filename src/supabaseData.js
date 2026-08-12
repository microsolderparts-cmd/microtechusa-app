import { supabase } from "./supabase";

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function datesClose(valueA, valueB, toleranceMs = 3000) {
  const a = valueA ? new Date(valueA).getTime() : NaN;
  const b = valueB ? new Date(valueB).getTime() : NaN;

  if (Number.isNaN(a) || Number.isNaN(b)) {
    return !valueA && !valueB;
  }

  return Math.abs(a - b) <= toleranceMs;
}

async function requireSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  if (!session) {
    throw new Error("No Supabase login session found.");
  }

  return session;
}

async function getCurrentProfile() {
  const session = await requireSession();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", session.user.id)
    .single();

  if (error) throw error;

  if (!profile?.active) {
    throw new Error("This MicrotechUSA user is inactive.");
  }

  return {
    session,
    role: profile.role,
  };
}

async function findOrCreateCustomer(repair) {
  const name = repair.customer?.trim() || "Unknown Customer";
  const phone = repair.phone?.trim() || null;

  let query = supabase.from("customers").select("id").limit(1);

  query = phone
    ? query.eq("phone", phone)
    : query.eq("name", name);

  const { data: existing, error: findError } = await query;

  if (findError) throw findError;

  if (existing?.length) {
    return existing[0].id;
  }

  const { data: created, error: createError } = await supabase
    .from("customers")
    .insert({
      name,
      phone,
    })
    .select("id")
    .single();

  if (createError) throw createError;

  return created.id;
}

export async function loadRepairsFromSupabase() {
  await requireSession();

  const { data, error } = await supabase
    .from("repairs")
    .select(`
      *,
      payments (*),
      repair_parts (*),
      repair_timeline (*)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const payments = (row.payments || [])
      .slice()
      .sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at))
      .map((payment) => ({
        id: payment.id,
        amount: numberValue(payment.amount),
        method: payment.method || "Other",
        note: payment.note || "",
        date: toLocalDate(payment.paid_at),
      }));

    const orderedParts = (row.repair_parts || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((part) => ({
        id: part.id,
        name: part.name || "Part",
        supplier: part.supplier || "",
        cost: numberValue(part.cost),
        tracking: part.tracking_number || "",
        status: part.status || "Needed",
        date: toLocalDate(part.created_at),
      }));

    const timeline = (row.repair_timeline || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((entry) => ({
        id: entry.id,
        text: entry.event_text || "Repair update",
        date: toLocalDate(entry.created_at),
      }));

    return {
      id: row.ticket_number,
      customer: row.customer_name || "",
      phone: row.phone || "",
      deviceType: row.device_type || "Other",
      brand: row.brand || "",
      model: row.model || "",
      serial: row.serial_imei || "",
      issue: row.issue || "",
      diagnosis: row.diagnosis || "",
      accessories: row.accessories || "",
      condition: row.device_condition || "Good",
      technician: row.technician || "Unassigned",
      estimatedCompletion: row.estimated_completion || "",
      partsCost: numberValue(row.parts_cost),
      labor: numberValue(row.labor),
      total: numberValue(row.total),
      paid: numberValue(row.paid),
      balance: numberValue(row.balance),
      passcode: row.passcode || "",
      status: row.status || "Received",
      priority: row.priority || "Normal",
      warranty: row.warranty || "No Warranty",
      approval: row.approval || "Pending",
      partsNeeded: row.parts_needed || "",
      internalNotes: row.internal_notes || "",
      customerNotes: row.customer_notes || "",
      checkIn: row.check_in || {},
      payments,
      orderedParts,
      timeline,
      intakeDate: toLocalDate(row.intake_date),
      deliveryDate: toLocalDate(row.delivery_date),
      invoiceNumber: row.invoice_number || "",
      reopened: Boolean(row.reopened),
    };
  });
}

async function syncPayments(repairId, payments) {
  const { data: existingPayments, error: readError } = await supabase
    .from("payments")
    .select("id, amount, method, note, paid_at")
    .eq("repair_id", repairId);

  if (readError) throw readError;

  const existing = existingPayments || [];

  for (const payment of payments) {
    const exactIdMatch = existing.find(
      (row) => String(row.id) === String(payment.id)
    );

    if (exactIdMatch) {
      const record = {
        amount: numberValue(payment.amount),
        method: payment.method || "Other",
        note: payment.note || null,
        paid_at: toIsoDate(payment.date) || exactIdMatch.paid_at,
      };

      const { error } = await supabase
        .from("payments")
        .update(record)
        .eq("id", exactIdMatch.id);

      if (error) throw error;
      continue;
    }

    const matchingPayment = existing.find((row) => {
      return (
        numberValue(row.amount) === numberValue(payment.amount) &&
        normalizeText(row.method) ===
          normalizeText(payment.method || "Other") &&
        normalizeText(row.note) === normalizeText(payment.note) &&
        datesClose(row.paid_at, payment.date)
      );
    });

    if (matchingPayment) continue;

    const { error } = await supabase.from("payments").insert({
      repair_id: repairId,
      amount: numberValue(payment.amount),
      method: payment.method || "Other",
      note: payment.note || null,
      paid_at: toIsoDate(payment.date) || new Date().toISOString(),
    });

    if (error) throw error;
  }
}

async function syncRepairParts(repairId, orderedParts) {
  const { data: existingParts, error: readError } = await supabase
    .from("repair_parts")
    .select(
      "id, name, supplier, cost, tracking_number, status, created_at"
    )
    .eq("repair_id", repairId);

  if (readError) throw readError;

  const existing = existingParts || [];

  for (const part of orderedParts) {
    let matched = existing.find(
      (row) => String(row.id) === String(part.id)
    );

    if (!matched) {
      matched = existing.find((row) => {
        return (
          normalizeText(row.name) === normalizeText(part.name) &&
          normalizeText(row.supplier) === normalizeText(part.supplier) &&
          normalizeText(row.tracking_number) ===
            normalizeText(part.tracking) &&
          datesClose(row.created_at, part.date)
        );
      });
    }

    const record = {
      name: part.name || "Part",
      supplier: part.supplier || null,
      cost: numberValue(part.cost),
      tracking_number: part.tracking || null,
      status: part.status || "Needed",
    };

    if (matched) {
      const { error } = await supabase
        .from("repair_parts")
        .update(record)
        .eq("id", matched.id);

      if (error) throw error;
      continue;
    }

    const { error } = await supabase.from("repair_parts").insert({
      repair_id: repairId,
      ...record,
      created_at: toIsoDate(part.date) || new Date().toISOString(),
    });

    if (error) throw error;
  }
}

async function syncTimeline(repairId, timeline) {
  const { data: existingTimeline, error: readError } = await supabase
    .from("repair_timeline")
    .select("id, event_text, created_at")
    .eq("repair_id", repairId);

  if (readError) throw readError;

  const existing = existingTimeline || [];

  for (const entry of timeline) {
    const exactIdMatch = existing.find(
      (row) => String(row.id) === String(entry.id)
    );

    if (exactIdMatch) continue;

    const matchingEntry = existing.find((row) => {
      return (
        normalizeText(row.event_text) === normalizeText(entry.text) &&
        datesClose(row.created_at, entry.date)
      );
    });

    if (matchingEntry) continue;

    const { error } = await supabase.from("repair_timeline").insert({
      repair_id: repairId,
      event_text: entry.text || "Repair update",
      created_at: toIsoDate(entry.date) || new Date().toISOString(),
    });

    if (error) throw error;
  }
}

export async function saveRepairToSupabase(repair) {
  const { role } = await getCurrentProfile();

  const customerId = await findOrCreateCustomer(repair);

  const payments = Array.isArray(repair.payments)
    ? repair.payments
    : [];

  const orderedParts = Array.isArray(repair.orderedParts)
    ? repair.orderedParts
    : [];

  const timeline = Array.isArray(repair.timeline)
    ? repair.timeline
    : [];

  const partsCost = numberValue(repair.partsCost);
  const labor = numberValue(repair.labor);
  const total = partsCost + labor;

  const paid = payments.reduce(
    (sum, payment) => sum + numberValue(payment.amount),
    0
  );

  const balance = Math.max(total - paid, 0);

  const record = {
    ticket_number: repair.id,
    customer_id: customerId,
    customer_name: repair.customer || "Unknown Customer",
    phone: repair.phone || null,
    device_type: repair.deviceType || null,
    brand: repair.brand || null,
    model: repair.model || null,
    serial_imei: repair.serial || null,
    issue: repair.issue || null,
    diagnosis: repair.diagnosis || null,
    accessories: repair.accessories || null,
    device_condition: repair.condition || null,
    technician: repair.technician || null,
    estimated_completion: repair.estimatedCompletion || null,
    parts_cost: partsCost,
    labor,
    total,
    paid,
    balance,
    passcode: repair.passcode || null,
    status: repair.status || "Received",
    priority: repair.priority || "Normal",
    warranty: repair.warranty || "No Warranty",
    approval: repair.approval || "Pending",
    parts_needed: repair.partsNeeded || null,
    internal_notes: repair.internalNotes || null,
    customer_notes: repair.customerNotes || null,
    check_in: repair.checkIn || {},
    intake_date:
      toIsoDate(repair.intakeDate) || new Date().toISOString(),
    delivery_date: toIsoDate(repair.deliveryDate),
    invoice_number: repair.invoiceNumber || null,
    reopened: Boolean(repair.reopened),
    updated_at: new Date().toISOString(),
  };

  const { data: existingRepairs, error: lookupError } = await supabase
    .from("repairs")
    .select("id")
    .eq("ticket_number", repair.id)
    .limit(1);

  if (lookupError) throw lookupError;

  let savedRepair;

  if (existingRepairs?.[0]?.id) {
    const { data, error: updateError } = await supabase
      .from("repairs")
      .update(record)
      .eq("id", existingRepairs[0].id)
      .select("id")
      .single();

    if (updateError) throw updateError;

    savedRepair = data;
  } else {
    const { data, error: insertError } = await supabase
      .from("repairs")
      .insert(record)
      .select("id")
      .single();

    if (insertError) throw insertError;

    savedRepair = data;
  }

  const repairId = savedRepair.id;

  const canManagePayments =
    role === "owner" ||
    role === "front_desk";

  const canManageParts =
    role === "owner" ||
    role === "technician";

  if (canManagePayments) {
    await syncPayments(repairId, payments);
  }

  if (canManageParts) {
    await syncRepairParts(repairId, orderedParts);
  }

  await syncTimeline(repairId, timeline);
}

export async function syncRepairsToSupabase(repairs) {
  await requireSession();

  for (const repair of repairs) {
    await saveRepairToSupabase(repair);
  }
}

export async function loadBusinessSettingsFromSupabase() {
  await requireSession();

  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = data?.[0];

  if (!row) return null;

  return {
    businessName: row.business_name || "MicrotechUSA",
    subtitle: row.subtitle || "Repair Center",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    defaultWarranty: row.default_warranty || "90 Days",
  };
}

export async function saveBusinessSettingsToSupabase(settings) {
  const { role } = await getCurrentProfile();

  // Only Owner is allowed to save business settings.
  if (role !== "owner") {
    return;
  }

  const { data: existing, error: readError } = await supabase
    .from("business_settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (readError) throw readError;

  const record = {
    business_name: settings.businessName || "MicrotechUSA",
    subtitle: settings.subtitle || "Repair Center",
    phone: settings.phone || null,
    email: settings.email || null,
    address: settings.address || null,
    default_warranty:
      settings.defaultWarranty || "90 Days",
    updated_at: new Date().toISOString(),
  };

  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from("business_settings")
      .update(record)
      .eq("id", existing[0].id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("business_settings")
    .insert(record);

  if (error) throw error;
}

export async function getSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}