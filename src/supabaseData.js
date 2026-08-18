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
      customerId: row.customer_id || "",
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

export async function loadCustomersFromSupabase() {
  await requireSession();

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, email")
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function updateCustomerProfileInSupabase(customer) {
  const { role } = await getCurrentProfile();

  if (
    role !== "owner" &&
    role !== "front_desk"
  ) {
    throw new Error(
      "You do not have permission to edit customers."
    );
  }

  if (!customer?.id) {
    throw new Error(
      "Customer ID is required."
    );
  }

  const name =
    customer.name?.trim() ||
    "Unknown Customer";

  const phone =
    customer.phone?.trim() || null;

  const email =
    customer.email?.trim() || null;

  const { error: customerError } =
    await supabase
      .from("customers")
      .update({
        name,
        phone,
        email,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", customer.id);

  if (customerError) {
    throw customerError;
  }

  const { error: repairError } =
    await supabase
      .from("repairs")
      .update({
        customer_name: name,
        phone,
      })
      .eq(
        "customer_id",
        customer.id
      );

  if (repairError) {
    throw repairError;
  }

  return {
    id: customer.id,
    name,
    phone: phone || "",
    email: email || "",
  };
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
    taxRate: Number(row.tax_rate) || 0,
  };
}

export async function saveBusinessSettingsToSupabase(settings) {
  const { role } = await getCurrentProfile();

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
    tax_rate:
      Math.max(0, Number(settings.taxRate) || 0),
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

export async function deleteRepairFromSupabase(ticketNumber) {
  const { role } = await getCurrentProfile();

  if (role !== "owner") {
    throw new Error("Only the Owner can delete repairs.");
  }

  const { data: repairs, error: findError } = await supabase
    .from("repairs")
    .select("id")
    .eq("ticket_number", ticketNumber)
    .limit(1);

  if (findError) throw findError;

  const repairId = repairs?.[0]?.id;

  if (!repairId) {
    throw new Error("Repair not found in Supabase.");
  }

  const { error: paymentsError } = await supabase
    .from("payments")
    .delete()
    .eq("repair_id", repairId);

  if (paymentsError) throw paymentsError;

  const { error: partsError } = await supabase
    .from("repair_parts")
    .delete()
    .eq("repair_id", repairId);

  if (partsError) throw partsError;

  const { error: timelineError } = await supabase
    .from("repair_timeline")
    .delete()
    .eq("repair_id", repairId);

  if (timelineError) throw timelineError;

  const { error: repairError } = await supabase
    .from("repairs")
    .delete()
    .eq("id", repairId);

  if (repairError) throw repairError;

  return true;
}
export async function getNextInvoiceNumberFromSupabase() {
  await requireSession();

  const { data, error } = await supabase.rpc(
    "get_next_invoice_number"
  );

  if (error) throw error;

  const number = Number(data);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(
      "Supabase returned an invalid invoice number."
    );
  }

  return number;
}

export async function getNextRepairNumberFromSupabase() {
  await requireSession();

  const { data, error } = await supabase.rpc(
    "get_next_repair_number"
  );

  if (error) throw error;

  const number = Number(data);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(
      "Supabase returned an invalid repair number."
    );
  }

  return number;
}


export async function getSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}
/* =========================
   INVENTORY V1
========================= */

export async function loadInventoryFromSupabase() {
  await requireSession();

  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data || []).map((item) => ({
    id: item.id,
    sku: item.sku || "",
    name: item.name || "",
    category: item.category || "",
    brandModel: item.brand_model || "",
    quantity: Number(item.quantity) || 0,
    minStock: Number(item.min_stock) || 0,
    cost: Number(item.cost) || 0,
    salePrice: Number(item.sale_price) || 0,
    supplier: item.supplier || "",
    location: item.location || "",
    active: item.active !== false,
  }));
}

export async function saveInventoryItemToSupabase(item) {
  await requireSession();

  const record = {
    sku: item.sku?.trim() || null,
    name: item.name?.trim() || "Unnamed Item",
    category: item.category?.trim() || null,
    brand_model: item.brandModel?.trim() || null,
    quantity: Math.max(0, Number(item.quantity) || 0),
    min_stock: Math.max(0, Number(item.minStock) || 0),
    cost: Math.max(0, Number(item.cost) || 0),
    sale_price: Math.max(0, Number(item.salePrice) || 0),
    supplier: item.supplier?.trim() || null,
    location: item.location?.trim() || null,
    active: item.active !== false,
    updated_at: new Date().toISOString(),
  };

  if (item.id) {
    const { data, error } = await supabase
      .from("inventory")
      .update(record)
      .eq("id", item.id)
      .select("*")
      .single();

    if (error) throw error;

    return data;
  }

  const { data, error } = await supabase
    .from("inventory")
    .insert(record)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function deleteInventoryItemFromSupabase(id) {
  await requireSession();

  if (!id) {
    throw new Error("Inventory item ID is required.");
  }

  const { error } = await supabase
    .from("inventory")
    .delete()
    .eq("id", id);

  if (error) throw error;

  return true;
}

/* =========================
   POS V1
========================= */

export async function loadSalesFromSupabase() {
  await requireSession();

  const { data, error } = await supabase
    .from("sales")
    .select(`
      *,
      sale_items (*)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((sale) => ({
    id: sale.id,
    saleNumber: sale.sale_number,
    customerName: sale.customer_name || "",
    paymentMethod: sale.payment_method || "Cash",
    subtotal: numberValue(sale.subtotal),
    total: numberValue(sale.total),
    date: toLocalDate(sale.created_at),
    items: (sale.sale_items || []).map((item) => ({
      id: item.id,
      inventoryId: item.inventory_id || "",
      sku: item.sku || "",
      name: item.name || "",
      quantity: Number(item.quantity) || 1,
      unitPrice: numberValue(item.unit_price),
      lineTotal: numberValue(item.line_total),
    })),
  }));
}

export async function createSaleInSupabase(sale) {
  await requireSession();

  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    throw new Error("Sale must include at least one item.");
  }

  const subtotal = sale.items.reduce(
    (sum, item) =>
      sum +
      numberValue(item.unitPrice) *
        Math.max(1, Number(item.quantity) || 1),
    0
  );

  const taxExempt = Boolean(sale.taxExempt);

  const taxRate = taxExempt
    ? 0
    : Math.max(0, numberValue(sale.taxRate));

  const taxAmount = taxExempt
    ? 0
    : numberValue(sale.taxAmount);

  const total =
    numberValue(sale.total) ||
    subtotal + taxAmount;

  const {
    data: openCashSessions,
    error: cashSessionError,
  } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("status", "Open")
    .order("opened_at", {
      ascending: false,
    })
    .limit(1);

  if (cashSessionError) {
    throw cashSessionError;
  }

  const cashSessionId =
    openCashSessions?.[0]?.id || null;

  const { data: createdSale, error: saleError } =
    await supabase
      .from("sales")
      .insert({
        sale_number: sale.saleNumber,
        customer_name:
          sale.customerName?.trim() || null,
        payment_method:
          sale.paymentMethod || "Cash",
        cash_session_id: cashSessionId,
        subtotal,
        tax_exempt: taxExempt,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        tax_exempt_reason:
          taxExempt
            ? sale.taxExemptReason?.trim() || null
            : null,
        total,
      })
      .select("id")
      .single();

  if (saleError) throw saleError;

  const saleItems = sale.items.map((item) => {
    const quantity =
      Math.max(1, Number(item.quantity) || 1);

    const unitPrice =
      numberValue(item.unitPrice);

    return {
      sale_id: createdSale.id,
      inventory_id:
        item.inventoryId || null,
      sku: item.sku || null,
      name: item.name || "Item",
      quantity,
      unit_price: unitPrice,
      line_total:
        quantity * unitPrice,
    };
  });

  const { error: itemsError } = await supabase
    .from("sale_items")
    .insert(saleItems);

  if (itemsError) throw itemsError;

  return {
    id: createdSale.id,
    subtotal,
    taxExempt,
    taxRate,
    taxAmount,
    total,
  };
}

/* =========================
   CASH MANAGEMENT V1
========================= */

export async function getOpenCashSessionFromSupabase() {
  const session = await requireSession();

  const { data, error } = await supabase
    .from("cash_sessions")
    .select(`
      *,
      cash_movements (*)
    `)
    .eq("status", "Open")
    .order("opened_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  return data?.[0] || null;
}

export async function openCashSessionInSupabase(
  openingCash
) {
  const session = await requireSession();

  const existing =
    await getOpenCashSessionFromSupabase();

  if (existing) {
    throw new Error(
      "There is already an open cash session."
    );
  }

  const amount =
    Math.max(0, Number(openingCash) || 0);

  const { data, error } = await supabase
    .from("cash_sessions")
    .insert({
      opened_by: session.user.id,
      opening_cash: amount,
      expected_cash: amount,
      status: "Open",
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function addCashMovementToSupabase(
  cashSessionId,
  movement
) {
  const session = await requireSession();

  if (!cashSessionId) {
    throw new Error(
      "Cash session is required."
    );
  }

  const amount =
    Math.max(0, Number(movement.amount) || 0);

  if (amount <= 0) {
    throw new Error(
      "Movement amount must be greater than zero."
    );
  }

  const { data, error } = await supabase
    .from("cash_movements")
    .insert({
      cash_session_id: cashSessionId,
      type: movement.type || "Other",
      amount,
      description:
        movement.description?.trim() || null,
      created_by: session.user.id,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function closeCashSessionInSupabase(
  cashSessionId,
  countedCash,
  notes = ""
) {
  const session = await requireSession();

  if (!cashSessionId) {
    throw new Error(
      "Cash session is required."
    );
  }

  const { data: cashSession, error: readError } =
    await supabase
      .from("cash_sessions")
      .select("*")
      .eq("id", cashSessionId)
      .single();

  if (readError) throw readError;

  if (cashSession.status !== "Open") {
    throw new Error(
      "This cash session is already closed."
    );
  }

  const { data: sales, error: salesError } =
    await supabase
      .from("sales")
      .select(
        "payment_method, total"
      )
      .eq(
        "cash_session_id",
        cashSessionId
      );

  if (salesError) throw salesError;

  const { data: movements, error: movementError } =
    await supabase
      .from("cash_movements")
      .select("type, amount")
      .eq(
        "cash_session_id",
        cashSessionId
      );

  if (movementError) throw movementError;

  const cashSales = (sales || [])
    .filter(
      (sale) =>
        String(
          sale.payment_method
        ).toLowerCase() === "cash"
    )
    .reduce(
      (sum, sale) =>
        sum + numberValue(sale.total),
      0
    );

  const cashIn = (movements || [])
    .filter(
      (movement) =>
        String(
          movement.type
        ).toLowerCase() === "cash in"
    )
    .reduce(
      (sum, movement) =>
        sum + numberValue(movement.amount),
      0
    );

  const cashOut = (movements || [])
    .filter(
      (movement) =>
        String(
          movement.type
        ).toLowerCase() === "cash out"
    )
    .reduce(
      (sum, movement) =>
        sum + numberValue(movement.amount),
      0
    );

  const expectedCash =
    numberValue(
      cashSession.opening_cash
    ) +
    cashSales +
    cashIn -
    cashOut;

  const counted =
    Math.max(
      0,
      Number(countedCash) || 0
    );

  const difference =
    counted - expectedCash;

  const { data, error } = await supabase
    .from("cash_sessions")
    .update({
      closed_by: session.user.id,
      closed_at:
        new Date().toISOString(),
      expected_cash: expectedCash,
      counted_cash: counted,
      difference,
      status: "Closed",
      notes:
        notes?.trim() || null,
    })
    .eq("id", cashSessionId)
    .select("*")
    .single();

  if (error) throw error;

  return {
    ...data,
    cashSales,
    cashIn,
    cashOut,
    expectedCash,
    countedCash: counted,
    difference,
  };
}
