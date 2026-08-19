import microsoldertechLogo from "./assets/microsoldertech-logo.png";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./supabase";
import {
  loadRepairsFromSupabase,
  saveRepairToSupabase,
  deleteRepairFromSupabase,
  getNextRepairNumberFromSupabase,
  getNextInvoiceNumberFromSupabase,
  loadCustomersFromSupabase,
  updateCustomerProfileInSupabase,
  loadBusinessSettingsFromSupabase,
  saveBusinessSettingsToSupabase,
  loadInventoryFromSupabase,
  saveInventoryItemToSupabase,
  deleteInventoryItemFromSupabase,
  loadSalesFromSupabase,
  createSaleInSupabase,
  getOpenCashSessionFromSupabase,
  openCashSessionInSupabase,
  addCashMovementToSupabase,
  closeCashSessionInSupabase,
} from "./supabaseData";
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
const [search, setSearch] =
    useState("");

  const [globalSearch, setGlobalSearch] =
    useState("");

  const [repairFilter, setRepairFilter] =
    useState("All");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [selectedCustomerKey, setSelectedCustomerKey] =
    useState(null);

  const [customerProfiles, setCustomerProfiles] =
    useState([]);

  const [editingCustomer, setEditingCustomer] =
    useState(false);

  const [customerEdit, setCustomerEdit] =
    useState({
      id: "",
      name: "",
      phone: "",
      email: "",
    });

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

  const [inventoryPartForm, setInventoryPartForm] =
    useState({
      inventoryId: "",
      quantity: 1,
    });

  const [inventory, setInventory] =
    useState([]);

  const [inventoryLoading, setInventoryLoading] =
    useState(true);

  const [inventorySearch, setInventorySearch] =
    useState("");

  const [showPosModal, setShowPosModal] =
    useState(false);

  const [posCart, setPosCart] =
    useState([]);

  const [sales, setSales] =
    useState([]);

  const [salesLoading, setSalesLoading] =
    useState(true);

  const [selectedSale, setSelectedSale] =
    useState(null);

  const [posProductId, setPosProductId] =
    useState("");

  const [posQuantity, setPosQuantity] =
    useState(1);

  const [posCustomer, setPosCustomer] =
    useState("");

  const [posPaymentMethod, setPosPaymentMethod] =
    useState("Cash");

  const [posTaxMode, setPosTaxMode] =
    useState("With Tax");

  const [posTaxExemptReason, setPosTaxExemptReason] =
    useState("");

  const [cashSession, setCashSession] =
    useState(null);

  const [cashLoading, setCashLoading] =
    useState(true);

  const [dailyCashMovements, setDailyCashMovements] =
    useState([]);

  const [reportPeriod, setReportPeriod] =
    useState("Today");

  const [reportStartDate, setReportStartDate] =
    useState("");

  const [reportEndDate, setReportEndDate] =
    useState("");

  const [showOpenCashModal, setShowOpenCashModal] =
    useState(false);

  const [openingCash, setOpeningCash] =
    useState("");

  const [showCloseCashModal, setShowCloseCashModal] =
    useState(false);

  const [countedCash, setCountedCash] =
    useState("");

  const [closeCashNotes, setCloseCashNotes] =
    useState("");

  const [cashMovementType, setCashMovementType] =
    useState("Cash Out");

  const [cashMovementAmount, setCashMovementAmount] =
    useState("");

  const [cashMovementDescription, setCashMovementDescription] =
    useState("");

  const [closeCashSummary, setCloseCashSummary] =
    useState(null);

  const [closeCashPreview, setCloseCashPreview] =
    useState(null);

  const [showInventoryModal, setShowInventoryModal] =
    useState(false);

  const [editingInventoryId, setEditingInventoryId] =
    useState(null);

  const [inventoryForm, setInventoryForm] =
    useState({
      sku: "",
      name: "",
      category: "",
      brandModel: "",
      quantity: "",
      minStock: "",
      cost: "",
      salePrice: "",
      supplier: "",
      location: "",
      active: true,
    });

  const [cloudReady, setCloudReady] =
    useState(false);

  const [currentProfile, setCurrentProfile] =
    useState(null);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const currentRole =
    currentProfile?.role || "";

  const isOwner =
    currentRole === "owner";

  const isTechnician =
    currentRole === "technician";

  const isFrontDesk =
    currentRole === "front_desk";

  const canCreateRepair =
    isOwner || isFrontDesk;

  const canManagePayments =
    isOwner || isFrontDesk;

  const canManageParts =
    isOwner || isTechnician;

  const canAccessPayments =
    isOwner || isFrontDesk;

  const canAccessSettings =
    isOwner;

  const canEditInternalNotes =
    isOwner || isTechnician;

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentProfile() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          if (!cancelled) {
            setCurrentProfile(null);
            setProfileLoading(false);
          }

          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "email, full_name, role, active"
          )
          .eq("id", session.user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (!cancelled) {
          setCurrentProfile(profile);
        }
      } catch (error) {
        console.error(
          "Profile load failed:",
          error
        );

        if (!cancelled) {
          setCurrentProfile(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    loadCurrentProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        setProfileLoading(true);
        loadCurrentProfile();
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCloudData() {
      try {
        const [
          cloudRepairs,
          cloudSettings,
          cloudCustomers,
          cloudInventory,
          cloudSales,
        ] = await Promise.all([
          loadRepairsFromSupabase(),
          loadBusinessSettingsFromSupabase(),
          loadCustomersFromSupabase(),
          loadInventoryFromSupabase(),
          loadSalesFromSupabase(),
        ]);

        if (cancelled) return;

        setRepairs(
          (cloudRepairs || []).map(normalizeRepair)
        );

        if (cloudSettings) {
          setBusinessSettings(
            cloudSettings
          );
        }

        setCustomerProfiles(
          cloudCustomers || []
        );

        setInventory(
          cloudInventory || []
        );

        setInventoryLoading(false);

        setSales(
          cloudSales || []
        );

        setSalesLoading(false);

        const openCash =
          await getOpenCashSessionFromSupabase();

        setCashSession(
          openCash || null
        );

        setCashLoading(false);

        setCloudReady(true);
        console.log(
          `Supabase loaded ${cloudRepairs.length} repair(s).`
        );
      } catch (error) {
        console.error(
          "Supabase load failed. Using local backup:",
          error
        );
        setInventoryLoading(false);
        setSalesLoading(false);
        setCashLoading(false);
        setCloudReady(false);
      }
    }

    loadCloudData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (profileLoading) return;

    if (
      activeSection === "Payments" &&
      !canAccessPayments
    ) {
      setActiveSection("Dashboard");
    }

    if (
      activeSection === "Settings" &&
      !canAccessSettings
    ) {
      setActiveSection("Dashboard");
    }
  }, [
    activeSection,
    profileLoading,
    canAccessPayments,
    canAccessSettings,
  ]);

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

    if (!cloudReady) return;

    const timer = setTimeout(() => {
      saveBusinessSettingsToSupabase(
        businessSettings
      ).catch((error) => {
        console.error(
          "Settings cloud sync failed:",
          error
        );
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [businessSettings, cloudReady]);
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

  async function getNextRepairId() {
    const nextNumber =
      await getNextRepairNumberFromSupabase();

    return `MT-${String(nextNumber).padStart(
      6,
      "0"
    )}`;
  }

  async function getNextInvoiceNumber() {
    const nextNumber =
      await getNextInvoiceNumberFromSupabase();

    return `INV-${String(nextNumber).padStart(
      6,
      "0"
    )}`;
  }

  async function createRepair(event) {
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

    let repairId;

    try {
      repairId =
        await getNextRepairId();
    } catch (error) {
      console.error(
        "Repair number generation failed:",
        error
      );
      alert(
        "Could not generate a Repair # from Supabase. The ticket was not created."
      );
      return;
    }

    const newRepair = {
      ...form,
      id: repairId,
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

    try {
      await saveRepairToSupabase(
        newRepair
      );
    } catch (error) {
      console.error(
        "New repair cloud sync failed:",
        error
      );
      alert(
        "Repair saved locally, but Supabase sync failed. Your ticket is still safe on this device."
      );
    }

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

    const currentTotal =
      Number(editForm.partsCost || 0) +
      Number(editForm.labor || 0);

    const currentPaid = (
      editForm.payments || []
    ).reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0
    );

    const currentBalance = Math.max(
      currentTotal - currentPaid,
      0
    );

    if (amount > currentBalance) {
      alert(
        `Payment cannot exceed the current balance of $${currentBalance.toFixed(2)}.`
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

  async function addPartFromInventory() {
    if (!editForm) return;

    const item = inventory.find(
      (inventoryItem) =>
        inventoryItem.id ===
        inventoryPartForm.inventoryId
    );

    if (!item) {
      alert("Select an inventory item.");
      return;
    }

    const quantity =
      Math.max(
        1,
        Number(inventoryPartForm.quantity) || 1
      );

    if (quantity > Number(item.quantity)) {
      alert(
        `Not enough stock. Available: ${item.quantity}`
      );
      return;
    }

    const updatedItem = {
      ...item,
      quantity:
        Number(item.quantity) - quantity,
    };

    try {
      await saveInventoryItemToSupabase(
        updatedItem
      );
    } catch (error) {
      console.error(
        "Inventory stock update failed:",
        error
      );

      alert(
        "Could not update inventory stock."
      );
      return;
    }

    const date = nowString();

    const newPart = {
      id: `PART-${Date.now()}`,
      inventoryId: item.id,
      sku: item.sku || "",
      name: item.name,
      supplier: item.supplier || "",
      cost:
        Number(item.cost || 0) * quantity,
      quantity,
      tracking: "",
      status: "Received",
      date,
    };

    setInventory((current) =>
      current.map((inventoryItem) =>
        inventoryItem.id === item.id
          ? updatedItem
          : inventoryItem
      )
    );

    setEditForm((current) => ({
      ...current,
      orderedParts: [
        ...(current.orderedParts || []),
        newPart,
      ],
      timeline: [
        ...(current.timeline || []),
        {
          id: `TIME-${Date.now()}-inventory-part`,
          date,
          text: `Inventory used: ${quantity} x ${item.name}${item.sku ? ` (${item.sku})` : ""}`,
        },
      ],
    }));

    setInventoryPartForm({
      inventoryId: "",
      quantity: 1,
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

  async function saveRepairChanges(
    event
  ) {
    event.preventDefault();

    if (!editForm) return;

    if (
      !editForm.customer ||
      !editForm.model ||
      !editForm.issue
    ) {
      alert(
        "Please complete Customer, Model and Issue."
      );
      return;
    }

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

    if (
      original &&
      original.approval !==
        editForm.approval
    ) {
      timeline.push({
        id: `TIME-${Date.now()}-approval`,
        date: nowString(),
        text: `Customer approval changed from ${original.approval} to ${editForm.approval}`,
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

    try {
      await saveRepairToSupabase(
        updated
      );

    } catch (error) {
      console.error(
        "Repair cloud sync failed:",
        error
      );
      alert(
        "Changes were saved locally, but Supabase sync failed. Your local copy is still safe."
      );
    }
  }

  async function generateInvoice() {
    if (!editForm) return;

    let updated = {
      ...editForm,
    };

    if (!updated.invoiceNumber) {
      try {
        updated.invoiceNumber =
          await getNextInvoiceNumber();
      } catch (error) {
        console.error(
          "Invoice number generation failed:",
          error
        );

        alert(
          "Could not generate an Invoice # from Supabase. The invoice was not created."
        );

        return;
      }

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

    try {
      await saveRepairToSupabase(
        updated
      );
    } catch (error) {
      console.error(
        "Invoice cloud sync failed:",
        error
      );
    }

    setShowInvoice(true);
  }

  async function duplicateRepair() {
    if (!editForm) return;

    const intakeDate =
      nowString();

    let repairId;

    try {
      repairId =
        await getNextRepairId();
    } catch (error) {
      console.error(
        "Duplicate repair number generation failed:",
        error
      );
      alert(
        "Could not generate a Repair # from Supabase. The duplicate was not created."
      );
      return;
    }

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
      id: repairId,
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

    try {
      await saveRepairToSupabase(
        duplicate
      );
    } catch (error) {
      console.error(
        "Duplicate repair cloud sync failed:",
        error
      );
      alert(
        "Duplicate ticket was created locally, but Supabase sync failed."
      );
    }

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

  async function deleteRepair() {
    if (!editForm || !isOwner) return;

    const confirmed = window.confirm(
      `Delete ${editForm.id} permanently? This will remove the repair, payments, parts and timeline. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteRepairFromSupabase(
        editForm.id
      );

      setRepairs((current) =>
        current.filter(
          (repair) =>
            repair.id !== editForm.id
        )
      );

      setShowInvoice(false);
      setShowEditModal(false);
      setEditForm(null);

      alert(
        "Repair deleted successfully."
      );
    } catch (error) {
      console.error(
        "Delete repair failed:",
        error
      );

      alert(
        "Delete failed. The repair was not removed."
      );
    }
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

  useEffect(() => {
    let cancelled = false;

    async function loadDailyCashMovements() {
      try {
        const now = new Date();

        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        const end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        );

        const { data, error } = await supabase
          .from("cash_movements")
          .select("*")
          .gte(
            "created_at",
            start.toISOString()
          )
          .lt(
            "created_at",
            end.toISOString()
          )
          .order("created_at", {
            ascending: true,
          });

        if (error) throw error;

        if (!cancelled) {
          setDailyCashMovements(
            data || []
          );
        }
      } catch (error) {
        console.error(
          "Daily cash movements load failed:",
          error
        );

        if (!cancelled) {
          setDailyCashMovements([]);
        }
      }
    }

    loadDailyCashMovements();

    return () => {
      cancelled = true;
    };
  }, []);

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
      const map = new Map();

      repairs.forEach((repair) => {
        const profile =
          customerProfiles.find(
            (item) =>
              String(item.id) ===
              String(
                repair.customerId
              )
          );

        const key =
          repair.customerId ||
          repair.phone?.trim() ||
          repair.customer?.trim();

        if (!key) return;

        if (!map.has(key)) {
          map.set(key, {
            key,
            profileId:
              repair.customerId ||
              profile?.id ||
              "",
            name:
              profile?.name ||
              repair.customer,
            phone:
              profile?.phone ||
              repair.phone ||
              "",
            email:
              profile?.email || "",
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
      });

      customerProfiles.forEach(
        (profile) => {
          if (map.has(profile.id)) {
            return;
          }

          map.set(profile.id, {
            key: profile.id,
            profileId: profile.id,
            name:
              profile.name ||
              "Unknown Customer",
            phone:
              profile.phone || "",
            email:
              profile.email || "",
            repairs: [],
            totalSpent: 0,
            balance: 0,
          });
        }
      );

      return Array.from(
        map.values()
      );
    }, [
      repairs,
      customerProfiles,
    ]);

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

        {canEditInternalNotes && (
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
        )}

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

          {canCreateRepair && (
            <button
              className="primary-btn"
              onClick={() =>
                setShowModal(true)
              }
            >
              + New Repair
            </button>
          )}
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

          {canAccessPayments && (
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
          )}

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

          {canAccessPayments && (
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
          )}
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

          {canAccessPayments && (
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
          )}
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

          {canCreateRepair && (
            <button
              className="primary-btn"
              onClick={() =>
                setShowModal(true)
              }
            >
              + New Repair
            </button>
          )}
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

  function startEditCustomer(customer) {
    setCustomerEdit({
      id:
        customer.profileId ||
        "",
      name:
        customer.name || "",
      phone:
        customer.phone || "",
      email:
        customer.email || "",
    });

    setEditingCustomer(true);
  }

  async function saveCustomerProfile(event) {
    event.preventDefault();

    if (!customerEdit.id) {
      alert(
        "Customer profile ID not found."
      );
      return;
    }

    if (!customerEdit.name.trim()) {
      alert(
        "Customer name is required."
      );
      return;
    }

    try {
      const updated =
        await updateCustomerProfileInSupabase(
          customerEdit
        );

      setCustomerProfiles(
        (current) =>
          current.map((customer) =>
            String(customer.id) ===
            String(updated.id)
              ? {
                  ...customer,
                  ...updated,
                }
              : customer
          )
      );

      setRepairs((current) =>
        current.map((repair) =>
          String(repair.customerId) ===
          String(updated.id)
            ? {
                ...repair,
                customer:
                  updated.name,
                phone:
                  updated.phone,
              }
            : repair
        )
      );

      setEditingCustomer(false);

      alert(
        "Customer updated successfully."
      );
    } catch (error) {
      console.error(
        "Customer update failed:",
        error
      );

      alert(
        "Customer update failed. No changes were saved."
      );
    }
  }

  function renderCustomers() {
    const searchText =
      customerSearch
        .trim()
        .toLowerCase();

    const filteredCustomers =
      customers.filter(
        (customer) => {
          if (!searchText) {
            return true;
          }

          const customerText = `
            ${customer.name}
            ${customer.phone}
            ${customer.email}
            ${customer.repairs
              .map(
                (repair) => `
                  ${repair.id}
                  ${repair.deviceType}
                  ${repair.brand}
                  ${repair.model}
                  ${repair.serial}
                `
              )
              .join(" ")}
          `.toLowerCase();

          return customerText.includes(
            searchText
          );
        }
      );

    const selectedCustomer =
      customers.find(
        (customer) =>
          String(customer.key) ===
          String(
            selectedCustomerKey
          )
      ) || null;

    if (selectedCustomer) {
      const devices =
        selectedCustomer.repairs.reduce(
          (list, repair) => {
            const key = `
              ${repair.deviceType}
              ${repair.brand}
              ${repair.model}
              ${repair.serial}
            `
              .trim()
              .toLowerCase();

            if (
              !list.some(
                (item) =>
                  item.key === key
              )
            ) {
              list.push({
                key,
                deviceType:
                  repair.deviceType,
                brand:
                  repair.brand,
                model:
                  repair.model,
                serial:
                  repair.serial,
              });
            }

            return list;
          },
          []
        );

      return (
        <>
          <header className="topbar">
            <div>
              <p className="eyebrow">
                Customer Profile
              </p>

              <h1>
                {selectedCustomer.name}
              </h1>

              <p className="subtitle">
                {selectedCustomer.phone ||
                  "No phone number"}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              {(isOwner ||
                isFrontDesk) && (
                <button
                  className="primary-btn"
                  onClick={() =>
                    startEditCustomer(
                      selectedCustomer
                    )
                  }
                >
                  ✏️ Edit Customer
                </button>
              )}

              <button
                className="secondary-btn"
                onClick={() => {
                  setEditingCustomer(
                    false
                  );

                  setSelectedCustomerKey(
                    null
                  );
                }}
              >
                ← Back to Customers
              </button>
            </div>
          </header>

          {editingCustomer && (
            <section className="content-card">
              <div className="content-header">
                <div>
                  <h2>
                    Edit Customer
                  </h2>

                  <p>
                    Update customer
                    contact information.
                  </p>
                </div>
              </div>

              <form
                onSubmit={
                  saveCustomerProfile
                }
                style={{
                  padding: "20px",
                }}
              >
                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      Name *
                    </label>

                    <input
                      value={
                        customerEdit.name
                      }
                      onChange={(event) =>
                        setCustomerEdit(
                          (current) => ({
                            ...current,
                            name:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Phone
                    </label>

                    <input
                      value={
                        customerEdit.phone
                      }
                      onChange={(event) =>
                        setCustomerEdit(
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
                    <label>
                      Email
                    </label>

                    <input
                      type="email"
                      value={
                        customerEdit.email
                      }
                      onChange={(event) =>
                        setCustomerEdit(
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
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="submit"
                    className="primary-btn"
                  >
                    Save Customer
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      setEditingCustomer(
                        false
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="dashboard-metrics">
            <div className="metric-card">
              <span className="metric-icon">
                🧾
              </span>

              <div>
                <span>Repairs</span>

                <strong>
                  {
                    selectedCustomer
                      .repairs.length
                  }
                </strong>
              </div>
            </div>

            <div className="metric-card">
              <span className="metric-icon">
                📱
              </span>

              <div>
                <span>Devices</span>

                <strong>
                  {devices.length}
                </strong>
              </div>
            </div>

            <div className="metric-card">
              <span className="metric-icon">
                💰
              </span>

              <div>
                <span>
                  Total Paid
                </span>

                <strong>
                  $
                  {money(
                    selectedCustomer
                      .totalSpent
                  )}
                </strong>
              </div>
            </div>

            <div className="metric-card">
              <span className="metric-icon">
                💳
              </span>

              <div>
                <span>
                  Balance
                </span>

                <strong>
                  $
                  {money(
                    selectedCustomer
                      .balance
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="content-card">
            <div className="content-header">
              <div>
                <h2>
                  Customer Information
                </h2>
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <div className="small-text">
                  Customer
                </div>

                <strong>
                  {selectedCustomer.name}
                </strong>
              </div>

              <div>
                <div className="small-text">
                  Phone
                </div>

                <strong>
                  {selectedCustomer.phone ||
                    "Not provided"}
                </strong>
              </div>

              <div>
                <div className="small-text">
                  Email
                </div>

                <strong>
                  {selectedCustomer.email ||
                    "Not provided"}
                </strong>
              </div>
            </div>
          </section>

          <section
            className="content-card"
            style={{
              marginTop: "20px",
            }}
          >
            <div className="content-header">
              <div>
                <h2>Devices</h2>

                <p>
                  Devices associated with
                  this customer.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              {devices.map(
                (device) => (
                  <div
                    key={device.key}
                    className="customer-card"
                  >
                    <strong>
                      {device.deviceType}{" "}
                      {device.model}
                    </strong>

                    <p>
                      {device.brand ||
                        "No brand"}
                    </p>

                    <div className="small-text">
                      Serial / IMEI:{" "}
                      {device.serial ||
                        "Not recorded"}
                    </div>
                  </div>
                )
              )}

              {devices.length === 0 && (
                <div>
                  No devices recorded.
                </div>
              )}
            </div>
          </section>

          <section
            className="content-card"
            style={{
              marginTop: "20px",
            }}
          >
            <div className="content-header">
              <div>
                <h2>
                  Repair History
                </h2>

                <p>
                  Complete repair history
                  for this customer.
                </p>
              </div>
            </div>

            {renderRepairsTable(
              selectedCustomer.repairs
            )}
          </section>
        </>
      );
    }

    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Customer Management
            </p>

            <h1>Customers</h1>

            <p className="subtitle">
              Customer profiles, devices,
              repair history and balances.
            </p>
          </div>
        </header>

        <section className="content-card">
          <div className="content-header">
            <div>
              <h2>
                Customer Directory
              </h2>

              <p>
                {filteredCustomers.length}{" "}
                customer
                {filteredCustomers.length ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>

            <input
              className="search"
              placeholder="Search customer, phone, email, device, serial / IMEI..."
              value={customerSearch}
              onChange={(event) =>
                setCustomerSearch(
                  event.target.value
                )
              }
            />
          </div>
        </section>

        <section className="customer-grid">
          {filteredCustomers.map(
            (customer) => (
              <div
                className="customer-card"
                key={customer.key}
              >
                <div>
                  <h3>
                    {customer.name}
                  </h3>

                  <p>
                    {customer.phone ||
                      "No phone"}
                  </p>

                  {customer.email && (
                    <div className="small-text">
                      {customer.email}
                    </div>
                  )}
                </div>

                <div className="customer-stats">
                  <div>
                    <span>
                      Repairs
                    </span>

                    <strong>
                      {
                        customer
                          .repairs.length
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

                <button
                  className="primary-btn"
                  style={{
                    width: "100%",
                    marginTop: "14px",
                  }}
                  onClick={() =>
                    setSelectedCustomerKey(
                      customer.key
                    )
                  }
                >
                  Open Customer
                </button>
              </div>
            )
          )}

          {filteredCustomers.length ===
            0 && (
            <div className="content-card">
              <div
                style={{
                  padding: "30px",
                }}
              >
                No customers found.
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
                        event.target.value,
                    })
                  )
                }
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
              <label>
                Default Sales Tax %
              </label>

              <input
                type="number"
                min="0"
                step="0.001"
                value={
                  businessSettings.taxRate ?? 0
                }
                onChange={(event) =>
                  setBusinessSettings(
                    (current) => ({
                      ...current,
                      taxRate:
                        event.target.value,
                    })
                  )
                }
              />
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

  const getReportRange = () => {
    const now = new Date();

    const startOfDay = (date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

    const endOfDay = (date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
      );

    if (reportPeriod === "Yesterday") {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);

      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    }

    if (reportPeriod === "This Week") {
      const start = startOfDay(now);
      const day = start.getDay();
      const mondayOffset =
        day === 0 ? -6 : 1 - day;

      start.setDate(
        start.getDate() + mondayOffset
      );

      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      return { start, end };
    }

    if (reportPeriod === "Last Week") {
      const end = startOfDay(now);
      const day = end.getDay();
      const mondayOffset =
        day === 0 ? -6 : 1 - day;

      end.setDate(
        end.getDate() + mondayOffset
      );

      const start = new Date(end);
      start.setDate(start.getDate() - 7);

      return { start, end };
    }

    if (reportPeriod === "This Month") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );

      return { start, end };
    }

    if (reportPeriod === "Last Month") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      return { start, end };
    }

    if (reportPeriod === "First Half") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        16
      );

      return { start, end };
    }

    if (reportPeriod === "Second Half") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        16
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );

      return { start, end };
    }

    if (
      reportPeriod === "Custom Range" &&
      reportStartDate &&
      reportEndDate
    ) {
      const start = new Date(
        `${reportStartDate}T00:00:00`
      );

      const end = new Date(
        `${reportEndDate}T00:00:00`
      );

      end.setDate(
        end.getDate() + 1
      );

      return { start, end };
    }

    return {
      start: startOfDay(now),
      end: endOfDay(now),
    };
  };

  const reportRange =
    getReportRange();

  const isInReportPeriod = (value) => {
    if (!value) return false;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return (
      date >= reportRange.start &&
      date < reportRange.end
    );
  };

  const reportPaymentsToday =
    allPayments.filter((payment) =>
      isInReportPeriod(payment.date)
    );

  const reportSalesToday =
    sales.filter((sale) =>
      isInReportPeriod(
        sale.createdAt ||
          sale.date
      )
    );

  const reportRepairPayments =
    reportPaymentsToday.reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0
    );

  const reportPosSales =
    reportSalesToday.reduce(
      (sum, sale) =>
        sum +
        Number(sale.total || 0),
      0
    );

  const reportCash =
    reportPaymentsToday
      .filter(
        (payment) =>
          String(
            payment.method || ""
          ).toLowerCase() ===
          "cash"
      )
      .reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0
      ) +
    reportSalesToday
      .filter(
        (sale) =>
          String(
            sale.paymentMethod || ""
          ).toLowerCase() ===
          "cash"
      )
      .reduce(
        (sum, sale) =>
          sum +
          Number(sale.total || 0),
        0
      );

  const reportZelle =
    reportPaymentsToday
      .filter(
        (payment) =>
          String(
            payment.method || ""
          ).toLowerCase() ===
          "zelle"
      )
      .reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0
      ) +
    reportSalesToday
      .filter(
        (sale) =>
          String(
            sale.paymentMethod || ""
          ).toLowerCase() ===
          "zelle"
      )
      .reduce(
        (sum, sale) =>
          sum +
          Number(sale.total || 0),
        0
      );

  const reportCard =
    reportPaymentsToday
      .filter(
        (payment) =>
          String(
            payment.method || ""
          ).toLowerCase() ===
          "card"
      )
      .reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0
      ) +
    reportSalesToday
      .filter(
        (sale) =>
          String(
            sale.paymentMethod || ""
          ).toLowerCase() ===
          "card"
      )
      .reduce(
        (sum, sale) =>
          sum +
          Number(sale.total || 0),
        0
      );

  const reportCashIn =
    dailyCashMovements
      .filter((movement) =>
        isInReportPeriod(
          movement.created_at
        )
      )
      .filter(
        (movement) =>
          String(
            movement.type || ""
          ).toLowerCase() ===
          "cash in"
      )
      .reduce(
        (sum, movement) =>
          sum +
          Number(movement.amount || 0),
        0
      );

  const reportCashOut =
    dailyCashMovements
      .filter((movement) =>
        isInReportPeriod(
          movement.created_at
        )
      )
      .filter(
        (movement) =>
          String(
            movement.type || ""
          ).toLowerCase() ===
          "cash out"
      )
      .reduce(
        (sum, movement) =>
          sum +
          Number(movement.amount || 0),
        0
      );

  const reportTotalCollected =
    reportRepairPayments +
    reportPosSales;

  const reportNetCash =
    reportCash +
    reportCashIn -
    reportCashOut;

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
            "Inventory",
            "POS",
            ...(canAccessPayments
              ? [
                  "Payments",
                  "Cash",
                  "Financial Report",
                ]
              : []),
            ...(canAccessSettings
              ? ["Settings"]
              : []),
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

        <div
          style={{
            margin: "12px 0",
            padding: "12px",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: "11px",
              opacity: 0.65,
              marginBottom: "5px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Signed in as
          </span>

          <strong
            style={{
              display: "block",
              fontSize: "13px",
              marginBottom: "4px",
              wordBreak: "break-word",
            }}
          >
            {profileLoading
              ? "Loading profile..."
              : currentProfile?.full_name ||
                currentProfile?.email ||
                "User"}
          </strong>

          <span
            style={{
              display: "block",
              fontSize: "12px",
              opacity: 0.8,
            }}
          >
            {profileLoading
              ? "Checking role..."
              : currentProfile?.role ===
                  "owner"
                ? "Owner"
                : currentProfile?.role ===
                    "technician"
                  ? "Technician"
                  : currentProfile?.role ===
                      "front_desk"
                    ? "Front Desk"
                    : "Role unavailable"}
          </span>
        </div>

        <button
          className="nav-item"
          onClick={async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
              console.error("Sign out failed:", error);
              alert("Unable to sign out. Please try again.");
            }
          }}
        >
          Sign Out
        </button>

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
          "POS" && (
          <section>
            <div className="page-header">
              <div>
                <p className="eyebrow">
                  Point of Sale
                </p>

                <h1>POS</h1>

                <p>
                  Create sales using products from Inventory.
                </p>
              </div>

              <button
                className="primary-btn"
                onClick={() => {
                  setPosCart([]);
                  setPosProductId("");
                  setPosQuantity(1);
                  setShowPosModal(true);
                }}
              >
                + New Sale
              </button>
            </div>

            <div className="card">
              <h3>Sales History</h3>

              {salesLoading ? (
                <p>Loading sales...</p>
              ) : sales.length === 0 ? (
                <p>No sales recorded yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Sale</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Payment</th>
                        <th>Items</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sales.map((sale) => (
                        <tr
                          key={sale.id}
                          onClick={() =>
                            setSelectedSale(sale)
                          }
                          style={{
                            cursor: "pointer",
                          }}
                        >
                          <td>
                            <strong>
                              {sale.saleNumber}
                            </strong>
                          </td>

                          <td>
                            {sale.date}
                          </td>

                          <td>
                            {sale.customerName ||
                              "Walk-in"}
                          </td>

                          <td>
                            {sale.paymentMethod}
                          </td>

                          <td>
                            {(sale.items || []).reduce(
                              (sum, item) =>
                                sum +
                                Number(
                                  item.quantity || 0
                                ),
                              0
                            )}
                          </td>

                          <td>
                            <strong>
                              ${money(sale.total)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection ===
          "Inventory" && (
          <section>
            <div className="page-header">
              <div>
                <p className="eyebrow">
                  Stock Management
                </p>
                <h1>Inventory</h1>
                <p>
                  Manage parts, products, stock levels and pricing.
                </p>
              </div>

              <button
                className="primary-btn"
                onClick={() =>
                  setShowInventoryModal(true)
                }
              >
                + Add Item
              </button>
            </div>

            <div className="card">
              <div
                style={{
                  marginBottom: "16px",
                }}
              >
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(event) =>
                    setInventorySearch(
                      event.target.value
                    )
                  }
                  placeholder="Search SKU, item, category, model, supplier or location..."
                  style={{
                    width: "100%",
                  }}
                />
              </div>

              {inventoryLoading ? (
                <p>Loading inventory...</p>
              ) : inventory.length === 0 ? (
                <p>No inventory items yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Stock</th>
                        <th>Cost</th>
                        <th>Sale Price</th>
                        <th>Location</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {inventory
                        .filter((item) => {
                          const term =
                            inventorySearch
                              .trim()
                              .toLowerCase();

                          if (!term) return true;

                          return [
                            item.sku,
                            item.name,
                            item.category,
                            item.brandModel,
                            item.supplier,
                            item.location,
                          ].some((value) =>
                            String(value || "")
                              .toLowerCase()
                              .includes(term)
                          );
                        })
                        .map((item) => {
                        const lowStock =
                          Number(item.quantity) <=
                          Number(item.minStock);

                        return (
                          <tr
                            key={item.id}
                            onClick={() => {
                              setEditingInventoryId(
                                item.id
                              );

                              setInventoryForm({
                                sku: item.sku || "",
                                name: item.name || "",
                                category:
                                  item.category || "",
                                brandModel:
                                  item.brandModel || "",
                                quantity:
                                  item.quantity ?? "",
                                minStock:
                                  item.minStock ?? "",
                                cost:
                                  item.cost ?? "",
                                salePrice:
                                  item.salePrice ?? "",
                                supplier:
                                  item.supplier || "",
                                location:
                                  item.location || "",
                                active:
                                  item.active !== false,
                              });

                              setShowInventoryModal(
                                true
                              );
                            }}
                            style={{
                              cursor: "pointer",
                            }}
                          >
                            <td>
                              {item.sku || "—"}
                            </td>

                            <td>
                              <strong>
                                {item.name}
                              </strong>

                              {item.brandModel && (
                                <div>
                                  <small>
                                    {item.brandModel}
                                  </small>
                                </div>
                              )}
                            </td>

                            <td>
                              {item.category || "—"}
                            </td>

                            <td>
                              {item.quantity}
                            </td>

                            <td>
                              ${money(item.cost)}
                            </td>

                            <td>
                              ${money(item.salePrice)}
                            </td>

                            <td>
                              {item.location || "—"}
                            </td>

                            <td>
                              <span
                                className={`status ${
                                  lowStock
                                    ? "urgent"
                                    : "completed"
                                }`}
                              >
                                {lowStock
                                  ? "Low Stock"
                                  : "In Stock"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection ===
          "Payments" &&
          canAccessPayments &&
          renderPayments()}

        {activeSection ===
          "Cash" &&
          canAccessPayments && (
          <section>
            <div className="page-header">
              <div>
                <p className="eyebrow">
                  Cash Management
                </p>

                <h1>Cash</h1>

                <p>
                  Open, manage and close the daily cash session.
                </p>
              </div>
            </div>

            <div className="card">
              {cashLoading ? (
                <p>Loading cash session...</p>
              ) : cashSession ? (
                <>
                  <p>
                    <strong>Status:</strong>{" "}
                    Open
                  </p>

                  <p>
                    <strong>Opening Cash:</strong>{" "}
                    ${money(
                      cashSession.opening_cash
                    )}
                  </p>

                  <div
                    className="form-grid"
                    style={{
                      marginTop: "20px",
                    }}
                  >
                    <div className="form-group">
                      <label>
                        Movement
                      </label>

                      <select
                        value={
                          cashMovementType
                        }
                        onChange={(event) =>
                          setCashMovementType(
                            event.target.value
                          )
                        }
                      >
                        <option value="Cash In">
                          Cash In
                        </option>

                        <option value="Cash Out">
                          Cash Out
                        </option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>
                        Amount
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          cashMovementAmount
                        }
                        onChange={(event) =>
                          setCashMovementAmount(
                            event.target.value
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>
                        Description
                      </label>

                      <input
                        value={
                          cashMovementDescription
                        }
                        onChange={(event) =>
                          setCashMovementDescription(
                            event.target.value
                          )
                        }
                        placeholder="Example: Owner withdrawal"
                      />
                    </div>
                  </div>

                  <button
                    className="primary-btn"
                    type="button"
                    onClick={async () => {
                      if (
                        !cashMovementAmount ||
                        Number(
                          cashMovementAmount
                        ) <= 0
                      ) {
                        alert(
                          "Enter a valid amount."
                        );
                        return;
                      }

                      try {
                        const newMovement =
                          await addCashMovementToSupabase(
                            cashSession.id,
                            {
                              type:
                                cashMovementType,
                              amount:
                                cashMovementAmount,
                              description:
                                cashMovementDescription,
                            }
                          );

                        setCashSession(
                          (current) => ({
                            ...current,
                            cash_movements: [
                              ...(current?.cash_movements || []),
                              newMovement,
                            ],
                          })
                        );

                        setCashMovementAmount(
                          ""
                        );

                        setCashMovementDescription(
                          ""
                        );

                        alert(
                          `${cashMovementType} recorded successfully.`
                        );
                      } catch (error) {
                        console.error(
                          "Cash movement failed:",
                          error
                        );

                        alert(
                          error.message ||
                            "Could not record cash movement."
                        );
                      }
                    }}
                  >
                    Add Cash Movement
                  </button>

                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => {
                      const sessionOpenedAt =
                        new Date(
                          cashSession.opened_at
                        ).getTime();

                      const cashSales =
                        sales
                          .filter((sale) => {
                            const saleDate =
                              new Date(
                                sale.createdAt ||
                                  sale.date
                              ).getTime();

                            return (
                              saleDate >=
                                sessionOpenedAt &&
                              String(
                                sale.paymentMethod
                              ).toLowerCase() ===
                                "cash"
                            );
                          })
                          .reduce(
                            (sum, sale) =>
                              sum +
                              Number(
                                sale.total || 0
                              ),
                            0
                          );

                      const openingCash =
                        Number(
                          cashSession.opening_cash ||
                            0
                        );

                      const cashMovements =
                        cashSession.cash_movements ||
                        [];

                      const cashIn =
                        cashMovements
                          .filter(
                            (movement) =>
                              String(
                                movement.type
                              ).toLowerCase() ===
                              "cash in"
                          )
                          .reduce(
                            (sum, movement) =>
                              sum +
                              Number(
                                movement.amount || 0
                              ),
                            0
                          );

                      const cashOut =
                        cashMovements
                          .filter(
                            (movement) =>
                              String(
                                movement.type
                              ).toLowerCase() ===
                              "cash out"
                          )
                          .reduce(
                            (sum, movement) =>
                              sum +
                              Number(
                                movement.amount || 0
                              ),
                            0
                          );

                      const expectedCash =
                        openingCash +
                        cashSales +
                        cashIn -
                        cashOut;

                      setCloseCashPreview({
                        openingCash,
                        cashSales,
                        cashIn,
                        cashOut,
                        expectedCash,
                      });

                      setShowCloseCashModal(
                        true
                      );
                    }}
                  >
                    Close Cash
                  </button>
                </>
              ) : (
                <>
                  <p>
                    No cash session is currently open.
                  </p>

                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() =>
                      setShowOpenCashModal(true)
                    }
                  >
                    Open Cash
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {activeSection ===
          "Financial Report" &&
          canAccessPayments && (
          <section>
            <div className="page-header">
              <div>
                <p className="eyebrow">
                  Daily Accounting
                </p>

                <h1>
                  Financial Report
                </h1>

                <p>
                  {reportPeriod === "Today"
                    ? "Today's sales, payments and cash activity."
                    : reportPeriod === "Yesterday"
                      ? "Yesterday's sales, payments and cash activity."
                      : reportPeriod === "This Week"
                        ? "This week's sales, payments and cash activity."
                        : reportPeriod === "Last Week"
                          ? "Last week's sales, payments and cash activity."
                          : reportPeriod === "This Month"
                            ? "This month's sales, payments and cash activity."
                            : reportPeriod === "Last Month"
                              ? "Last month's sales, payments and cash activity."
                              : reportPeriod === "First Half"
                                ? "Quincena 1–15 — sales, payments and cash activity."
                                : "Quincena 16–fin de mes — sales, payments and cash activity."}
                </p>
              </div>
            </div>

            <div
              className="form-group"
              style={{
                maxWidth: "280px",
                marginBottom: "20px",
              }}
            >
              <label>
                Report Period
              </label>

              <select
                value={reportPeriod}
                onChange={(event) =>
                  setReportPeriod(
                    event.target.value
                  )
                }
              >
                <option value="Today">
                  Today
                </option>

                <option value="Yesterday">
                  Yesterday
                </option>

                <option value="This Week">
                  This Week
                </option>

                <option value="Last Week">
                  Last Week
                </option>

                <option value="This Month">
                  This Month
                </option>

                <option value="Last Month">
                  Last Month
                </option>

                <option value="First Half">
                  Quincena 1–15
                </option>

                <option value="Second Half">
                  Quincena 16–fin de mes
                </option>

                <option value="Custom Range">
                  Custom Date Range
                </option>
              </select>
            </div>

            {reportPeriod === "Custom Range" && (
              <div
                className="form-grid"
                style={{
                  maxWidth: "620px",
                  marginBottom: "20px",
                }}
              >
                <div className="form-group">
                  <label>
                    Start Date
                  </label>

                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(event) =>
                      setReportStartDate(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    End Date
                  </label>

                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(event) =>
                      setReportEndDate(
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}

            <div className="form-grid">
              <div className="card">
                <span>Total Collected</span>
                <h2>
                  ${money(reportTotalCollected)}
                </h2>
              </div>

              <div className="card">
                <span>Repair Payments</span>
                <h2>
                  ${money(reportRepairPayments)}
                </h2>
              </div>

              <div className="card">
                <span>POS Sales</span>
                <h2>
                  ${money(reportPosSales)}
                </h2>
              </div>

              <div className="card">
                <span>Net Cash</span>
                <h2>
                  ${money(reportNetCash)}
                </h2>
              </div>
            </div>

            <section className="content-card">
              <h2>
                Payment Methods
              </h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>Cash</td>
                      <td>
                        <strong>
                          ${money(reportCash)}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Zelle</td>
                      <td>
                        <strong>
                          ${money(reportZelle)}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Card / Stripe</td>
                      <td>
                        <strong>
                          ${money(reportCard)}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="content-card">
              <h2>
                Cash Activity
              </h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>Cash In</td>
                      <td>
                        <strong>
                          +${money(reportCashIn)}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td>Cash Out</td>
                      <td>
                        <strong>
                          -${money(reportCashOut)}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="content-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Transaction Details
                </h2>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      const transactions = [
                      ...reportSalesToday.map(
                        (sale) => ({
                          date:
                            sale.createdAt ||
                            sale.date,
                          type:
                            "POS Sale",
                          customer:
                            sale.customerName ||
                            "Walk-in",
                          method:
                            sale.paymentMethod ||
                            "Cash",
                          amount:
                            Number(
                              sale.total || 0
                            ),
                        })
                      ),

                      ...reportPaymentsToday.map(
                        (payment) => ({
                          date:
                            payment.date,
                          type:
                            "Repair Payment",
                          customer:
                            payment.customer ||
                            "Customer",
                          method:
                            payment.method ||
                            "Cash",
                          amount:
                            Number(
                              payment.amount || 0
                            ),
                        })
                      ),

                      ...dailyCashMovements
                        .filter((movement) =>
                          isInReportPeriod(
                            movement.created_at
                          )
                        )
                        .map(
                          (movement) => ({
                            date:
                              movement.created_at,
                            type:
                              movement.type,
                            customer:
                              "",
                            method:
                              "Cash",
                            amount:
                              Number(
                                movement.amount || 0
                              ),
                          })
                        ),
                    ].sort(
                      (a, b) =>
                        new Date(b.date) -
                        new Date(a.date)
                    );

                    const rows = [
                      [
                        "Date",
                        "Type",
                        "Customer",
                        "Method",
                        "Amount",
                      ],
                      ...transactions.map(
                        (transaction) => [
                          new Date(
                            transaction.date
                          ).toLocaleString(),
                          transaction.type,
                          transaction.customer,
                          transaction.method,
                          transaction.type ===
                            "Cash Out"
                            ? -transaction.amount
                            : transaction.amount,
                        ]
                      ),
                    ];

                    const csv = rows
                      .map((row) =>
                        row
                          .map((value) => {
                            const stringValue =
                              String(
                                value ?? ""
                              );

                            return `"${stringValue.replace(
                              /"/g,
                              '""'
                            )}"`;
                          })
                          .join(",")
                      )
                      .join("\n");

                    const blob =
                      new Blob(
                        [csv],
                        {
                          type:
                            "text/csv;charset=utf-8;",
                        }
                      );

                    const url =
                      URL.createObjectURL(
                        blob
                      );

                    const link =
                      document.createElement(
                        "a"
                      );

                    link.href = url;
                    link.download =
                      `financial-report-${reportPeriod
                        .toLowerCase()
                        .replace(
                          /[^a-z0-9]+/g,
                          "-"
                        )}.csv`;

                    document.body.appendChild(
                      link
                    );

                    link.click();

                    document.body.removeChild(
                      link
                    );

                    URL.revokeObjectURL(
                      url
                    );
                  }}
                  >
                    Export CSV
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={async () => {
                      const { jsPDF } =
                        await import("jspdf");

                      const transactions = [
                        ...reportSalesToday.map(
                          (sale) => ({
                            date:
                              sale.createdAt ||
                              sale.date,
                            type:
                              "POS Sale",
                            customer:
                              sale.customerName ||
                              "Walk-in",
                            method:
                              sale.paymentMethod ||
                              "Cash",
                            amount:
                              Number(
                                sale.total || 0
                              ),
                          })
                        ),

                        ...reportPaymentsToday.map(
                          (payment) => ({
                            date:
                              payment.date,
                            type:
                              "Repair Payment",
                            customer:
                              payment.customer ||
                              "Customer",
                            method:
                              payment.method ||
                              "Cash",
                            amount:
                              Number(
                                payment.amount || 0
                              ),
                          })
                        ),

                        ...dailyCashMovements
                          .filter((movement) =>
                            isInReportPeriod(
                              movement.created_at
                            )
                          )
                          .map(
                            (movement) => ({
                              date:
                                movement.created_at,
                              type:
                                movement.type,
                              customer:
                                "",
                              method:
                                "Cash",
                              amount:
                                Number(
                                  movement.amount || 0
                                ),
                            })
                          ),
                      ].sort(
                        (a, b) =>
                          new Date(b.date) -
                          new Date(a.date)
                      );

                      const doc =
                        new jsPDF();

                      doc.setFontSize(18);
                      doc.text(
                        "Financial Report",
                        20,
                        20
                      );

                      doc.setFontSize(10);
                      doc.text(
                        `Period: ${reportPeriod}`,
                        20,
                        28
                      );

                      doc.text(
                        `Total Collected: $${money(
                          reportTotalCollected
                        )}`,
                        20,
                        38
                      );

                      doc.text(
                        `Repair Payments: $${money(
                          reportRepairPayments
                        )}`,
                        20,
                        45
                      );

                      doc.text(
                        `POS Sales: $${money(
                          reportPosSales
                        )}`,
                        20,
                        52
                      );

                      doc.text(
                        `Net Cash: $${money(
                          reportNetCash
                        )}`,
                        20,
                        59
                      );

                      doc.setFontSize(12);
                      doc.text(
                        "Payment Methods",
                        20,
                        72
                      );

                      doc.setFontSize(10);
                      doc.text(
                        `Cash: $${money(
                          reportCash
                        )}`,
                        25,
                        80
                      );

                      doc.text(
                        `Zelle: $${money(
                          reportZelle
                        )}`,
                        25,
                        87
                      );

                      doc.text(
                        `Card / Stripe: $${money(
                          reportCard
                        )}`,
                        25,
                        94
                      );

                      doc.text(
                        `Cash In: +$${money(
                          reportCashIn
                        )}`,
                        25,
                        101
                      );

                      doc.text(
                        `Cash Out: -$${money(
                          reportCashOut
                        )}`,
                        25,
                        108
                      );

                      doc.setFontSize(12);
                      doc.text(
                        "Transaction Details",
                        20,
                        122
                      );

                      let y = 132;

                      doc.setFontSize(8);

                      doc.text(
                        "Date",
                        20,
                        y
                      );

                      doc.text(
                        "Type",
                        62,
                        y
                      );

                      doc.text(
                        "Customer",
                        95,
                        y
                      );

                      doc.text(
                        "Method",
                        145,
                        y
                      );

                      doc.text(
                        "Amount",
                        175,
                        y
                      );

                      y += 6;

                      transactions.forEach(
                        (transaction) => {
                          if (y > 280) {
                            doc.addPage();
                            y = 20;
                          }

                          const date =
                            new Date(
                              transaction.date
                            ).toLocaleDateString();

                          const customer =
                            String(
                              transaction.customer ||
                                ""
                            ).slice(0, 22);

                          const amount =
                            transaction.type ===
                            "Cash Out"
                              ? `-$${money(
                                  transaction.amount
                                )}`
                              : `+$${money(
                                  transaction.amount
                                )}`;

                          doc.text(
                            date,
                            20,
                            y
                          );

                          doc.text(
                            String(
                              transaction.type
                            ).slice(0, 18),
                            62,
                            y
                          );

                          doc.text(
                            customer,
                            95,
                            y
                          );

                          doc.text(
                            String(
                              transaction.method
                            ).slice(0, 14),
                            145,
                            y
                          );

                          doc.text(
                            amount,
                            175,
                            y
                          );

                          y += 6;
                        }
                      );

                      doc.save(
                        `financial-report-${reportPeriod
                          .toLowerCase()
                          .replace(
                            /[^a-z0-9]+/g,
                            "-"
                          )}.pdf`
                      );
                    }}
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Customer</th>
                      <th>Method</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[
                      ...reportSalesToday.map(
                        (sale) => ({
                          id:
                            `sale-${sale.id}`,
                          date:
                            sale.createdAt ||
                            sale.date,
                          type:
                            "POS Sale",
                          customer:
                            sale.customerName ||
                            "Walk-in",
                          method:
                            sale.paymentMethod ||
                            "Cash",
                          amount:
                            Number(
                              sale.total || 0
                            ),
                        })
                      ),

                      ...reportPaymentsToday.map(
                        (payment) => ({
                          id:
                            `payment-${payment.id}`,
                          date:
                            payment.date,
                          type:
                            "Repair Payment",
                          customer:
                            payment.customer ||
                            "Customer",
                          method:
                            payment.method ||
                            "Cash",
                          amount:
                            Number(
                              payment.amount || 0
                            ),
                        })
                      ),

                      ...dailyCashMovements
                        .filter((movement) =>
                          isInReportPeriod(
                            movement.created_at
                          )
                        )
                        .map(
                          (movement) => ({
                            id:
                              `movement-${movement.id}`,
                            date:
                              movement.created_at,
                            type:
                              movement.type,
                            customer:
                              "—",
                            method:
                              "Cash",
                            amount:
                              Number(
                                movement.amount || 0
                              ),
                          })
                        ),
                    ]
                      .sort(
                        (a, b) =>
                          new Date(b.date) -
                          new Date(a.date)
                      )
                      .map((transaction) => (
                        <tr
                          key={
                            transaction.id
                          }
                        >
                          <td>
                            {new Date(
                              transaction.date
                            ).toLocaleString()}
                          </td>

                          <td>
                            {
                              transaction.type
                            }
                          </td>

                          <td>
                            {
                              transaction.customer
                            }
                          </td>

                          <td>
                            {
                              transaction.method
                            }
                          </td>

                          <td>
                            <strong>
                              {transaction.type ===
                                "Cash Out"
                                ? "-"
                                : "+"}
                              $
                              {money(
                                transaction.amount
                              )}
                            </strong>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeSection ===
          "Settings" &&
          canAccessSettings &&
          renderSettings()}
      </main>

      {selectedSale && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Sale Details
                </p>
                <h2>
                  {selectedSale.saleNumber}
                </h2>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setSelectedSale(null)
                }
              >
                Close
              </button>
            </div>

            <div className="card">
              <p>
                <strong>Date:</strong>{" "}
                {selectedSale.date}
              </p>

              <p>
                <strong>Customer:</strong>{" "}
                {selectedSale.customerName ||
                  "Walk-in"}
              </p>

              <p>
                <strong>Payment:</strong>{" "}
                {selectedSale.paymentMethod}
              </p>
            </div>

            <div className="card">
              <h3>Items</h3>

              {(selectedSale.items || []).map(
                (item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr auto auto",
                      gap: "14px",
                      padding: "10px 0",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <div>
                      <strong>
                        {item.name}
                      </strong>

                      <div>
                        <small>
                          {item.sku ||
                            "No SKU"}
                        </small>
                      </div>
                    </div>

                    <span>
                      {item.quantity} × $
                      {money(
                        item.unitPrice
                      )}
                    </span>

                    <strong>
                      $
                      {money(
                        item.lineTotal
                      )}
                    </strong>
                  </div>
                )
              )}

              <div
                style={{
                  marginTop: "18px",
                  textAlign: "right",
                  fontSize: "20px",
                }}
              >
                <strong>
                  Total: $
                  {money(
                    selectedSale.total
                  )}
                </strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setSelectedSale(null)
                }
              >
                Close
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={() =>
                  window.print()
                }
              >
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {showPosModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Point of Sale
                </p>
                <h2>New Sale</h2>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setShowPosModal(false)
                }
              >
                Close
              </button>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Customer</label>
                <input
                  value={posCustomer}
                  onChange={(event) =>
                    setPosCustomer(
                      event.target.value
                    )
                  }
                  placeholder="Optional customer name"
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={posPaymentMethod}
                  onChange={(event) =>
                    setPosPaymentMethod(
                      event.target.value
                    )
                  }
                >
                  {PAYMENT_METHODS.map(
                    (method) => (
                      <option key={method}>
                        {method}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Tax</label>
                <select
                  value={posTaxMode}
                  onChange={(event) => {
                    setPosTaxMode(
                      event.target.value
                    );

                    if (
                      event.target.value ===
                      "With Tax"
                    ) {
                      setPosTaxExemptReason("");
                    }
                  }}
                >
                  <option>With Tax</option>
                  <option>No Tax</option>
                </select>
              </div>

              {posTaxMode === "No Tax" && (
                <div className="form-group">
                  <label>
                    No Tax Note
                  </label>

                  <input
                    value={
                      posTaxExemptReason
                    }
                    onChange={(event) =>
                      setPosTaxExemptReason(
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Product</label>
                <select
                  value={posProductId}
                  onChange={(event) =>
                    setPosProductId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select product...
                  </option>

                  {inventory
                    .filter(
                      (item) =>
                        Number(item.quantity) > 0
                    )
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.sku
                          ? `${item.sku} - `
                          : ""}
                        {item.name}
                        {" - $"}
                        {money(item.salePrice)}
                        {" ("}
                        {item.quantity}
                        {" in stock)"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={posQuantity}
                  onChange={(event) =>
                    setPosQuantity(
                      event.target.value
                    )
                  }
                />
              </div>
            </div>

            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  const item =
                    inventory.find(
                      (inventoryItem) =>
                        inventoryItem.id ===
                        posProductId
                    );

                  if (!item) {
                    alert(
                      "Select a product."
                    );
                    return;
                  }

                  const quantity =
                    Math.max(
                      1,
                      Number(posQuantity) || 1
                    );

                  if (
                    quantity >
                    Number(item.quantity)
                  ) {
                    alert(
                      `Not enough stock. Available: ${item.quantity}`
                    );
                    return;
                  }

                  setPosCart((current) => {
                    const existing =
                      current.find(
                        (cartItem) =>
                          cartItem.inventoryId ===
                          item.id
                      );

                    if (existing) {
                      const nextQuantity =
                        existing.quantity +
                        quantity;

                      if (
                        nextQuantity >
                        Number(item.quantity)
                      ) {
                        alert(
                          `Not enough stock. Available: ${item.quantity}`
                        );

                        return current;
                      }

                      return current.map(
                        (cartItem) =>
                          cartItem.inventoryId ===
                          item.id
                            ? {
                                ...cartItem,
                                quantity:
                                  nextQuantity,
                              }
                            : cartItem
                      );
                    }

                    return [
                      ...current,
                      {
                        inventoryId: item.id,
                        sku: item.sku || "",
                        name: item.name,
                        quantity,
                        unitPrice:
                          Number(
                            item.salePrice
                          ) || 0,
                      },
                    ];
                  });

                  setPosProductId("");
                  setPosQuantity(1);
                }}
              >
                + Add to Cart
              </button>
            </div>

            <div className="card">
              <h3>Cart</h3>

              {posCart.length === 0 ? (
                <p>No items in cart.</p>
              ) : (
                <>
                  {posCart.map((item) => (
                    <div
                      key={item.inventoryId}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1fr auto auto",
                        gap: "16px",
                        padding: "10px 0",
                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      <div>
                        <strong>
                          {item.name}
                        </strong>
                        <div>
                          <small>
                            {item.sku || "No SKU"}
                          </small>
                        </div>
                      </div>

                      <span>
                        {item.quantity} × $
                        {money(
                          item.unitPrice
                        )}
                      </span>

                      <strong>
                        $
                        {money(
                          item.quantity *
                            item.unitPrice
                        )}
                      </strong>
                    </div>
                  ))}

                  {(() => {
                    const posSubtotal =
                      posCart.reduce(
                        (sum, item) =>
                          sum +
                          item.quantity *
                            item.unitPrice,
                        0
                      );

                    const posTaxRate =
                      posTaxMode === "With Tax"
                        ? Number(
                            businessSettings.taxRate || 0
                          )
                        : 0;

                    const posTaxAmount =
                      posSubtotal *
                      (posTaxRate / 100);

                    const posTotal =
                      posSubtotal +
                      posTaxAmount;

                    return (
                      <div
                        style={{
                          marginTop: "16px",
                          textAlign: "right",
                        }}
                      >
                        <div>
                          Subtotal: $
                          {money(posSubtotal)}
                        </div>

                        <div>
                          Tax: $
                          {money(posTaxAmount)}
                          {posTaxMode === "With Tax" &&
                            ` (${posTaxRate}%)`}
                        </div>

                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "20px",
                          }}
                        >
                          <strong>
                            Total: $
                            {money(posTotal)}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setShowPosModal(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={
                  posCart.length === 0
                }
                onClick={async () => {
                  if (posCart.length === 0) {
                    alert(
                      "Add at least one item to the sale."
                    );
                    return;
                  }

                  for (const cartItem of posCart) {
                    const inventoryItem =
                      inventory.find(
                        (item) =>
                          item.id ===
                          cartItem.inventoryId
                      );

                    if (!inventoryItem) {
                      alert(
                        `Inventory item not found: ${cartItem.name}`
                      );
                      return;
                    }

                    if (
                      Number(cartItem.quantity) >
                      Number(inventoryItem.quantity)
                    ) {
                      alert(
                        `Not enough stock for ${cartItem.name}. Available: ${inventoryItem.quantity}`
                      );
                      return;
                    }
                  }

                  const saleNumber =
                    `SALE-${Date.now()}`;

                  try {
                    const saleSubtotal =
                      posCart.reduce(
                        (sum, item) =>
                          sum +
                          item.quantity *
                            item.unitPrice,
                        0
                      );

                    const saleTaxRate =
                      posTaxMode === "With Tax"
                        ? Number(
                            businessSettings.taxRate || 0
                          )
                        : 0;

                    const saleTaxAmount =
                      saleSubtotal *
                      (saleTaxRate / 100);

                    const saleTotal =
                      saleSubtotal +
                      saleTaxAmount;

                    await createSaleInSupabase({
                      saleNumber,
                      customerName:
                        posCustomer,
                      paymentMethod:
                        posPaymentMethod,
                      taxExempt:
                        posTaxMode === "No Tax",
                      taxRate:
                        saleTaxRate,
                      taxAmount:
                        saleTaxAmount,
                      taxExemptReason:
                        posTaxMode === "No Tax"
                          ? posTaxExemptReason
                          : "",
                      subtotal:
                        saleSubtotal,
                      total:
                        saleTotal,
                      items: posCart,
                    });

                    for (const cartItem of posCart) {
                      const inventoryItem =
                        inventory.find(
                          (item) =>
                            item.id ===
                            cartItem.inventoryId
                        );

                      const updatedItem = {
                        ...inventoryItem,
                        quantity:
                          Number(
                            inventoryItem.quantity
                          ) -
                          Number(
                            cartItem.quantity
                          ),
                      };

                      await saveInventoryItemToSupabase(
                        updatedItem
                      );
                    }

                    const refreshedInventory =
                      await loadInventoryFromSupabase();

                    setInventory(
                      refreshedInventory
                    );

                    setPosCart([]);
                    setPosProductId("");
                    setPosQuantity(1);
                    setPosCustomer("");
                    setPosPaymentMethod(
                      "Cash"
                    );

                    setShowPosModal(false);

                    alert(
                      `Sale completed: ${saleNumber}`
                    );
                  } catch (error) {
                    console.error(
                      "POS sale failed:",
                      error
                    );

                    alert(
                      "Could not complete the sale."
                    );
                  }
                }}
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseCashModal &&
        cashSession && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    Cash Management
                  </p>

                  <h2>
                    Close Cash
                  </h2>
                </div>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setShowCloseCashModal(false)
                  }
                >
                  Cancel
                </button>
              </div>

              <div className="card">
                <p>
                  <strong>
                    Opening Cash:
                  </strong>{" "}
                  $
                  {money(
                    cashSession.opening_cash
                  )}
                </p>

                <p>
                  <strong>
                    Cash Sales:
                  </strong>{" "}
                  $
                  {money(
                    closeCashPreview?.cashSales || 0
                  )}
                </p>

                <p>
                  <strong>
                    Cash In:
                  </strong>{" "}
                  $
                  {money(
                    closeCashPreview?.cashIn || 0
                  )}
                </p>

                <p>
                  <strong>
                    Cash Out:
                  </strong>{" "}
                  $
                  {money(
                    closeCashPreview?.cashOut || 0
                  )}
                </p>

                <p>
                  <strong>
                    Expected Cash:
                  </strong>{" "}
                  $
                  {money(
                    closeCashPreview?.expectedCash ||
                      0
                  )}
                </p>

                {countedCash !== "" && (
                  <p>
                    <strong>
                      Difference:
                    </strong>{" "}
                    $
                    {money(
                      Number(countedCash || 0) -
                        Number(
                          closeCashPreview?.expectedCash ||
                            0
                        )
                    )}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>
                  Counted Cash
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedCash}
                  onChange={(event) =>
                    setCountedCash(
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>
                  Closing Notes
                </label>

                <textarea
                  rows="3"
                  value={closeCashNotes}
                  onChange={(event) =>
                    setCloseCashNotes(
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setShowCloseCashModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-btn"
                  onClick={async () => {
                    if (
                      countedCash === ""
                    ) {
                      alert(
                        "Enter the counted cash amount."
                      );
                      return;
                    }

                    try {
                      const result =
                        await closeCashSessionInSupabase(
                          cashSession.id,
                          countedCash,
                          closeCashNotes
                        );

                      setCloseCashSummary(
                        result
                      );

                      setCashSession(
                        null
                      );

                      setCountedCash(
                        ""
                      );

                      setCloseCashNotes(
                        ""
                      );

                      setShowCloseCashModal(
                        false
                      );
                    } catch (error) {
                      console.error(
                        "Close cash failed:",
                        error
                      );

                      alert(
                        error.message ||
                          "Could not close cash session."
                      );
                    }
                  }}
                >
                  Confirm Close
                </button>
              </div>
            </div>
          </div>
        )}

      {showOpenCashModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Cash Management
                </p>

                <h2>Open Cash</h2>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setShowOpenCashModal(false)
                }
              >
                Cancel
              </button>
            </div>

            <div className="form-group">
              <label>
                Opening Cash
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={openingCash}
                onChange={(event) =>
                  setOpeningCash(
                    event.target.value
                  )
                }
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setShowOpenCashModal(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={async () => {
                  try {
                    const opened =
                      await openCashSessionInSupabase(
                        openingCash
                      );

                    setCashSession(opened);
                    setOpeningCash("");
                    setShowOpenCashModal(false);

                    alert(
                      "Cash session opened successfully."
                    );
                  } catch (error) {
                    console.error(
                      "Open cash failed:",
                      error
                    );

                    alert(
                      error.message ||
                        "Could not open cash session."
                    );
                  }
                }}
              >
                Open Cash
              </button>
            </div>
          </div>
        </div>
      )}

      {showInventoryModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Inventory
                </p>
                <h2>Add Inventory Item</h2>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setShowInventoryModal(false)
                }
              >
                Close
              </button>
            </div>

            <form
              onSubmit={async (event) => {
                event.preventDefault();

                if (!inventoryForm.name.trim()) {
                  alert("Item name is required.");
                  return;
                }

                try {
                  await saveInventoryItemToSupabase({
                    ...inventoryForm,
                    id: editingInventoryId,
                  });

                  const refreshed =
                    await loadInventoryFromSupabase();

                  setInventory(refreshed);

                  setInventoryForm({
                    sku: "",
                    name: "",
                    category: "",
                    brandModel: "",
                    quantity: "",
                    minStock: "",
                    cost: "",
                    salePrice: "",
                    supplier: "",
                    location: "",
                    active: true,
                  });

                  setEditingInventoryId(null);
                  setShowInventoryModal(false);
                } catch (error) {
                  console.error(
                    "Inventory save failed:",
                    error
                  );

                  alert(
                    error?.message ||
                      error?.details ||
                      error?.hint ||
                      "Could not save the inventory item."
                  );
                }
              }}
            >
              <div className="form-grid">
                <div className="form-group">
                  <label>SKU</label>
                  <input
                    value={inventoryForm.sku}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        sku: event.target.value,
                      }))
                    }
                    placeholder="e.g. IP12-BAT"
                  />
                </div>

                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    value={inventoryForm.name}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="iPhone 12 Battery"
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <input
                    value={inventoryForm.category}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="Battery, Screen, Cable..."
                  />
                </div>

                <div className="form-group">
                  <label>Brand / Compatible Model</label>
                  <input
                    value={inventoryForm.brandModel}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        brandModel: event.target.value,
                      }))
                    }
                    placeholder="Apple iPhone 12"
                  />
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={inventoryForm.quantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Minimum Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={inventoryForm.minStock}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        minStock: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inventoryForm.cost}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        cost: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Sale Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inventoryForm.salePrice}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        salePrice: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Supplier</label>
                  <input
                    value={inventoryForm.supplier}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        supplier: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    value={inventoryForm.location}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Shelf A1"
                  />
                </div>
              </div>

              <div className="modal-actions">
                {editingInventoryId && (
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={async () => {
                      const confirmed =
                        window.confirm(
                          `Delete ${inventoryForm.name || "this item"} permanently?`
                        );

                      if (!confirmed) return;

                      try {
                        await deleteInventoryItemFromSupabase(
                          editingInventoryId
                        );

                        setInventory((current) =>
                          current.filter(
                            (item) =>
                              item.id !==
                              editingInventoryId
                          )
                        );

                        setEditingInventoryId(
                          null
                        );

                        setInventoryForm({
                          sku: "",
                          name: "",
                          category: "",
                          brandModel: "",
                          quantity: "",
                          minStock: "",
                          cost: "",
                          salePrice: "",
                          supplier: "",
                          location: "",
                          active: true,
                        });

                        setShowInventoryModal(
                          false
                        );
                      } catch (error) {
                        console.error(
                          "Inventory delete failed:",
                          error
                        );

                        alert(
                          "Could not delete the inventory item."
                        );
                      }
                    }}
                  >
                    Delete Item
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setEditingInventoryId(
                      null
                    );
                    setShowInventoryModal(
                      false
                    );
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                >
                  {editingInventoryId
                    ? "Save Changes"
                    : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal &&
        canCreateRepair && (
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

                {isOwner && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={
                      deleteRepair
                    }
                    style={{
                      borderColor: "#dc2626",
                      color: "#dc2626",
                    }}
                  >
                    🗑️ Delete Repair
                  </button>
                )}
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

                  {canManagePayments && (
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
                  )}

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

                  {canManageParts && (
                    <>
                      <div className="parts-entry">
                        <select
                          value={
                            inventoryPartForm.inventoryId
                          }
                          onChange={(event) =>
                            setInventoryPartForm(
                              (current) => ({
                                ...current,
                                inventoryId:
                                  event.target.value,
                              })
                            )
                          }
                        >
                          <option value="">
                            Select inventory item...
                          </option>

                          {inventory
                            .filter(
                              (item) =>
                                Number(item.quantity) > 0
                            )
                            .map((item) => (
                              <option
                                key={item.id}
                                value={item.id}
                              >
                                {item.sku
                                  ? `${item.sku} - `
                                  : ""}
                                {item.name} ({item.quantity} in stock)
                              </option>
                            ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={
                            inventoryPartForm.quantity
                          }
                          onChange={(event) =>
                            setInventoryPartForm(
                              (current) => ({
                                ...current,
                                quantity:
                                  event.target.value,
                              })
                            )
                          }
                        />

                        <button
                          type="button"
                          className="primary-btn"
                          onClick={
                            addPartFromInventory
                          }
                        >
                          Use from Inventory
                        </button>
                      </div>

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
                    </>
                  )}

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

                        {canManageParts ? (
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
                        ) : (
                          <span>
                            {part.status}
                          </span>
                        )}
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
              <div className="invoice-sheet invoice-pro">
                <header className="invoice-pro-header">
                  <div className="invoice-company">
                    <img
                      src={microsoldertechLogo}
                      alt="MicroSolderTech"
                      className="invoice-logo"
                    />

                    <div className="invoice-service-title">
                      MICROSOLDERING REPAIR SERVICES
                    </div>

                    <div className="invoice-contact">
                      {businessSettings.phone && (
                        <div>{businessSettings.phone}</div>
                      )}
                      {businessSettings.email && (
                        <div>{businessSettings.email}</div>
                      )}
                      {businessSettings.address && (
                        <div>{businessSettings.address}</div>
                      )}
                    </div>
                  </div>

                  <div className="invoice-id-card">
                    <div className="invoice-id-title">INVOICE</div>

                    <div className="invoice-id-number">
                      {editForm.invoiceNumber}
                    </div>

                    <div className="invoice-id-date">
                      <span>DATE</span>
                      <strong>
                        {editForm.intakeDate || nowString()}
                      </strong>
                    </div>
                  </div>
                </header>

                <section className="invoice-info-grid">
                  <div className="invoice-card">
                    <div className="invoice-card-heading">
                      <span className="invoice-badge">B</span>
                      BILL TO
                    </div>

                    <div className="invoice-customer-name">
                      {editForm.customer}
                    </div>

                    <div className="invoice-detail-line">
                      <span>Phone</span>
                      {editForm.phone || "Not provided"}
                    </div>

                    <div className="invoice-detail-line">
                      <span>Email</span>
                      {
                        customerProfiles.find(
                          (customer) =>
                            String(customer.id) ===
                            String(editForm.customerId)
                        )?.email || "Not provided"
                      }
                    </div>
                  </div>

                  <div className="invoice-card">
                    <div className="invoice-card-heading">
                      <span className="invoice-badge">R</span>
                      REPAIR DETAILS
                    </div>

                    <div className="invoice-repair-grid">
                      <div>
                        <span>Repair #</span>
                        <strong>{editForm.id}</strong>
                      </div>

                      <div>
                        <span>Technician</span>
                        <strong>
                          {editForm.technician || "Unassigned"}
                        </strong>
                      </div>

                      <div>
                        <span>Device</span>
                        <strong>
                          {editForm.deviceType} {editForm.brand}{" "}
                          {editForm.model}
                        </strong>
                      </div>

                      <div>
                        <span>Warranty</span>
                        <strong>{editForm.warranty}</strong>
                      </div>

                      <div>
                        <span>Serial / IMEI</span>
                        <strong>
                          {editForm.serial || "Not recorded"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="invoice-issue-grid">
                  <div className="invoice-highlight">
                    <span className="invoice-circle">!</span>

                    <div>
                      <div className="invoice-section-label">
                        ISSUE
                      </div>

                      <div className="invoice-section-value">
                        {editForm.issue || "Not provided"}
                      </div>
                    </div>
                  </div>

                  <div className="invoice-highlight">
                    <span className="invoice-circle">D</span>

                    <div>
                      <div className="invoice-section-label">
                        DIAGNOSIS
                      </div>

                      <div className="invoice-section-value">
                        {editForm.diagnosis || "Not provided"}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="invoice-financial-grid">
                  <div className="invoice-left-column">

                    <div className="invoice-card invoice-service-card">
                      <div className="invoice-card-heading">
                        <span className="invoice-badge">$</span>
                        SERVICE SUMMARY
                      </div>

                      <div className="invoice-table">
                        <div className="invoice-table-head">
                          <span>DESCRIPTION</span>
                          <span>AMOUNT</span>
                        </div>

                        <div className="invoice-table-row">
                          <span>Parts</span>
                          <strong>
                            ${money(editForm.partsCost)}
                          </strong>
                        </div>

                        <div className="invoice-table-row">
                          <span>Labor</span>
                          <strong>
                            ${money(editForm.labor)}
                          </strong>
                        </div>

                        <div className="invoice-table-total">
                          <span>TOTAL</span>
                          <strong>
                            ${money(editTotal)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="invoice-card invoice-payment-card">
                      <div className="invoice-card-heading">
                        <span className="invoice-badge">$</span>
                        PAYMENT HISTORY
                      </div>

                      {(editForm.payments || []).length === 0 ? (
                        <div className="invoice-empty-payment">
                          No payments recorded.
                        </div>
                      ) : (
                        <div className="invoice-payment-table">
                          <div className="invoice-payment-head">
                            <span>DATE</span>
                            <span>DESCRIPTION</span>
                            <span>METHOD</span>
                            <span>AMOUNT</span>
                          </div>

                          {(editForm.payments || []).map((payment) => (
                            <div
                              key={payment.id}
                              className="invoice-payment-row"
                            >
                              <span>{payment.date}</span>
                              <span>Payment</span>
                              <span>{payment.method}</span>
                              <strong>
                                ${money(payment.amount)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {editForm.customerNotes && (
                      <div className="invoice-card invoice-notes-card">
                        <div className="invoice-card-heading">
                          CUSTOMER NOTES
                        </div>

                        <p>{editForm.customerNotes}</p>
                      </div>
                    )}
                  </div>

                  <aside className="invoice-total-card">
                    <div className="invoice-card-heading">
                      <span className="invoice-badge">$</span>
                      TOTAL SUMMARY
                    </div>

                    <div className="invoice-total-line">
                      <span>Subtotal</span>
                      <strong>${money(editTotal)}</strong>
                    </div>

                    <div className="invoice-total-line">
                      <span>Paid</span>
                      <strong>${money(editPaid)}</strong>
                    </div>

                    <div className="invoice-balance">
                      <span>BALANCE DUE</span>
                      <strong>${money(editBalance)}</strong>
                    </div>
                  </aside>
                </section>

                <footer className="invoice-pro-footer">
                  <div>
                    Thank you for choosing{" "}
                    {businessSettings.businessName}.
                  </div>

                  <div className="invoice-website">
                    microsoldertech.com
                  </div>
                </footer>
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
                  🖨️ Print Invoice
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}

export default App;