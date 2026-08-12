import { supabase } from "./supabase";

function toIsoDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function toLocalDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

async function requireSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  if (!session) {
    throw new Error(
      "No Supabase login session found."
    );
  }

  return session;
}

async function findOrCreateCustomer(repair) {
  const name =
    repair.customer?.trim() ||
    "Unknown Customer";

  const phone =
    repair.phone?.trim() ||
    null;

  let query = supabase
    .from("customers")
    .select("id")
    .limit(1);

  query = phone
    ? query.eq("phone", phone)
    : query.eq("name", name);

  const {
    data: existing,
    error: findError,
  } = await query;

  if (findError) throw findError;

  if (existing?.length) {
    return existing[0].id;
  }

  const {
    data: created,
    error: createError,
  } = await supabase
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
    .order(
      "created_at",
      { ascending: false }
    );

  if (error) throw error;

  return (data || []).map((row) => {
    const payments = (
      row.payments || []
    )
      .slice()
      .sort(
        (a, b) =>
          new Date(a.paid_at) -
          new Date(b.paid_at)
      )
      .map((payment) => ({
        id: payment.id,
        amount: numberValue(
          payment.amount
        ),
        method:
          payment.method || "Other",
        note:
          payment.note || "",
        date:
          toLocalDate(
            payment.paid_at
          ),
      }));

    const orderedParts = (
      row.repair_parts || []
    )
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at) -
          new Date(b.created_at)
      )
      .map((part) => ({
        id: part.id,
        name:
          part.name || "Part",
        supplier:
          part.supplier || "",
        cost:
          numberValue(
            part.cost
          ),
        tracking:
          part.tracking_number ||
          "",
        status:
          part.status ||
          "Needed",
        date:
          toLocalDate(
            part.created_at
          ),
      }));

    const timeline = (
      row.repair_timeline || []
    )
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at) -
          new Date(b.created_at)
      )
      .map((entry) => ({
        id: entry.id,
        text:
          entry.event_text ||
          "Repair update",
        date:
          toLocalDate(
            entry.created_at
          ),
      }));

    return {
      id:
        row.ticket_number,

      customer:
        row.customer_name || "",

      phone:
        row.phone || "",

      deviceType:
        row.device_type ||
        "Other",

      brand:
        row.brand || "",

      model:
        row.model || "",

      serial:
        row.serial_imei || "",

      issue:
        row.issue || "",

      diagnosis:
        row.diagnosis || "",

      accessories:
        row.accessories || "",

      condition:
        row.device_condition ||
        "Good",

      technician:
        row.technician ||
        "Unassigned",

      estimatedCompletion:
        row.estimated_completion ||
        "",

      partsCost:
        numberValue(
          row.parts_cost
        ),

      labor:
        numberValue(
          row.labor
        ),

      total:
        numberValue(
          row.total
        ),

      paid:
        numberValue(
          row.paid
        ),

      balance:
        numberValue(
          row.balance
        ),

      passcode:
        row.passcode || "",

      status:
        row.status ||
        "Received",

      priority:
        row.priority ||
        "Normal",

      warranty:
        row.warranty ||
        "No Warranty",

      approval:
        row.approval ||
        "Pending",

      partsNeeded:
        row.parts_needed ||
        "",

      internalNotes:
        row.internal_notes ||
        "",

      customerNotes:
        row.customer_notes ||
        "",

      checkIn:
        row.check_in || {},

      payments,

      orderedParts,

      timeline,

      intakeDate:
        toLocalDate(
          row.intake_date
        ),

      deliveryDate:
        toLocalDate(
          row.delivery_date
        ),

      invoiceNumber:
        row.invoice_number ||
        "",

      reopened:
        Boolean(
          row.reopened
        ),
    };
  });
}export async function saveRepairToSupabase(repair) {
  await requireSession();

  const customerId =
    await findOrCreateCustomer(repair);

  const payments = Array.isArray(
    repair.payments
  )
    ? repair.payments
    : [];

  const orderedParts = Array.isArray(
    repair.orderedParts
  )
    ? repair.orderedParts
    : [];

  const timeline = Array.isArray(
    repair.timeline
  )
    ? repair.timeline
    : [];

  const partsCost =
    numberValue(repair.partsCost);

  const labor =
    numberValue(repair.labor);

  const total =
    partsCost + labor;

  const paid = payments.reduce(
    (sum, payment) =>
      sum +
      numberValue(payment.amount),
    0
  );

  const balance = Math.max(
    total - paid,
    0
  );

  const repairRecord = {
    ticket_number:
      repair.id,

    customer_id:
      customerId,

    customer_name:
      repair.customer ||
      "Unknown Customer",

    phone:
      repair.phone || null,

    device_type:
      repair.deviceType ||
      null,

    brand:
      repair.brand || null,

    model:
      repair.model || null,

    serial_imei:
      repair.serial || null,

    issue:
      repair.issue || null,

    diagnosis:
      repair.diagnosis ||
      null,

    accessories:
      repair.accessories ||
      null,

    device_condition:
      repair.condition ||
      null,

    technician:
      repair.technician ||
      null,

    estimated_completion:
      repair.estimatedCompletion ||
      null,

    parts_cost:
      partsCost,

    labor,
    total,
    paid,
    balance,

    passcode:
      repair.passcode || null,

    status:
      repair.status ||
      "Received",

    priority:
      repair.priority ||
      "Normal",

    warranty:
      repair.warranty ||
      "No Warranty",

    approval:
      repair.approval ||
      "Pending",

    parts_needed:
      repair.partsNeeded ||
      null,

    internal_notes:
      repair.internalNotes ||
      null,

    customer_notes:
      repair.customerNotes ||
      null,

    check_in:
      repair.checkIn || {},

    intake_date:
      toIsoDate(
        repair.intakeDate
      ) ||
      new Date().toISOString(),

    delivery_date:
      toIsoDate(
        repair.deliveryDate
      ),

    invoice_number:
      repair.invoiceNumber ||
      null,

    reopened:
      Boolean(
        repair.reopened
      ),

    updated_at:
      new Date().toISOString(),
  };

  const {
    data: savedRepair,
    error: repairError,
  } = await supabase
    .from("repairs")
    .upsert(
      repairRecord,
      {
        onConflict:
          "ticket_number",
      }
    )
    .select("id,ticket_number")
    .single();

  if (repairError) {
    throw repairError;
  }

  const repairUuid =
    savedRepair.id;

  /*
    Rebuild child records so Supabase
    always matches the current ticket.
  */

  const childTables = [
    "payments",
    "repair_parts",
    "repair_timeline",
  ];

  for (const table of childTables) {
    const { error } =
      await supabase
        .from(table)
        .delete()
        .eq(
          "repair_id",
          repairUuid
        );

    if (error) {
      throw error;
    }
  }

  if (payments.length > 0) {
    const paymentRows =
      payments.map(
        (payment) => ({
          repair_id:
            repairUuid,

          amount:
            numberValue(
              payment.amount
            ),

          method:
            payment.method ||
            "Other",

          note:
            payment.note ||
            null,

          paid_at:
            toIsoDate(
              payment.date
            ) ||
            new Date().toISOString(),
        })
      );

    const {
      error: paymentError,
    } = await supabase
      .from("payments")
      .insert(paymentRows);

    if (paymentError) {
      throw paymentError;
    }
  }

  if (orderedParts.length > 0) {
    const partRows =
      orderedParts.map(
        (part) => ({
          repair_id:
            repairUuid,

          name:
            part.name ||
            "Part",

          supplier:
            part.supplier ||
            null,

          cost:
            numberValue(
              part.cost
            ),

          tracking_number:
            part.tracking ||
            null,

          status:
            part.status ||
            "Needed",

          created_at:
            toIsoDate(
              part.date
            ) ||
            new Date().toISOString(),
        })
      );

    const {
      error: partError,
    } = await supabase
      .from("repair_parts")
      .insert(partRows);

    if (partError) {
      throw partError;
    }
  }

  if (timeline.length > 0) {
    const timelineRows =
      timeline.map(
        (entry) => ({
          repair_id:
            repairUuid,

          event_text:
            entry.text ||
            "Repair update",

          created_at:
            toIsoDate(
              entry.date
            ) ||
            new Date().toISOString(),
        })
      );

    const {
      error: timelineError,
    } = await supabase
      .from("repair_timeline")
      .insert(timelineRows);

    if (timelineError) {
      throw timelineError;
    }
  }

  return savedRepair;
}

export async function loadBusinessSettingsFromSupabase() {
  await requireSession();

  const {
    data,
    error,
  } = await supabase
    .from("business_settings")
    .select("*")
    .order(
      "created_at",
      { ascending: true }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    businessName:
      data.business_name ||
      "MicrotechUSA",

    subtitle:
      data.subtitle ||
      "Repair Center",

    phone:
      data.phone || "",

    email:
      data.email || "",

    address:
      data.address || "",

    defaultWarranty:
      data.default_warranty ||
      "90 Days",
  };
}

export async function saveBusinessSettingsToSupabase(
  settings
) {
  await requireSession();

  const {
    data: existing,
    error: findError,
  } = await supabase
    .from("business_settings")
    .select("id")
    .order(
      "created_at",
      { ascending: true }
    )
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  const record = {
    business_name:
      settings.businessName ||
      "MicrotechUSA",

    subtitle:
      settings.subtitle ||
      "Repair Center",

    phone:
      settings.phone ||
      null,

    email:
      settings.email ||
      null,

    address:
      settings.address ||
      null,

    default_warranty:
      settings.defaultWarranty ||
      "90 Days",

    updated_at:
      new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } =
      await supabase
        .from(
          "business_settings"
        )
        .update(record)
        .eq(
          "id",
          existing.id
        );

    if (error) {
      throw error;
    }

    return existing.id;
  }

  const {
    data: created,
    error: createError,
  } = await supabase
    .from("business_settings")
    .insert(record)
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  return created.id;
}