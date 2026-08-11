import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const deviceTypes = [
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

  const technicians = [
    "Unassigned",
    "Roberto",
    "Technician 2",
    "Technician 3",
  ];

  const statuses = [
    "Received",
    "In Progress",
    "Waiting for Parts",
    "Ready",
    "Completed",
  ];

  const priorities = ["Normal", "Rush", "Urgent"];

  const warrantyOptions = [
    "No Warranty",
    "30 Days",
    "60 Days",
    "90 Days",
    "6 Months",
    "1 Year",
  ];

  const approvalOptions = [
    "Pending",
    "Approved",
    "Declined",
    "Not Required",
  ];

  const defaultRepairs = [
    {
      id: "MT-000101",
      customer: "Carlos Rivera",
      phone: "954-555-0101",
      deviceType: "iPhone",
      brand: "Apple",
      model: "iPhone 15 Pro Max",
      serial: "",
      issue: "No Power",
      diagnosis: "",
      accessories: "Case",
      condition: "Good",
      technician: "Roberto",
      estimatedCompletion: "",
      partsCost: 80,
      labor: 170,
      total: 250,
      deposit: 70,
      balance: 180,
      passcode: "",
      status: "In Progress",
      priority: "Normal",
      warranty: "90 Days",
      approval: "Approved",
      partsNeeded: "",
      internalNotes: "",
      customerNotes: "",
      checkIn: {},
    },
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
    deposit: "",
    passcode: "",
    status: "Received",
    priority: "Normal",
    warranty: "No Warranty",
    approval: "Pending",
    partsNeeded: "",
    internalNotes: "",
    customerNotes: "",
    checkIn: {},
  };

  const [repairs, setRepairs] = useState(() => {
    try {
      const saved = localStorage.getItem("microtechusa_repairs");

      if (saved) {
        const parsed = JSON.parse(saved);

        return parsed.map((repair) => ({
          priority: "Normal",
          warranty: "No Warranty",
          approval: "Pending",
          partsNeeded: "",
          internalNotes: "",
          customerNotes: "",
          checkIn: {},
          ...repair,
        }));
      }

      return defaultRepairs;
    } catch {
      return defaultRepairs;
    }
  });

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(
      "microtechusa_repairs",
      JSON.stringify(repairs)
    );
  }, [repairs]);

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

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function toggleCheckIn(item, editing = false) {
    if (editing) {
      setEditForm((current) => ({
        ...current,
        checkIn: {
          ...(current.checkIn || {}),
          [item]: !(current.checkIn || {})[item],
        },
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      checkIn: {
        ...(current.checkIn || {}),
        [item]: !(current.checkIn || {})[item],
      },
    }));
  }

  function getNextRepairId() {
    const numbers = repairs
      .map((repair) =>
        Number(String(repair.id).replace("MT-", ""))
      )
      .filter((number) => !Number.isNaN(number));

    const next =
      numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

    return `MT-${String(next).padStart(6, "0")}`;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.customer || !form.model || !form.issue) {
      alert("Please complete Customer, Model and Issue.");
      return;
    }

    const partsCost = Number(form.partsCost) || 0;
    const labor = Number(form.labor) || 0;
    const deposit = Number(form.deposit) || 0;

    const total = partsCost + labor;
    const balance = Math.max(total - deposit, 0);

    const newRepair = {
      id: getNextRepairId(),
      ...form,
      partsCost,
      labor,
      deposit,
      total,
      balance,
    };

    setRepairs((current) => [newRepair, ...current]);
    setForm(emptyForm);
    setShowModal(false);
  }

  function openRepair(repair) {
    setEditForm({
      priority: "Normal",
      warranty: "No Warranty",
      approval: "Pending",
      partsNeeded: "",
      internalNotes: "",
      customerNotes: "",
      checkIn: {},
      ...repair,
    });

    setShowEditModal(true);
  }

  function saveRepairChanges(event) {
    event.preventDefault();

    if (!editForm) return;

    const partsCost = Number(editForm.partsCost) || 0;
    const labor = Number(editForm.labor) || 0;
    const deposit = Number(editForm.deposit) || 0;

    const total = partsCost + labor;
    const balance = Math.max(total - deposit, 0);

    const updated = {
      ...editForm,
      partsCost,
      labor,
      deposit,
      total,
      balance,
    };

    setRepairs((current) =>
      current.map((repair) =>
        repair.id === updated.id ? updated : repair
      )
    );

    setEditForm(null);
    setShowEditModal(false);
  }

  const activeRepairs = repairs.filter(
    (repair) => repair.status !== "Completed"
  ).length;

  const readyRepairs = repairs.filter(
    (repair) => repair.status === "Ready"
  ).length;

  const completedRepairs = repairs.filter(
    (repair) => repair.status === "Completed"
  ).length;

  const balanceDue = repairs.reduce(
    (total, repair) =>
      total + Number(repair.balance || 0),
    0
  );

  const filteredRepairs = repairs.filter((repair) => {
    const text = `
      ${repair.id}
      ${repair.customer}
      ${repair.phone}
      ${repair.deviceType}
      ${repair.brand}
      ${repair.model}
      ${repair.issue}
      ${repair.status}
      ${repair.technician}
      ${repair.priority}
      ${repair.approval}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  const formParts = Number(form.partsCost) || 0;
  const formLabor = Number(form.labor) || 0;
  const formDeposit = Number(form.deposit) || 0;
  const formTotal = formParts + formLabor;
  const formBalance = Math.max(
    formTotal - formDeposit,
    0
  );

  const editParts = Number(editForm?.partsCost) || 0;
  const editLabor = Number(editForm?.labor) || 0;
  const editDeposit = Number(editForm?.deposit) || 0;
  const editTotal = editParts + editLabor;
  const editBalance = Math.max(
    editTotal - editDeposit,
    0
  );

  function paymentStatus(total, paid) {
    const totalNumber = Number(total) || 0;
    const paidNumber = Number(paid) || 0;

    if (totalNumber === 0) return "No Charge";
    if (paidNumber <= 0) return "Unpaid";
    if (paidNumber >= totalNumber) return "Paid";

    return "Partial";
  }

  function renderRepairForm({
    data,
    onChange,
    editing = false,
  }) {
    const checkItems = getCheckItems(data.deviceType);

    return (
      <div className="form-grid">
        <div className="form-group">
          <label>Customer *</label>
          <input
            name="customer"
            value={data.customer || ""}
            onChange={onChange}
            placeholder="Customer name"
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            name="phone"
            value={data.phone || ""}
            onChange={onChange}
            placeholder="Phone number"
          />
        </div>

        <div className="form-group">
          <label>Device Type</label>
          <select
            name="deviceType"
            value={data.deviceType}
            onChange={onChange}
          >
            {deviceTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Brand</label>
          <input
            name="brand"
            value={data.brand || ""}
            onChange={onChange}
            placeholder="Apple, Samsung, Sony..."
          />
        </div>

        <div className="form-group">
          <label>Model *</label>
          <input
            name="model"
            value={data.model || ""}
            onChange={onChange}
            placeholder="Device model"
          />
        </div>

        <div className="form-group">
          <label>Serial / IMEI</label>
          <input
            name="serial"
            value={data.serial || ""}
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Priority</label>
          <select
            name="priority"
            value={data.priority}
            onChange={onChange}
          >
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Status</label>
          <select
            name="status"
            value={data.status}
            onChange={onChange}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Technician</label>
          <select
            name="technician"
            value={data.technician}
            onChange={onChange}
          >
            {technicians.map((technician) => (
              <option key={technician}>
                {technician}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Estimated Completion</label>
          <input
            type="date"
            name="estimatedCompletion"
            value={data.estimatedCompletion || ""}
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Device Condition</label>
          <select
            name="condition"
            value={data.condition || "Good"}
            onChange={onChange}
          >
            <option>Good</option>
            <option>Cracked Screen</option>
            <option>Broken Back Glass</option>
            <option>Bent Frame</option>
            <option>Liquid Damage</option>
            <option>Heavy Damage</option>
            <option>Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Customer Approval</label>
          <select
            name="approval"
            value={data.approval}
            onChange={onChange}
          >
            {approvalOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Warranty</label>
          <select
            name="warranty"
            value={data.warranty}
            onChange={onChange}
          >
            {warrantyOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Passcode</label>
          <input
            name="passcode"
            value={data.passcode || ""}
            onChange={onChange}
          />
        </div>

        <div className="form-group full-width">
          <label>Accessories Received</label>
          <input
            name="accessories"
            value={data.accessories || ""}
            onChange={onChange}
            placeholder="Case, charger, controller, cables..."
          />
        </div>

        <div className="form-group full-width">
          <label>Issue *</label>
          <textarea
            name="issue"
            value={data.issue || ""}
            onChange={onChange}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>Diagnosis</label>
          <textarea
            name="diagnosis"
            value={data.diagnosis || ""}
            onChange={onChange}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>Parts Needed</label>
          <textarea
            name="partsNeeded"
            value={data.partsNeeded || ""}
            onChange={onChange}
            placeholder="Charging port, screen, HDMI port..."
            rows="2"
          />
        </div>

        <div className="form-group full-width">
          <label>Internal Technician Notes</label>
          <textarea
            name="internalNotes"
            value={data.internalNotes || ""}
            onChange={onChange}
            placeholder="Internal notes — not for customer"
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>Customer Notes</label>
          <textarea
            name="customerNotes"
            value={data.customerNotes || ""}
            onChange={onChange}
            placeholder="Notes that can appear on invoice"
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>Device Check-In</label>

          <div className="checkin-grid">
            {checkItems.map((item) => (
              <label
                className="checkin-item"
                key={item}
              >
                <input
                  type="checkbox"
                  checked={Boolean(data.checkIn?.[item])}
                  onChange={() =>
                    toggleCheckIn(item, editing)
                  }
                />

                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Parts Cost</label>
          <input
            type="number"
            step="0.01"
            name="partsCost"
            value={data.partsCost ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Labor</label>
          <input
            type="number"
            step="0.01"
            name="labor"
            value={data.labor ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Deposit</label>
          <input
            type="number"
            step="0.01"
            name="deposit"
            value={data.deposit ?? ""}
            onChange={onChange}
          />
        </div>

        <div className="form-group">
          <label>Payment Status</label>
          <input
            value={paymentStatus(
              (Number(data.partsCost) || 0) +
                (Number(data.labor) || 0),
              Number(data.deposit) || 0
            )}
            readOnly
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">M</div>

          <div>
            <h2>MicrotechUSA</h2>
            <span>Repair Management</span>
          </div>
        </div>

        <nav className="nav">
          <button className="nav-item active">
            Dashboard
          </button>
          <button className="nav-item">Repairs</button>
          <button className="nav-item">Customers</button>
          <button className="nav-item">Invoices</button>
          <button className="nav-item">Payments</button>
          <button className="nav-item">Settings</button>
        </nav>

        <div className="sidebar-footer">
          <p>MicrotechUSA</p>
          <span>Repair Center</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Repair Center</p>

            <h1>Dashboard</h1>

            <p className="subtitle">
              Manage repairs, customers and payments.
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() => setShowModal(true)}
          >
            + New Repair
          </button>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div>
              <span className="stat-label">
                Active Repairs
              </span>
              <strong>{activeRepairs}</strong>
            </div>

            <div className="stat-icon">🔧</div>
          </div>

          <div className="stat-card">
            <div>
              <span className="stat-label">
                Ready
              </span>
              <strong>{readyRepairs}</strong>
            </div>

            <div className="stat-icon">✅</div>
          </div>

          <div className="stat-card">
            <div>
              <span className="stat-label">
                Completed
              </span>
              <strong>{completedRepairs}</strong>
            </div>

            <div className="stat-icon">📦</div>
          </div>

          <div className="stat-card">
            <div>
              <span className="stat-label">
                Balance Due
              </span>

              <strong>
                ${balanceDue.toFixed(2)}
              </strong>
            </div>

            <div className="stat-icon">💵</div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-header">
            <div>
              <h2>Recent Repairs</h2>
              <p>
                Latest repair tickets in your shop.
              </p>
            </div>

            <div className="actions">
              <input
                className="search"
                placeholder="Search repair..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <button className="secondary-btn">
                View All
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Repair #</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Device</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Technician</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredRepairs.map((repair) => (
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

                    <td>{repair.deviceType}</td>

                    <td>
                      {repair.brand} {repair.model}
                    </td>

                    <td>
                      <span
                        className={`priority priority-${repair.priority
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {repair.priority}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status ${repair.status
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {repair.status}
                      </span>
                    </td>

                    <td>{repair.technician}</td>

                    <td className="balance">
                      $
                      {Number(
                        repair.total || 0
                      ).toFixed(2)}
                    </td>

                    <td className="balance">
                      $
                      {Number(
                        repair.balance || 0
                      ).toFixed(2)}
                    </td>

                    <td>
                      <button
                        className="table-btn"
                        onClick={() =>
                          openRepair(repair)
                        }
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredRepairs.length === 0 && (
                  <tr>
                    <td
                      colSpan="10"
                      style={{ textAlign: "center" }}
                    >
                      No repairs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-card device-section">
          <div className="content-header">
            <div>
              <h2>
                Repairs by Device Type
              </h2>

              <p>
                Current repair volume by category.
              </p>
            </div>
          </div>

          <div className="device-grid">
            {deviceTypes.map((type) => {
              const count = repairs.filter(
                (repair) =>
                  repair.deviceType === type
              ).length;

              return (
                <div
                  className="device-card"
                  key={type}
                >
                  <span>{type}</span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Repair Ticket
                </p>

                <h2>New Repair</h2>
              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setShowModal(false)
                }
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {renderRepairForm({
                data: form,
                onChange: handleChange,
              })}

              <div className="totals-box">
                <div>
                  <span>Parts</span>
                  <strong>
                    ${formParts.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Labor</span>
                  <strong>
                    ${formLabor.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Total</span>
                  <strong>
                    ${formTotal.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Deposit</span>
                  <strong>
                    ${formDeposit.toFixed(2)}
                  </strong>
                </div>

                <div className="balance-total">
                  <span>Balance Due</span>
                  <strong>
                    ${formBalance.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setShowModal(false)
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

      {showEditModal && editForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Repair Ticket
                </p>

                <h2>{editForm.id}</h2>

                <p className="small-text">
                  {editForm.customer} ·{" "}
                  {editForm.deviceType} ·{" "}
                  {editForm.model}
                </p>
              </div>

              <button
                className="close-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditForm(null);
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveRepairChanges}
            >
              {renderRepairForm({
                data: editForm,
                onChange: handleEditChange,
                editing: true,
              })}

              <div className="totals-box">
                <div>
                  <span>Parts</span>
                  <strong>
                    ${editParts.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Labor</span>
                  <strong>
                    ${editLabor.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Total</span>
                  <strong>
                    ${editTotal.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Deposit</span>
                  <strong>
                    ${editDeposit.toFixed(2)}
                  </strong>
                </div>

                <div className="balance-total">
                  <span>Balance Due</span>
                  <strong>
                    ${editBalance.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditForm(null);
                  }}
                >
                  Cancel
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
    </div>
  );
}

export default App;