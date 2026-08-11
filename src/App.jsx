import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEVICE_TYPES = [
  "iPhone",
  "iPad",
  "MacBook",
  "Samsung",
  "Android",
  "PlayStation",
  "Xbox",
  "Nintendo Switch",
  "Other",
];

const TECHNICIANS = [
  "Unassigned",
  "Roberto",
  "Technician 2",
  "Technician 3",
];

const STATUSES = [
  "Received",
  "In Progress",
  "Waiting for Parts",
  "Ready",
  "Completed",
];

const PRIORITIES = ["Normal", "Rush", "Urgent"];

const WARRANTY_OPTIONS = [
  "No Warranty",
  "30 Days",
  "60 Days",
  "90 Days",
  "6 Months",
  "1 Year",
];

const APPROVAL_OPTIONS = [
  "Pending",
  "Approved",
  "Declined",
  "Not Required",
];

const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "Zelle",
  "Cash App",
  "Venmo",
  "Apple Pay",
  "Other",
];

const PART_STATUSES = [
  "Needed",
  "Ordered",
  "Shipped",
  "Received",
  "Installed",
];

const emptyForm = {
  customer: "",
  phone: "",
  deviceType: "iPhone",
  brand: "",
  model: "",
  serial: "",
  issue: "",
  diagnosis: "",
  accessories: "",
  condition: "Good",
  technician: "Unassigned",
  estimatedCompletion: "",
  partsCost: "",
  labor: "",
  passcode: "",
  status: "Received",
  priority: "Normal",
  warranty: "No Warranty",
  approval: "Pending",
  partsNeeded: "",
  internalNotes: "",
  customerNotes: "",
  checkIn: {},
  payments: [],
  timeline: [],
  orderedParts: [],
  intakeDate: "",
  deliveryDate: "",
  invoiceNumber: "",
  reopened: false,
};

function nowString() {
  return new Date().toLocaleString();
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function isToday(value) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function normalizeRepair(repair) {
  let payments = Array.isArray(repair.payments)
    ? repair.payments
    : [];

  if (
    payments.length === 0 &&
    Number(repair.deposit || 0) > 0
  ) {
    payments = [
      {
        id: `PAY-OLD-${repair.id}`,
        amount: Number(repair.deposit),
        method: "Other",
        date: repair.intakeDate || "Previous payment",
        note: "Imported from previous deposit",
      },
    ];
  }

  const total =
    Number(repair.partsCost || 0) +
    Number(repair.labor || 0);

  const paid = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || 0),
    0
  );

  return {
    priority: "Normal",
    warranty: "No Warranty",
    approval: "Pending",
    partsNeeded: "",
    internalNotes: "",
    customerNotes: "",
    checkIn: {},
    intakeDate: "",
    deliveryDate: "",
    timeline: [],
    orderedParts: [],
    invoiceNumber: "",
    reopened: false,
    ...repair,
    payments,
    orderedParts: Array.isArray(repair.orderedParts)
      ? repair.orderedParts
      : [],
    timeline: Array.isArray(repair.timeline)
      ? repair.timeline
      : [],
    total,
    paid,
    balance: Math.max(total - paid, 0),
  };
}

function getCheckItems(deviceType) {
  if (
    deviceType === "iPhone" ||
    deviceType === "Samsung" ||
    deviceType === "Android"
  ) {
    return [
      "Screen",
      "Touch",
      "Charging",
      "Battery",
      "Front Camera",
      "Rear Camera",
      "Microphone",
      "Speaker",
      "Wi-Fi",
      "Bluetooth",
      "Buttons",
      "Face ID / Biometrics",
    ];
  }

  if (deviceType === "iPad") {
    return [
      "Screen",
      "Touch",
      "Charging",
      "Battery",
      "Front Camera",
      "Rear Camera",
      "Speaker",
      "Microphone",
      "Wi-Fi",
      "Bluetooth",
      "Buttons",
    ];
  }

  if (deviceType === "MacBook") {
    return [
      "Display",
      "Keyboard",
      "Trackpad",
      "Charging",
      "Battery",
      "Wi-Fi",
      "Bluetooth",
      "USB Ports",
      "Camera",
      "Speakers",
      "Microphone",
    ];
  }

  if (
    deviceType === "PlayStation" ||
    deviceType === "Xbox"
  ) {
    return [
      "Power",
      "HDMI Output",
      "HDMI Port",
      "USB Ports",
      "Disc Drive",
      "Wi-Fi",
      "Bluetooth",
      "Overheating",
      "Fan",
      "Controller Sync",
    ];
  }

  if (deviceType === "Nintendo Switch") {
    return [
      "Power",
      "Display",
      "Touch",
      "Charging",
      "USB-C Port",
      "Wi-Fi",
      "Bluetooth",
      "Game Card Reader",
      "Joy-Con Rails",
      "Dock Output",
    ];
  }

  return [
    "Power",
    "Display",
    "Charging",
    "Buttons",
    "Wi-Fi",
    "Bluetooth",
  ];
}

function paymentStatus(total, paid) {
  const totalNumber = Number(total) || 0;
  const paidNumber = Number(paid) || 0;

  if (totalNumber === 0) return "No Charge";
  if (paidNumber <= 0) return "Unpaid";
  if (paidNumber >= totalNumber) return "Paid";

  return "Partial";
}

function App() {
  const [activeSection, setActiveSection] =
    useState("Dashboard");

  const [repairs, setRepairs] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "microtechusa_repairs"
      );

      if (!saved) return [];

      return JSON.parse(saved).map(normalizeRepair);
    } catch {
      return [];
    }
  });

  const [businessSettings, setBusinessSettings] =
    useState(() => {
      try {
        const saved = localStorage.getItem(
          "microtechusa_settings"
        );

        if (saved) {
          return JSON.parse(saved);
        }
      } catch {
        // ignore
      }

      return {
        businessName: "MicrotechUSA",
        subtitle: "Repair Center",
        phone: "",
        email: "",
        address: "",
        defaultWarranty: "90 Days",
      };
    });

  const [form, setForm] = useState({
    ...emptyForm,
  });

  const [editForm, setEditForm] =
    useState(null);

  const [showModal, setShowModal] =
    useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [showInvoice, setShowInvoice] =
    useState(false);

  const [showLabel, setShowLabel] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [globalSearch, setGlobalSearch] =
    useState("");

  const [repairFilter, setRepairFilter] =
    useState("All");

  const [paymentForm, setPaymentForm] =
    useState({
      amount: "",
      method: "Cash",
      note: "",
    });

  const [partForm, setPartForm] =
    useState({
      name: "",
      supplier: "",
      cost: "",
      tracking: "",
      status: "Needed",
    });

  useEffect(() => {
    localStorage.setItem(
      "microtechusa_repairs",
      JSON.stringify(repairs)
    );
  }, [repairs]);

  useEffect(() => {
    localStorage.setItem(
      "microtechusa_settings",
      JSON.stringify(businessSettings)
    );
  }, [businessSettings]);

  function handleChange(event) {
    const { name, value } =
      event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleEditChange(event) {
    const { name, value } =
      event.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function toggleCheckIn(item, editing) {
    if (editing) {
      setEditForm((current) => ({
        ...current,
        checkIn: {
          ...(current.checkIn || {}),
          [item]:
            !(current.checkIn || {})[item],
        },
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      checkIn: {
        ...(current.checkIn || {}),
        [item]:
          !(current.checkIn || {})[item],
      },
    }));
  }

  function getNextRepairId() {
    const numbers = repairs
      .map((repair) =>
        Number(
          String(repair.id).replace(
            "MT-",
            ""
          )
        )
      )
      .filter(
        (number) =>
          !Number.isNaN(number)
      );

    const next =
      numbers.length > 0
        ? Math.max(...numbers) + 1
        : 1;

    return `MT-${String(next).padStart(
      6,
      "0"
    )}`;
  }

  function getNextInvoiceNumber() {
    const numbers = repairs
      .map(
        (repair) =>
          repair.invoiceNumber
      )
      .filter(Boolean)
      .map((invoice) =>
        Number(
          String(invoice).replace(
            "INV-",
            ""
          )
        )
      )
      .filter(
        (number) =>
          !Number.isNaN(number)
      );

    const next =
      numbers.length > 0
        ? Math.max(...numbers) + 1
        : 1;

    return `INV-${String(next).padStart(
      6,
      "0"
    )}`;
  }

  function createRepair(event) {
    event.preventDefault();

    if (
      !form.customer ||
      !form.model ||
      !form.issue
    ) {
      alert(
        "Please complete Customer, Model and Issue."
      );
      return;
    }

    const partsCost =
      Number(form.partsCost) || 0;

    const labor =
      Number(form.labor) || 0;

    const total =
      partsCost + labor;

    const intakeDate =
      nowString();

    const newRepair = {
      ...form,
      id: getNextRepairId(),
      partsCost,
      labor,
      total,
      paid: 0,
      balance: total,
      payments: [],
      orderedParts: [],
      intakeDate,
      deliveryDate: "",
      invoiceNumber: "",
      timeline: [
        {
          id: `TIME-${Date.now()}`,
          date: intakeDate,
          text: "Repair ticket created",
        },
      ],
    };

    setRepairs((current) => [
      newRepair,
      ...current,
    ]);

    setForm({
      ...emptyForm,
      warranty:
        businessSettings.defaultWarranty ||
        "No Warranty",
    });

    setShowModal(false);
  }

  function openRepair(repair) {
    setEditForm(
      normalizeRepair(repair)
    );

    setPaymentForm({
      amount: "",
      method: "Cash",
      note: "",
    });

    setPartForm({
      name: "",
      supplier: "",
      cost: "",
      tracking: "",
      status: "Needed",
    });

    setShowEditModal(true);
  }

  function addPayment() {
    if (!editForm) return;

    const amount =
      Number(paymentForm.amount) || 0;

    if (amount <= 0) {
      alert(
        "Enter a valid payment amount."
      );
      return;
    }

    const date = nowString();

    const payment = {
      id: `PAY-${Date.now()}`,
      amount,
      method: paymentForm.method,
      note: paymentForm.note,
      date,
    };

    const payments = [
      ...(editForm.payments || []),
      payment,
    ];

    const paid = payments.reduce(
      (sum, item) =>
        sum +
        Number(item.amount || 0),
      0
    );

    const total =
      Number(
        editForm.partsCost || 0
      ) +
      Number(editForm.labor || 0);

    const balance = Math.max(
      total - paid,
      0
    );

    setEditForm((current) => ({
      ...current,
      payments,
      paid,
      total,
      balance,
      timeline: [
        ...(current.timeline || []),
        {
          id: `TIME-${Date.now()}-payment`,
          date,
          text: `Payment received: $${amount.toFixed(
            2
          )} - ${paymentForm.method}`,
        },
      ],
    }));

    setPaymentForm({
      amount: "",
      method: "Cash",
      note: "",
    });
  }

  function addPart() {
    if (!editForm) return;

    if (!partForm.name.trim()) {
      alert("Enter the part name.");
      return;
    }

    const date = nowString();

    const newPart = {
      id: `PART-${Date.now()}`,
      name: partForm.name,
      supplier: partForm.supplier,
      cost:
        Number(partForm.cost) || 0,
      tracking: partForm.tracking,
      status: partForm.status,
      date,
    };

    setEditForm((current) => ({
      ...current,
      orderedParts: [
        ...(current.orderedParts || []),
        newPart,
      ],
      timeline: [
        ...(current.timeline || []),
        {
          id: `TIME-${Date.now()}-part`,
          date,
          text: `Part added: ${newPart.name} - ${newPart.status}`,
        },
      ],
    }));

    setPartForm({
      name: "",
      supplier: "",
      cost: "",
      tracking: "",
      status: "Needed",
    });
  }

  function changePartStatus(
    partId,
    status
  ) {
    setEditForm((current) => ({
      ...current,
      orderedParts:
        current.orderedParts.map(
          (part) =>
            part.id === partId
              ? {
                  ...part,
                  status,
                }
              : part
        ),
      timeline: [
        ...(current.timeline || []),
        {
          id: `TIME-${Date.now()}-part-status`,
          date: nowString(),
          text: `Part status changed to ${status}`,
        },
      ],
    }));
  }

  function saveRepairChanges(
    event
  ) {
    event.preventDefault();

    if (!editForm) return;

    const original = repairs.find(
      (repair) =>
        repair.id === editForm.id
    );

    const partsCost =
      Number(
        editForm.partsCost
      ) || 0;

    const labor =
      Number(editForm.labor) || 0;

    const total =
      partsCost + labor;

    const paid = (
      editForm.payments || []
    ).reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.amount || 0
        ),
      0
    );

    const balance = Math.max(
      total - paid,
      0
    );

    let timeline = [
      ...(editForm.timeline || []),
    ];

    if (
      original &&
      original.status !==
        editForm.status
    ) {
      timeline.push({
        id: `TIME-${Date.now()}-status`,
        date: nowString(),
        text: `Status changed from ${original.status} to ${editForm.status}`,
      });
    }

    let deliveryDate =
      editForm.deliveryDate || "";

    if (
      editForm.status ===
        "Completed" &&
      original?.status !==
        "Completed"
    ) {
      deliveryDate =
        nowString();

      timeline.push({
        id: `TIME-${Date.now()}-completed`,
        date: deliveryDate,
        text: "Repair completed",
      });
    }

    const updated = {
      ...editForm,
      partsCost,
      labor,
      total,
      paid,
      balance,
      deliveryDate,
      timeline,
    };

    setRepairs((current) =>
      current.map((repair) =>
        repair.id === updated.id
          ? updated
          : repair
      )
    );

    setEditForm(updated);
  }

  function generateInvoice() {
    if (!editForm) return;

    let updated = {
      ...editForm,
    };

    if (!updated.invoiceNumber) {
      updated.invoiceNumber =
        getNextInvoiceNumber();

      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: `TIME-${Date.now()}-invoice`,
          date: nowString(),
          text: `Invoice created: ${updated.invoiceNumber}`,
        },
      ];

      setEditForm(updated);

      setRepairs((current) =>
        current.map((repair) =>
          repair.id === updated.id
            ? updated
            : repair
        )
      );
    }

    setShowInvoice(true);
  }

  function duplicateRepair() {
    if (!editForm) return;

    const intakeDate =
      nowString();

    const duplicate = {
      ...emptyForm,
      customer:
        editForm.customer,
      phone: editForm.phone,
      deviceType:
        editForm.deviceType,
      brand: editForm.brand,
      model: editForm.model,
      serial: editForm.serial,
      passcode:
        editForm.passcode,
      accessories:
        editForm.accessories,
      condition:
        editForm.condition,
      technician:
        editForm.technician,
      warranty:
        businessSettings.defaultWarranty ||
        "No Warranty",
      id: getNextRepairId(),
      intakeDate,
      timeline: [
        {
          id: `TIME-${Date.now()}-duplicate`,
          date: intakeDate,
          text: `New repair duplicated from ${editForm.id}`,
        },
      ],
      total: 0,
      paid: 0,
      balance: 0,
    };

    setRepairs((current) => [
      duplicate,
      ...current,
    ]);

    setShowEditModal(false);
    setEditForm(null);
  }

  function reopenRepair() {
    if (!editForm) return;

    const date =
      nowString();

    setEditForm((current) => ({
      ...current,
      status: "Received",
      deliveryDate: "",
      reopened: true,
      timeline: [
        ...(current.timeline || []),
        {
          id: `TIME-${Date.now()}-reopen`,
          date,
          text: "Repair reopened",
        },
      ],
    }));
  }

  const filteredRepairs =
    repairs.filter((repair) => {
      const text = `
        ${repair.id}
        ${repair.customer}
        ${repair.phone}
        ${repair.deviceType}
        ${repair.brand}
        ${repair.model}
        ${repair.serial}
        ${repair.issue}
        ${repair.status}
        ${repair.technician}
        ${repair.invoiceNumber}
      `.toLowerCase();

      const matchesSearch =
        text.includes(
          search.toLowerCase()
        );

      const matchesFilter =
        repairFilter === "All" ||
        repair.status ===
          repairFilter;

      return (
        matchesSearch &&
        matchesFilter
      );
    });

  const globalResults =
    repairs.filter((repair) => {
      if (
        !globalSearch.trim()
      ) {
        return false;
      }

      const text = `
        ${repair.id}
        ${repair.customer}
        ${repair.phone}
        ${repair.deviceType}
        ${repair.brand}
        ${repair.model}
        ${repair.serial}
        ${repair.issue}
        ${repair.diagnosis}
        ${repair.status}
        ${repair.invoiceNumber}
      `.toLowerCase();

      return text.includes(
        globalSearch
          .trim()
          .toLowerCase()
      );
    });

  const activeRepairs =
    repairs.filter(
      (repair) =>
        repair.status !==
        "Completed"
    ).length;

  const readyRepairs =
    repairs.filter(
      (repair) =>
        repair.status ===
        "Ready"
    ).length;

  const completedRepairs =
    repairs.filter(
      (repair) =>
        repair.status ===
        "Completed"
    ).length;

  const waitingParts =
    repairs.filter(
      (repair) =>
        repair.status ===
        "Waiting for Parts"
    ).length;

  const balanceDue =
    repairs.reduce(
      (sum, repair) =>
        sum +
        Number(
          repair.balance || 0
        ),
      0
    );

  const totalCollected =
    repairs.reduce(
      (sum, repair) =>
        sum +
        Number(
          repair.paid || 0
        ),
      0
    );

  const repairsToday =
    repairs.filter((repair) =>
      isToday(
        repair.intakeDate
      )
    ).length;

  const invoices =
    repairs.filter(
      (repair) =>
        repair.invoiceNumber
    );

  const allPayments =
    useMemo(() => {
      return repairs
        .flatMap((repair) =>
          (
            repair.payments || []
          ).map((payment) => ({
            ...payment,
            repairId:
              repair.id,
            customer:
              repair.customer,
          }))
        )
        .reverse();
    }, [repairs]);

  const revenueToday =
    allPayments
      .filter((payment) =>
        isToday(payment.date)
      )
      .reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.amount || 0
          ),
        0
      );

  const recentPayments =
    allPayments.slice(0, 6);

  const customers =
    useMemo(() => {
      const map =
        new Map();

      repairs.forEach(
        (repair) => {
          const key =
            repair.phone?.trim() ||
            repair.customer?.trim();

          if (!key) return;

          if (!map.has(key)) {
            map.set(key, {
              key,
              name:
                repair.customer,
              phone:
                repair.phone,
              repairs: [],
              totalSpent: 0,
              balance: 0,
            });
          }

          const customer =
            map.get(key);

          customer.repairs.push(
            repair
          );

          customer.totalSpent +=
            Number(
              repair.paid || 0
            );

          customer.balance +=
            Number(
              repair.balance || 0
            );
        }
      );

      return Array.from(
        map.values()
      );
    }, [repairs]);

  const customerHistory =
    editForm
      ? repairs.filter(
          (repair) =>
            repair.id !==
              editForm.id &&
            repair.phone &&
            repair.phone ===
              editForm.phone
        )
      : [];

  function renderRepairFields(
    data,
    onChange,
    editing
  ) {
    const checkItems =
      getCheckItems(
        data.deviceType
      );

    return (
      <div className="form-grid">
        <div className="form-group">
          <label>
            Customer *
          </label>
          <input
            name="customer"
            value={
              data.customer || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            name="phone"
            value={
              data.phone || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>
            Device Type
          </label>
          <select
            name="deviceType"
            value={
              data.deviceType
            }
            onChange={onChange}
          >
            {DEVICE_TYPES.map(
              (type) => (
                <option key={type}>
                  {type}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Brand</label>
          <input
            name="brand"
            value={
              data.brand || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Model *</label>
          <input
            name="model"
            value={
              data.model || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>
            Serial / IMEI
          </label>
          <input
            name="serial"
            value={
              data.serial || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Priority</label>
          <select
            name="priority"
            value={
              data.priority
            }
            onChange={onChange}
          >
            {PRIORITIES.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Status</label>
          <select
            name="status"
            value={data.status}
            onChange={onChange}
          >
            {STATUSES.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label>
            Technician
          </label>
          <select
            name="technician"
            value={
              data.technician
            }
            onChange={onChange}
          >
            {TECHNICIANS.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label>
            Estimated Completion
          </label>
          <input
            type="date"
            name="estimatedCompletion"
            value={
              data.estimatedCompletion ||
              ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>
            Device Condition
          </label>

          <select
            name="condition"
            value={
              data.condition ||
              "Good"
            }
            onChange={onChange}
          >
            <option>Good</option>
            <option>
              Cracked Screen
            </option>
            <option>
              Broken Back Glass
            </option>
            <option>
              Bent Frame
            </option>
            <option>
              Liquid Damage
            </option>
            <option>
              Heavy Damage
            </option>
            <option>Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>
            Customer Approval
          </label>

          <select
            name="approval"
            value={
              data.approval
            }
            onChange={onChange}
          >
            {APPROVAL_OPTIONS.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Warranty</label>

          <select
            name="warranty"
            value={
              data.warranty
            }
            onChange={onChange}
          >
            {WARRANTY_OPTIONS.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Passcode</label>

          <input
            name="passcode"
            value={
              data.passcode || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group full-width">
          <label>
            Accessories Received
          </label>

          <input
            name="accessories"
            value={
              data.accessories || ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group full-width">
          <label>Issue *</label>

          <textarea
            name="issue"
            value={
              data.issue || ""
            }
            onChange={onChange}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>
            Diagnosis
          </label>

          <textarea
            name="diagnosis"
            value={
              data.diagnosis || ""
            }
            onChange={onChange}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>
            Parts Needed
          </label>

          <textarea
            name="partsNeeded"
            value={
              data.partsNeeded || ""
            }
            onChange={onChange}
            rows="2"
          />
        </div>

        <div className="form-group full-width">
          <label>
            Internal Technician Notes
          </label>

          <textarea
            name="internalNotes"
            value={
              data.internalNotes || ""
            }
            onChange={onChange}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>
            Customer Notes
          </label>

          <textarea
            name="customerNotes"
            value={
              data.customerNotes || ""
            }
            onChange={onChange}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>
            Device Check-In
          </label>

          <div className="checkin-grid">
            {checkItems.map(
              (item) => (
                <label
                  className="checkin-item"
                  key={item}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(
                      data.checkIn?.[
                        item
                      ]
                    )}
                    onChange={() =>
                      toggleCheckIn(
                        item,
                        editing
                      )
                    }
                  />

                  <span>
                    {item}
                  </span>
                </label>
              )
            )}
          </div>
        </div>

        <div className="form-group">
          <label>
            Parts Cost
          </label>

          <input
            type="number"
            step="0.01"
            name="partsCost"
            value={
              data.partsCost ?? ""
            }
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Labor</label>

          <input
            type="number"
            step="0.01"
            name="labor"
            value={
              data.labor ?? ""
            }
            onChange={onChange}
          />
        </div>
      </div>
    );
  }

  function renderRepairsTable(
    list
  ) {
    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Repair #</th>
              <th>Customer</th>
              <th>Device</th>
              <th>Status</th>
              <th>Technician</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {list.map((repair) => (
              <tr key={repair.id}>
                <td className="repair-id">
                  {repair.id}
                </td>

                <td>
                  <strong>
                    {repair.customer}
                  </strong>

                  <div className="small-text">
                    {repair.phone}
                  </div>
                </td>

                <td>
                  {repair.deviceType}{" "}
                  {repair.model}
                </td>

                <td>
                  <span
                    className={`status ${repair.status
                      .toLowerCase()
                      .replaceAll(
                        " ",
                        "-"
                      )}`}
                  >
                    {repair.status}
                  </span>
                </td>

                <td>
                  {repair.technician}
                </td>

                <td>
                  $
                  {money(
                    repair.total
                  )}
                </td>

                <td>
                  $
                  {money(
                    repair.paid
                  )}
                </td>

                <td className="balance">
                  $
                  {money(
                    repair.balance
                  )}
                </td>

                <td>
                  <button
                    className="table-btn"
                    onClick={() =>
                      openRepair(
                        repair
                      )
                    }
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}

            {list.length === 0 && (
              <tr>
                <td
                  colSpan="9"
                  style={{
                    textAlign:
                      "center",
                    padding: "30px",
                  }}
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderDashboard() {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Repair Center
            </p>

            <h1>Dashboard</h1>

            <p className="subtitle">
              Today&apos;s shop overview.
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() =>
              setShowModal(true)
            }
          >
            + New Repair
          </button>
        </header>

        <div className="global-search-box">
          <span>🔎</span>

          <input
            placeholder="Search ticket, customer, phone, model, serial / IMEI..."
            value={globalSearch}
            onChange={(event) =>
              setGlobalSearch(
                event.target.value
              )
            }
          />

          {globalSearch && (
            <button
              onClick={() =>
                setGlobalSearch("")
              }
            >
              ×
            </button>
          )}
        </div>

        {globalSearch && (
          <section className="content-card global-results">
            <div className="content-header">
              <div>
                <h2>
                  Search Results
                </h2>

                <p>
                  {globalResults.length}{" "}
                  repair
                  {globalResults.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  found.
                </p>
              </div>
            </div>

            {renderRepairsTable(
              globalResults
            )}
          </section>
        )}

        <section className="dashboard-metrics">
          <div className="metric-card">
            <span className="metric-icon">
              📥
            </span>

            <div>
              <span>
                Repairs Today
              </span>

              <strong>
                {repairsToday}
              </strong>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">
              💰
            </span>

            <div>
              <span>
                Revenue Today
              </span>

              <strong>
                $
                {money(
                  revenueToday
                )}
              </strong>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">
              ✅
            </span>

            <div>
              <span>
                Ready for Pickup
              </span>

              <strong>
                {readyRepairs}
              </strong>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">
              📦
            </span>

            <div>
              <span>
                Waiting for Parts
              </span>

              <strong>
                {waitingParts}
              </strong>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">
              💳
            </span>

            <div>
              <span>
                Outstanding Balance
              </span>

              <strong>
                $
                {money(
                  balanceDue
                )}
              </strong>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">
              🏦
            </span>

            <div>
              <span>
                Total Collected
              </span>

              <strong>
                $
                {money(
                  totalCollected
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="dashboard-two-column">
          <div className="content-card dashboard-panel">
            <div className="content-header">
              <div>
                <h2>
                  Recent Repairs
                </h2>

                <p>
                  Latest tickets in
                  your shop.
                </p>
              </div>

              <button
                className="secondary-btn"
                onClick={() =>
                  setActiveSection(
                    "Repairs"
                  )
                }
              >
                View All
              </button>
            </div>

            {renderRepairsTable(
              repairs.slice(0, 6)
            )}
          </div>

          <div className="content-card recent-payments-card">
            <div className="content-header">
              <div>
                <h2>
                  Recent Payments
                </h2>

                <p>
                  Latest customer
                  payments.
                </p>
              </div>

              <button
                className="secondary-btn"
                onClick={() =>
                  setActiveSection(
                    "Payments"
                  )
                }
              >
                View All
              </button>
            </div>

            <div className="recent-payment-list">
              {recentPayments.map(
                (payment) => (
                  <div
                    className="recent-payment-item"
                    key={
                      payment.id
                    }
                  >
                    <div className="recent-payment-avatar">
                      $
                    </div>

                    <div className="recent-payment-info">
                      <strong>
                        {
                          payment.customer
                        }
                      </strong>

                      <span>
                        {
                          payment.repairId
                        }{" "}
                        ·{" "}
                        {
                          payment.method
                        }
                      </span>

                      <small>
                        {
                          payment.date
                        }
                      </small>
                    </div>

                    <strong className="recent-payment-amount">
                      +$
                      {money(
                        payment.amount
                      )}
                    </strong>
                  </div>
                )
              )}

              {recentPayments.length ===
                0 && (
                <div className="dashboard-empty">
                  No payments recorded
                  yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="content-card device-section">
          <div className="content-header">
            <div>
              <h2>
                Repairs by Device Type
              </h2>

              <p>
                Current repair volume
                by category.
              </p>
            </div>
          </div>

          <div className="device-grid">
            {DEVICE_TYPES.map(
              (type) => {
                const count =
                  repairs.filter(
                    (repair) =>
                      repair.deviceType ===
                      type
                  ).length;

                return (
                  <div
                    className="device-card"
                    key={type}
                  >
                    <span>
                      {type}
                    </span>

                    <strong>
                      {count}
                    </strong>
                  </div>
                );
              }
            )}
          </div>
        </section>
      </>
    );
  }

  function renderRepairs() {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Repair Management
            </p>

            <h1>Repairs</h1>

            <p className="subtitle">
              Search and manage all
              repair tickets.
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() =>
              setShowModal(true)
            }
          >
            + New Repair
          </button>
        </header>

        <section className="content-card">
          <div className="content-header">
            <div className="repair-filters">
              {[
                "All",
                ...STATUSES,
              ].map((status) => (
                <button
                  key={status}
                  className={`filter-btn ${
                    repairFilter ===
                    status
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setRepairFilter(
                      status
                    )
                  }
                >
                  {status}
                </button>
              ))}
            </div>

            <input
              className="search"
              placeholder="Search repair..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          {renderRepairsTable(
            filteredRepairs
          )}
        </section>
      </>
    );
  }

  function renderCustomers() {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Customer Management
            </p>

            <h1>Customers</h1>

            <p className="subtitle">
              Customer repair history
              and balances.
            </p>
          </div>
        </header>

        <section className="customer-grid">
          {customers.map(
            (customer) => (
              <div
                className="customer-card"
                key={
                  customer.key
                }
              >
                <div>
                  <h3>
                    {
                      customer.name
                    }
                  </h3>

                  <p>
                    {customer.phone ||
                      "No phone"}
                  </p>
                </div>

                <div className="customer-stats">
                  <div>
                    <span>
                      Repairs
                    </span>

                    <strong>
                      {
                        customer
                          .repairs
                          .length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Paid
                    </span>

                    <strong>
                      $
                      {money(
                        customer.totalSpent
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Balance
                    </span>

                    <strong>
                      $
                      {money(
                        customer.balance
                      )}
                    </strong>
                  </div>
                </div>

                <div className="customer-repairs">
                  {customer.repairs
                    .slice(0, 5)
                    .map(
                      (repair) => (
                        <button
                          key={
                            repair.id
                          }
                          onClick={() =>
                            openRepair(
                              repair
                            )
                          }
                        >
                          <span>
                            {
                              repair.id
                            }
                          </span>

                          <span>
                            {
                              repair.deviceType
                            }{" "}
                            {
                              repair.model
                            }
                          </span>

                          <span>
                            {
                              repair.status
                            }
                          </span>
                        </button>
                      )
                    )}
                </div>
              </div>
            )
          )}

          {customers.length ===
            0 && (
            <div className="content-card">
              <div
                style={{
                  padding: "30px",
                }}
              >
                No customers yet.
              </div>
            </div>
          )}
        </section>
      </>
    );
  }

  function renderInvoices() {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Billing
            </p>

            <h1>Invoices</h1>

            <p className="subtitle">
              All generated repair
              invoices.
            </p>
          </div>
        </header>

        <section className="content-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Repair</th>
                  <th>Customer</th>
                  <th>Device</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {invoices.map(
                  (repair) => (
                    <tr
                      key={
                        repair.id
                      }
                    >
                      <td className="repair-id">
                        {
                          repair.invoiceNumber
                        }
                      </td>

                      <td>
                        {repair.id}
                      </td>

                      <td>
                        {
                          repair.customer
                        }
                      </td>

                      <td>
                        {
                          repair.deviceType
                        }{" "}
                        {
                          repair.model
                        }
                      </td>

                      <td>
                        $
                        {money(
                          repair.total
                        )}
                      </td>

                      <td>
                        $
                        {money(
                          repair.paid
                        )}
                      </td>

                      <td className="balance">
                        $
                        {money(
                          repair.balance
                        )}
                      </td>

                      <td>
                        {paymentStatus(
                          repair.total,
                          repair.paid
                        )}
                      </td>

                      <td>
                        <button
                          className="table-btn"
                          onClick={() =>
                            openRepair(
                              repair
                            )
                          }
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                )}

                {invoices.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="9"
                      style={{
                        textAlign:
                          "center",
                        padding:
                          "30px",
                      }}
                    >
                      No invoices
                      created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderPayments() {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Payment History
            </p>

            <h1>Payments</h1>

            <p className="subtitle">
              All payments received
              from customers.
            </p>
          </div>

          <div className="payment-total-card">
            <span>
              Total Collected
            </span>

            <strong>
              $
              {money(
                totalCollected
              )}
            </strong>
          </div>
        </header>

        <section className="content-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Repair</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>
                {allPayments.map(
                  (payment) => (
                    <tr
                      key={
                        payment.id
                      }
                    >
                      <td>
                        {
                          payment.date
                        }
                      </td>

                      <td>
                        {
                          payment.customer
                        }
                      </td>

                      <td className="repair-id">
                        {
                          payment.repairId
                        }
                      </td>

                      <td>
                        {
                          payment.method
                        }
                      </td>

                      <td className="balance">
                        +$
                        {money(
                          payment.amount
                        )}
                      </td>

                      <td>
                        {payment.note ||
                          "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Configuration
            </p>

            <h1>Settings</h1>

            <p className="subtitle">
              Business information and
              defaults.
            </p>
          </div>
        </header>

        <section className="settings-card">
          <h2>
            Business Information
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>
                Business Name
              </label>

              <input
                value={
                  businessSettings.businessName
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      businessName:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>
                Subtitle
              </label>

              <input
                value={
                  businessSettings.subtitle
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      subtitle:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Phone</label>

              <input
                value={
                  businessSettings.phone
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      phone:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Email</label>

              <input
                value={
                  businessSettings.email
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      email:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="form-group full-width">
              <label>
                Address
              </label>

              <input
                value={
                  businessSettings.address
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      address:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>
                Default Warranty
              </label>

              <select
                value={
                  businessSettings.defaultWarranty
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      defaultWarranty:
                        event.target
                          .value,
                    })
                  )
                }
              >
                {WARRANTY_OPTIONS.map(
                  (item) => (
                    <option
                      key={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <p className="settings-note">
            Settings are saved
            automatically.
          </p>
        </section>
      </>
    );
  }

  const editTotal =
    Number(
      editForm?.partsCost || 0
    ) +
    Number(
      editForm?.labor || 0
    );

  const editPaid = (
    editForm?.payments || []
  ).reduce(
    (sum, payment) =>
      sum +
      Number(
        payment.amount || 0
      ),
    0
  );

  const editBalance =
    Math.max(
      editTotal - editPaid,
      0
    );

  const formTotal =
    Number(form.partsCost || 0) +
    Number(form.labor || 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            M
          </div>

          <div>
            <h2>
              {
                businessSettings.businessName
              }
            </h2>

            <span>
              Repair Management
            </span>
          </div>
        </div>

        <nav className="nav">
          {[
            "Dashboard",
            "Repairs",
            "Customers",
            "Invoices",
            "Payments",
            "Settings",
          ].map((section) => (
            <button
              key={section}
              className={`nav-item ${
                activeSection ===
                section
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setActiveSection(
                  section
                );

                setSearch("");

                setRepairFilter(
                  "All"
                );
              }}
            >
              {section}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>
            {
              businessSettings.businessName
            }
          </p>

          <span>
            {
              businessSettings.subtitle
            }
          </span>
        </div>
      </aside>

      <main className="main">
        {activeSection ===
          "Dashboard" &&
          renderDashboard()}

        {activeSection ===
          "Repairs" &&
          renderRepairs()}

        {activeSection ===
          "Customers" &&
          renderCustomers()}

        {activeSection ===
          "Invoices" &&
          renderInvoices()}

        {activeSection ===
          "Payments" &&
          renderPayments()}

        {activeSection ===
          "Settings" &&
          renderSettings()}
      </main>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Repair Ticket
                </p>

                <h2>
                  New Repair
                </h2>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowModal(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                createRepair
              }
            >
              {renderRepairFields(
                form,
                handleChange,
                false
              )}

              <div className="totals-box">
                <div>
                  <span>Total</span>

                  <strong>
                    $
                    {money(
                      formTotal
                    )}
                  </strong>
                </div>

                <div>
                  <span>Paid</span>
                  <strong>
                    $0.00
                  </strong>
                </div>

                <div className="balance-total">
                  <span>
                    Balance Due
                  </span>

                  <strong>
                    $
                    {money(
                      formTotal
                    )}
                  </strong>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setShowModal(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                >
                  Create Repair
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal &&
        editForm && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    Repair Ticket
                  </p>

                  <h2>
                    {
                      editForm.id
                    }
                  </h2>

                  <p className="small-text">
                    {
                      editForm.customer
                    }{" "}
                    ·{" "}
                    {
                      editForm.deviceType
                    }{" "}
                    ·{" "}
                    {
                      editForm.model
                    }
                  </p>
                </div>

                <button
                  className="close-btn"
                  onClick={() => {
                    setShowEditModal(
                      false
                    );

                    setEditForm(
                      null
                    );
                  }}
                >
                  ×
                </button>
              </div>

              <div className="ticket-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    generateInvoice
                  }
                >
                  🧾 Invoice
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setShowLabel(
                      true
                    )
                  }
                >
                  🏷️ Print Label
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    duplicateRepair
                  }
                >
                  📋 Duplicate
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    reopenRepair
                  }
                >
                  🔄 Reopen
                </button>
              </div>

              <form
                onSubmit={
                  saveRepairChanges
                }
              >
                <div className="ticket-dates">
                  <div>
                    <span>
                      Check-In
                      Date
                    </span>

                    <strong>
                      {editForm.intakeDate ||
                        "Previous ticket"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Delivery
                      Date
                    </span>

                    <strong>
                      {editForm.deliveryDate ||
                        "Not delivered"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Invoice #
                    </span>

                    <strong>
                      {editForm.invoiceNumber ||
                        "Not created"}
                    </strong>
                  </div>
                </div>

                {renderRepairFields(
                  editForm,
                  handleEditChange,
                  true
                )}

                <div className="totals-box">
                  <div>
                    <span>
                      Total
                    </span>

                    <strong>
                      $
                      {money(
                        editTotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Total Paid
                    </span>

                    <strong>
                      $
                      {money(
                        editPaid
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Payment
                      Status
                    </span>

                    <strong>
                      {paymentStatus(
                        editTotal,
                        editPaid
                      )}
                    </strong>
                  </div>

                  <div className="balance-total">
                    <span>
                      Balance Due
                    </span>

                    <strong>
                      $
                      {money(
                        editBalance
                      )}
                    </strong>
                  </div>
                </div>

                <div className="repair-module">
                  <h3>
                    💳 Payments
                  </h3>

                  <div className="payment-entry">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={
                        paymentForm.amount
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentForm(
                          (
                            current
                          ) => ({
                            ...current,
                            amount:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />

                    <select
                      value={
                        paymentForm.method
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentForm(
                          (
                            current
                          ) => ({
                            ...current,
                            method:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    >
                      {PAYMENT_METHODS.map(
                        (
                          method
                        ) => (
                          <option
                            key={
                              method
                            }
                          >
                            {
                              method
                            }
                          </option>
                        )
                      )}
                    </select>

                    <input
                      placeholder="Payment note"
                      value={
                        paymentForm.note
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentForm(
                          (
                            current
                          ) => ({
                            ...current,
                            note:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />

                    <button
                      type="button"
                      className="primary-btn"
                      onClick={
                        addPayment
                      }
                    >
                      + Add
                      Payment
                    </button>
                  </div>

                  {(editForm.payments ||
                    []).map(
                    (payment) => (
                      <div
                        className="history-row"
                        key={
                          payment.id
                        }
                      >
                        <div>
                          <strong>
                            $
                            {money(
                              payment.amount
                            )}
                          </strong>

                          <span>
                            {
                              payment.method
                            }
                          </span>
                        </div>

                        <div>
                          <span>
                            {
                              payment.date
                            }
                          </span>

                          {payment.note && (
                            <small>
                              {
                                payment.note
                              }
                            </small>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="repair-module">
                  <h3>
                    📦 Parts
                    Ordered
                  </h3>

                  <div className="parts-entry">
                    <input
                      placeholder="Part"
                      value={
                        partForm.name
                      }
                      onChange={(
                        event
                      ) =>
                        setPartForm(
                          (
                            current
                          ) => ({
                            ...current,
                            name:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />

                    <input
                      placeholder="Supplier"
                      value={
                        partForm.supplier
                      }
                      onChange={(
                        event
                      ) =>
                        setPartForm(
                          (
                            current
                          ) => ({
                            ...current,
                            supplier:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />

                    <input
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      value={
                        partForm.cost
                      }
                      onChange={(
                        event
                      ) =>
                        setPartForm(
                          (
                            current
                          ) => ({
                            ...current,
                            cost:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />

                    <input
                      placeholder="Tracking #"
                      value={
                        partForm.tracking
                      }
                      onChange={(
                        event
                      ) =>
                        setPartForm(
                          (
                            current
                          ) => ({
                            ...current,
                            tracking:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />

                    <select
                      value={
                        partForm.status
                      }
                      onChange={(
                        event
                      ) =>
                        setPartForm(
                          (
                            current
                          ) => ({
                            ...current,
                            status:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    >
                      {PART_STATUSES.map(
                        (
                          status
                        ) => (
                          <option
                            key={
                              status
                            }
                          >
                            {
                              status
                            }
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      className="primary-btn"
                      onClick={
                        addPart
                      }
                    >
                      + Add Part
                    </button>
                  </div>

                  {(editForm.orderedParts ||
                    []).map(
                    (part) => (
                      <div
                        className="part-row"
                        key={
                          part.id
                        }
                      >
                        <div>
                          <strong>
                            {
                              part.name
                            }
                          </strong>

                          <span>
                            {part.supplier ||
                              "No supplier"}
                          </span>
                        </div>

                        <div>
                          <span>
                            Cost: $
                            {money(
                              part.cost
                            )}
                          </span>

                          <span>
                            Tracking:{" "}
                            {part.tracking ||
                              "N/A"}
                          </span>
                        </div>

                        <select
                          value={
                            part.status
                          }
                          onChange={(
                            event
                          ) =>
                            changePartStatus(
                              part.id,
                              event
                                .target
                                .value
                            )
                          }
                        >
                          {PART_STATUSES.map(
                            (
                              status
                            ) => (
                              <option
                                key={
                                  status
                                }
                              >
                                {
                                  status
                                }
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )
                  )}
                </div>

                <div className="repair-module">
                  <h3>
                    👤 Customer
                    History
                  </h3>

                  {customerHistory.length ===
                    0 && (
                    <p className="small-text">
                      No previous
                      repairs found.
                    </p>
                  )}

                  {customerHistory.map(
                    (repair) => (
                      <div
                        className="history-row"
                        key={
                          repair.id
                        }
                      >
                        <div>
                          <strong>
                            {
                              repair.id
                            }
                          </strong>

                          <span>
                            {
                              repair.deviceType
                            }{" "}
                            {
                              repair.model
                            }
                          </span>
                        </div>

                        <div>
                          <span>
                            {
                              repair.status
                            }
                          </span>

                          <strong>
                            $
                            {money(
                              repair.total
                            )}
                          </strong>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="repair-module">
                  <h3>
                    🕒 Repair
                    Timeline
                  </h3>

                  {(editForm.timeline ||
                    []).map(
                    (entry) => (
                      <div
                        className="timeline-row"
                        key={
                          entry.id
                        }
                      >
                        <div className="timeline-dot" />

                        <div>
                          <strong>
                            {
                              entry.text
                            }
                          </strong>

                          <span>
                            {
                              entry.date
                            }
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setShowEditModal(
                        false
                      );

                      setEditForm(
                        null
                      );
                    }}
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    className="primary-btn"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {showInvoice &&
        editForm && (
          <div className="modal-overlay">
            <div className="invoice-modal">
              <div className="invoice-sheet">
                <div className="invoice-header">
                  <div>
                    <h1>
                      {
                        businessSettings.businessName
                      }
                    </h1>

                    <p>
                      {
                        businessSettings.subtitle
                      }
                    </p>
                  </div>

                  <div>
                    <h2>
                      INVOICE
                    </h2>

                    <strong>
                      {
                        editForm.invoiceNumber
                      }
                    </strong>
                  </div>
                </div>

                <hr />

                <p>
                  <strong>
                    Customer:
                  </strong>{" "}
                  {
                    editForm.customer
                  }
                </p>

                <p>
                  <strong>
                    Phone:
                  </strong>{" "}
                  {
                    editForm.phone
                  }
                </p>

                <p>
                  <strong>
                    Repair:
                  </strong>{" "}
                  {editForm.id}
                </p>

                <p>
                  <strong>
                    Device:
                  </strong>{" "}
                  {
                    editForm.brand
                  }{" "}
                  {
                    editForm.model
                  }
                </p>

                <p>
                  <strong>
                    Issue:
                  </strong>{" "}
                  {
                    editForm.issue
                  }
                </p>

                <div className="invoice-totals">
                  <p>
                    Parts: $
                    {money(
                      editForm.partsCost
                    )}
                  </p>

                  <p>
                    Labor: $
                    {money(
                      editForm.labor
                    )}
                  </p>

                  <p>
                    <strong>
                      Total: $
                      {money(
                        editTotal
                      )}
                    </strong>
                  </p>

                  <p>
                    Paid: $
                    {money(
                      editPaid
                    )}
                  </p>

                  <p>
                    <strong>
                      Balance Due:
                      $
                      {money(
                        editBalance
                      )}
                    </strong>
                  </p>
                </div>

                <p>
                  <strong>
                    Warranty:
                  </strong>{" "}
                  {
                    editForm.warranty
                  }
                </p>

                {editForm.customerNotes && (
                  <p>
                    <strong>
                      Notes:
                    </strong>{" "}
                    {
                      editForm.customerNotes
                    }
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setShowInvoice(
                      false
                    )
                  }
                >
                  Close
                </button>

                <button
                  className="primary-btn"
                  onClick={() =>
                    window.print()
                  }
                >
                  🖨️ Print
                  Invoice
                </button>
              </div>
            </div>
          </div>
        )}

      {showLabel &&
        editForm && (
          <div className="modal-overlay">
            <div className="label-modal">
              <div className="device-label">
                <div className="label-brand">
                  <strong>
                    {
                      businessSettings.businessName
                    }
                  </strong>

                  <span>
                    {
                      businessSettings.subtitle
                    }
                  </span>
                </div>

                <div className="label-id">
                  {editForm.id}
                </div>

                <p>
                  <strong>
                    Customer:
                  </strong>{" "}
                  {
                    editForm.customer
                  }
                </p>

                <p>
                  <strong>
                    Phone:
                  </strong>{" "}
                  {
                    editForm.phone
                  }
                </p>

                <p>
                  <strong>
                    Device:
                  </strong>{" "}
                  {
                    editForm.brand
                  }{" "}
                  {
                    editForm.model
                  }
                </p>

                <p>
                  <strong>
                    Issue:
                  </strong>{" "}
                  {
                    editForm.issue
                  }
                </p>

                <small>
                  Keep this label
                  with the device
                </small>
              </div>

              <div className="modal-actions">
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setShowLabel(
                      false
                    )
                  }
                >
                  Close
                </button>

                <button
                  className="primary-btn"
                  onClick={() =>
                    window.print()
                  }
                >
                  🖨️ Print
                  Label
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default App;