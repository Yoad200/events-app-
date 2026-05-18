// ═══════════════════════════════════════════════
// ניהול אירועים - Admin Dashboard
// ═══════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $("toast-container").appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2700);
}

function setError(elementId, message) {
  $(elementId).textContent = message || "";
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function getInitial(s) {
  return s && s.length ? s.charAt(0).toUpperCase() : "?";
}

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HEBREW_DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `יום ${HEBREW_DAYS_FULL[d.getDay()]}, ${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatEventDateShort(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatTime(timeStr) {
  return (timeStr || "").substring(0, 5);
}

// ─── State ──────────────────────────────────────

let state = {
  token: localStorage.getItem("events_admin_token"),
  events: [],
  filter: "upcoming",
  currentEvent: null,
  currentSignups: [],
  currentSignupStatus: "pending",
};

// ─── API ────────────────────────────────────────

async function api(path, options = {}) {
  const opts = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { "Authorization": `Bearer ${state.token}` } : {}),
    },
  };
  if (options.body) opts.body = JSON.stringify(options.body);

  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `שגיאה (${res.status})`);
  }
  return data;
}

// ─── Login ──────────────────────────────────────

async function handleLogin() {
  const pwd = $("login-pwd").value;
  setError("login-error", "");

  if (!pwd) { setError("login-error", "הזן סיסמה"); return; }

  $("btn-login").disabled = true;

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { password: pwd },
    });

    state.token = data.token;
    localStorage.setItem("events_admin_token", data.token);
    await enterApp();
  } catch (e) {
    setError("login-error", String(e.message || e));
  } finally {
    $("btn-login").disabled = false;
  }
}

async function enterApp() {
  $("screen-login").style.display = "none";
  $("screen-app").style.display = "block";
  await loadEvents();
}

function logout() {
  state.token = null;
  localStorage.removeItem("events_admin_token");
  $("login-pwd").value = "";
  setError("login-error", "");
  $("screen-app").style.display = "none";
  $("screen-login").style.display = "flex";
}

// ─── Events List ────────────────────────────────

async function loadEvents() {
  try {
    const data = await api("/api/events/list");
    state.events = data.events || [];
    renderEvents();
  } catch (e) {
    if (String(e.message).includes("לא מחובר")) {
      logout();
    } else {
      showToast(`שגיאה: ${e.message}`, "error");
    }
  }
}

function renderEvents() {
  const grid = $("events-grid");
  const empty = $("events-empty");
  grid.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let filtered = state.events;
  if (state.filter === "upcoming") {
    filtered = state.events.filter(e => new Date(e.event_date) >= today);
  } else if (state.filter === "past") {
    filtered = state.events.filter(e => new Date(e.event_date) < today);
  }

  if (filtered.length === 0) {
    grid.style.display = "none";
    empty.style.display = "block";
    return;
  }

  grid.style.display = "grid";
  empty.style.display = "none";

  for (const event of filtered) {
    const isPast = new Date(event.event_date) < today;
    const totalNeeded = event.needed_waiters + event.needed_setup +
                       event.needed_attractions + event.needed_food_stalls;

    const card = document.createElement("div");
    card.className = `event-card ${isPast ? 'past' : ''}`;
    card.innerHTML = `
      <div class="event-card-date">${formatEventDateShort(event.event_date)}</div>
      <div class="event-card-title">${escapeHtml(event.title)}</div>
      <div class="event-card-location">📍 ${escapeHtml(event.location)} · ${formatTime(event.start_time)}-${formatTime(event.end_time)}</div>
      <div class="event-card-stats">
        <div class="event-card-stat stat-approved">
          ✓ ${event.approved_count}/${totalNeeded} אושרו
        </div>
        ${event.pending_count > 0 ? `
          <div class="event-card-stat stat-pending">
            ⏳ ${event.pending_count} ממתינים
          </div>
        ` : ''}
      </div>
    `;

    card.onclick = () => openEventDetails(event);
    grid.appendChild(card);
  }
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".filter-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.filter === filter);
  });
  renderEvents();
}

// ─── New Event ──────────────────────────────────

function openNewEventModal() {
  $("ev-title").value = "";
  $("ev-date").value = "";
  $("ev-rate").value = 50;
  $("ev-start").value = "18:00";
  $("ev-end").value = "23:00";
  $("ev-location").value = "";
  $("ev-notes").value = "";
  $("ev-waiters").value = 0;
  $("ev-setup").value = 0;
  $("ev-attractions").value = 0;
  $("ev-food").value = 0;
  setError("ev-error", "");
  $("new-event-modal").style.display = "flex";
}

async function saveNewEvent() {
  setError("ev-error", "");

  const date = $("ev-date").value;
  const location = $("ev-location").value.trim();
  const rate = Number($("ev-rate").value);

  if (!date) { setError("ev-error", "תאריך חובה"); return; }
  if (!location) { setError("ev-error", "מקום חובה"); return; }
  if (isNaN(rate) || rate < 0) { setError("ev-error", "תשלום לשעה חייב להיות חיובי"); return; }

  const waiters = Number($("ev-waiters").value) || 0;
  const setup = Number($("ev-setup").value) || 0;
  const attractions = Number($("ev-attractions").value) || 0;
  const food = Number($("ev-food").value) || 0;

  if (waiters + setup + attractions + food === 0) {
    setError("ev-error", "חייב להגדיר לפחות תפקיד אחד");
    return;
  }

  $("btn-save-event").disabled = true;

  try {
    const data = await api("/api/events/create", {
      method: "POST",
      body: {
        title: $("ev-title").value.trim(),
        event_date: date,
        start_time: $("ev-start").value,
        end_time: $("ev-end").value,
        location,
        hourly_rate: rate,
        notes: $("ev-notes").value.trim(),
        needed_waiters: waiters,
        needed_setup: setup,
        needed_attractions: attractions,
        needed_food_stalls: food,
      }
    });

    $("new-event-modal").style.display = "none";
    showShareLink(data.event.share_id);
    await loadEvents();
  } catch (e) {
    setError("ev-error", String(e.message || e));
  } finally {
    $("btn-save-event").disabled = false;
  }
}

function showShareLink(shareId) {
  const url = `${window.location.origin}/event.html?id=${shareId}`;
  $("share-link").value = url;
  $("copy-confirm").textContent = "";
  $("share-modal").style.display = "flex";
}

function copyShareLink() {
  const url = $("share-link").value;
  navigator.clipboard.writeText(url).then(() => {
    $("copy-confirm").textContent = "✓ הקישור הועתק!";
    setTimeout(() => $("copy-confirm").textContent = "", 3000);
  }).catch(() => {
    $("share-link").select();
    showToast("סמן והעתק ידנית", "info");
  });
}

// ─── Event Details ──────────────────────────────

async function openEventDetails(event) {
  state.currentEvent = event;
  $("ed-title").textContent = event.title;

  const totalNeeded = event.needed_waiters + event.needed_setup +
                     event.needed_attractions + event.needed_food_stalls;

  const statusBadge = event.status === 'open'
    ? '<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">פתוח להרשמה</span>'
    : '<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">סגור להרשמה</span>';

  $("ed-info").innerHTML = `
    <div class="event-info-row">
      <strong>סטטוס:</strong>
      <span>${statusBadge}</span>
    </div>
    <div class="event-info-row">
      <strong>📅 תאריך:</strong>
      <span>${formatEventDate(event.event_date)}</span>
    </div>
    <div class="event-info-row">
      <strong>🕒 שעות:</strong>
      <span>${formatTime(event.start_time)} - ${formatTime(event.end_time)}</span>
    </div>
    <div class="event-info-row">
      <strong>📍 מקום:</strong>
      <span>${escapeHtml(event.location)}</span>
    </div>
    <div class="event-info-row">
      <strong>💰 שכר:</strong>
      <span>${event.hourly_rate} ₪/שעה</span>
    </div>
    <div class="event-info-row">
      <strong>👥 צריך:</strong>
      <span>
        ${event.needed_waiters ? `🍽️ ${event.needed_waiters} מלצרים ` : ''}
        ${event.needed_setup ? `🔨 ${event.needed_setup} הקמה ` : ''}
        ${event.needed_attractions ? `🎮 ${event.needed_attractions} אטרקציות ` : ''}
        ${event.needed_food_stalls ? `🌮 ${event.needed_food_stalls} דוכנים ` : ''}
      </span>
    </div>
    ${event.notes ? `
      <div class="event-info-row">
        <strong>📝 הערות:</strong>
        <span>${escapeHtml(event.notes)}</span>
      </div>
    ` : ''}
  `;

  // Update toggle status button text
  $("btn-toggle-status").innerHTML = event.status === 'open'
    ? '🔒 סגור הרשמה'
    : '🔓 פתח הרשמה מחדש';

  $("event-details-modal").style.display = "flex";
  state.currentSignupStatus = "pending";
  await loadEventSignups();
}

async function loadEventSignups() {
  try {
    const data = await api(`/api/events/workers?event_id=${state.currentEvent.id}`);
    state.currentSignups = data.signups || [];
    renderSignups();
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, "error");
  }
}

function renderSignups() {
  const pending = state.currentSignups.filter(s => s.status === "pending").length;
  const approved = state.currentSignups.filter(s => s.status === "approved").length;
  const rejected = state.currentSignups.filter(s => s.status === "rejected").length;

  $("count-pending").textContent = pending;
  $("count-approved").textContent = approved;
  $("count-rejected").textContent = rejected;

  document.querySelectorAll(".signup-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.status === state.currentSignupStatus);
  });

  const filtered = state.currentSignups.filter(s => s.status === state.currentSignupStatus);
  const list = $("signups-list");
  const empty = $("signups-empty");

  if (filtered.length === 0) {
    list.style.display = "none";
    empty.style.display = "block";
    empty.querySelector("p").textContent =
      state.currentSignupStatus === "pending" ? "אין רישומים ממתינים" :
      state.currentSignupStatus === "approved" ? "אין עובדים שאושרו עדיין" :
      "אין רישומים שנדחו";
    return;
  }

  list.style.display = "flex";
  empty.style.display = "none";
  list.innerHTML = "";

  for (const signup of filtered) {
    const w = signup.worker;
    if (!w) continue;

    const card = document.createElement("div");
    card.className = "signup-card";

    let actionsHtml = "";
    if (signup.status === "pending") {
      actionsHtml = `
        <div class="signup-actions">
          <button class="btn-action btn-approve" data-action="approve" data-id="${signup.id}">✓ אשר</button>
          <button class="btn-action btn-reject" data-action="reject" data-id="${signup.id}">✗ דחה</button>
        </div>
      `;
    } else if (signup.status === "approved") {
      actionsHtml = `
        <div class="signup-actions">
          <button class="btn-action btn-reject" data-action="reject" data-id="${signup.id}">בטל אישור</button>
        </div>
      `;
    } else if (signup.status === "rejected") {
      actionsHtml = `
        <div class="signup-actions">
          <button class="btn-action btn-approve" data-action="approve" data-id="${signup.id}">החזר</button>
        </div>
      `;
    }

    const cancellations = w.total_cancellations || 0;
    const lastMinute = w.last_minute_cancellations || 0;

    card.innerHTML = `
      <div class="signup-avatar">${escapeHtml(getInitial(w.name))}</div>
      <div class="signup-info">
        <div class="signup-name">${escapeHtml(w.name)}</div>
        <div class="signup-meta">
          <span class="signup-role">${escapeHtml(signup.role)}</span>
          ${w.phone ? `📞 ${escapeHtml(w.phone)}` : ''}
        </div>
        <div class="signup-stats">
          <span class="signup-stat">📊 ${w.total_events || 0} אירועים</span>
          ${cancellations > 0 ? `<span class="signup-stat ${cancellations > 2 ? 'warning' : ''}">⚠ ${cancellations} ביטולים</span>` : ''}
          ${lastMinute > 0 ? `<span class="signup-stat warning">🚨 ${lastMinute} ביטולי רגע אחרון</span>` : ''}
        </div>
        ${signup.notes ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;">${escapeHtml(signup.notes)}</div>` : ''}
      </div>
      ${actionsHtml}
    `;

    list.appendChild(card);
  }

  list.querySelectorAll("[data-action]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      btn.disabled = true;
      try {
        await api("/api/events/approve", {
          method: "POST",
          body: { signup_id: parseInt(id), action }
        });
        showToast(action === "approve" ? "אושר" : "נדחה", "success");
        await loadEventSignups();
        await loadEvents();
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, "error");
        btn.disabled = false;
      }
    };
  });
}

function setSignupTab(status) {
  state.currentSignupStatus = status;
  renderSignups();
}

// ─── Delete Event ───────────────────────────────

async function deleteEvent() {
  if (!state.currentEvent) return;

  showConfirm(
    "מחיקת אירוע",
    `האם למחוק את האירוע "${state.currentEvent.title}"?\n\nכל הרישומים יימחקו גם. לא ניתן לבטל.`,
    async () => {
      try {
        await api("/api/events/delete", {
          method: "POST",
          body: { event_id: state.currentEvent.id }
        });

        $("confirm-modal").style.display = "none";
        $("event-details-modal").style.display = "none";
        showToast("האירוע נמחק", "info");
        await loadEvents();
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, "error");
      }
    }
  );
}

// ─── Toggle Event Status ────────────────────────

async function toggleEventStatus() {
  if (!state.currentEvent) return;

  const newStatus = state.currentEvent.status === 'open' ? 'closed' : 'open';
  const actionText = newStatus === 'closed' ? 'לסגור' : 'לפתוח מחדש';

  showConfirm(
    newStatus === 'closed' ? "סגירת הרשמה" : "פתיחת הרשמה",
    `האם ${actionText} את ההרשמה לאירוע "${state.currentEvent.title}"?`,
    async () => {
      try {
        await api("/api/events/status", {
          method: "POST",
          body: { event_id: state.currentEvent.id, status: newStatus }
        });

        $("confirm-modal").style.display = "none";
        state.currentEvent.status = newStatus;
        showToast(newStatus === 'closed' ? "ההרשמה נסגרה" : "ההרשמה נפתחה מחדש", "success");

        // Refresh
        await loadEvents();
        await openEventDetails(state.currentEvent);
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, "error");
      }
    }
  );
}

// ─── Delete Worker ───────────────────────────────

async function deleteWorker(workerId, workerName) {
  showConfirm(
    "מחיקת עובד",
    `האם למחוק את "${workerName}" מהמערכת?\n\nכל ההיסטוריה שלו תימחק. לא ניתן לבטל.`,
    async () => {
      try {
        await api("/api/workers/delete", {
          method: "POST",
          body: { worker_id: parseInt(workerId) }
        });

        $("confirm-modal").style.display = "none";
        showToast("העובד נמחק", "info");
        await openWorkersModal(); // Refresh the list
        await loadEvents(); // Refresh events (counts may change)
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, "error");
      }
    }
  );
}

// ─── Workers Modal ──────────────────────────────

async function openWorkersModal() {
  $("workers-modal").style.display = "flex";

  try {
    const data = await api("/api/workers/list");
    const workers = data.workers || [];
    const list = $("workers-list");
    const empty = $("workers-empty");

    if (workers.length === 0) {
      list.style.display = "none";
      empty.style.display = "block";
      return;
    }

    list.style.display = "flex";
    empty.style.display = "none";
    list.innerHTML = "";

    for (const w of workers) {
      const card = document.createElement("div");
      card.className = "worker-card";
      card.innerHTML = `
        <div class="signup-avatar">${escapeHtml(getInitial(w.name))}</div>
        <div class="worker-info">
          <div class="worker-name">${escapeHtml(w.name)}</div>
          ${w.phone ? `<div class="worker-phone">📞 ${escapeHtml(w.phone)}</div>` : ''}
        </div>
        <div class="worker-stats">
          <div class="worker-stat">
            <div class="worker-stat-value">${w.total_events || 0}</div>
            <div class="worker-stat-label">אירועים</div>
          </div>
          ${w.total_cancellations > 0 ? `
            <div class="worker-stat ${w.total_cancellations > 2 ? 'warning' : ''}">
              <div class="worker-stat-value">${w.total_cancellations}</div>
              <div class="worker-stat-label">ביטולים</div>
            </div>
          ` : ''}
          ${w.last_minute_cancellations > 0 ? `
            <div class="worker-stat warning">
              <div class="worker-stat-value">${w.last_minute_cancellations}</div>
              <div class="worker-stat-label">רגע אחרון</div>
            </div>
          ` : ''}
        </div>
        <button class="btn-action btn-reject" data-worker-id="${w.id}" data-worker-name="${escapeHtml(w.name)}" title="מחק עובד">🗑</button>
      `;
      list.appendChild(card);
    }

    // Bind delete buttons
    list.querySelectorAll("[data-worker-id]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const workerId = btn.dataset.workerId;
        const workerName = btn.dataset.workerName;
        deleteWorker(workerId, workerName);
      };
    });
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, "error");
  }
}

// ─── Event Listeners ────────────────────────────

function attachEvents() {
  $("btn-login").onclick = handleLogin;
  $("login-pwd").addEventListener("keypress", e => {
    if (e.key === "Enter") handleLogin();
  });

  $("btn-logout").onclick = logout;
  $("btn-new-event").onclick = openNewEventModal;
  $("btn-workers").onclick = openWorkersModal;
  $("btn-save-event").onclick = saveNewEvent;
  $("btn-copy-link").onclick = copyShareLink;

  $("btn-share-event").onclick = () => {
    if (state.currentEvent) {
      $("event-details-modal").style.display = "none";
      showShareLink(state.currentEvent.share_id);
    }
  };

  $("btn-delete-event").onclick = deleteEvent;
  $("btn-toggle-status").onclick = toggleEventStatus;

  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.onclick = () => setFilter(tab.dataset.filter);
  });

  document.querySelectorAll(".signup-tab").forEach(tab => {
    tab.onclick = () => setSignupTab(tab.dataset.status);
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.onclick = () => $(btn.dataset.close).style.display = "none";
  });

  document.querySelectorAll(".modal-backdrop").forEach(bd => {
    bd.onclick = (e) => {
      if (e.target === bd) bd.style.display = "none";
    };
  });
}

// ─── Init ───────────────────────────────────────

window.addEventListener("DOMContentLoaded", async () => {
  attachEvents();

  if (state.token) {
    try {
      await enterApp();
    } catch {
      logout();
    }
  }
});
