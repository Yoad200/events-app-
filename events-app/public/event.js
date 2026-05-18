// ═══════════════════════════════════════════════
// דף אירוע - לעובדים
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

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HEBREW_DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const ROLE_ICONS = {
  'מלצרים': '🍽️',
  'הקמה/פירוק': '🔨',
  'תפעול אטרקציות': '🎮',
  'דוכני מזון': '🌮',
};

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `יום ${HEBREW_DAYS_FULL[d.getDay()]}, ${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(timeStr) {
  return (timeStr || "").substring(0, 5);
}

let state = {
  shareId: null,
  event: null,
  selectedRole: null,
};

function showSection(id) {
  ["loading", "not-found", "closed", "already-signed", "signup-container", "success"].forEach(s => {
    $(s).style.display = "none";
  });
  $(id).style.display = "block";
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  state.shareId = params.get("id");

  if (!state.shareId) {
    showSection("not-found");
    return;
  }

  try {
    const res = await fetch(`/api/events/get?share_id=${state.shareId}`);
    const data = await res.json();

    if (!res.ok || !data.event) {
      showSection("not-found");
      return;
    }

    state.event = data.event;

    if (state.event.status !== "open") {
      showSection("closed");
      return;
    }

    renderEvent();
    showSection("signup-container");
  } catch (e) {
    showSection("not-found");
  }
}

function renderEvent() {
  const ev = state.event;

  $("ev-title").textContent = ev.title;
  $("ev-date").textContent = formatEventDate(ev.event_date);
  $("ev-hours").textContent = `${formatTime(ev.start_time)} - ${formatTime(ev.end_time)}`;
  $("ev-location").textContent = ev.location;
  $("ev-rate").textContent = `${ev.hourly_rate} ₪ לשעה`;

  if (ev.notes) {
    $("ev-notes-box").style.display = "block";
    $("ev-notes").textContent = ev.notes;
  }

  const grid = $("roles-grid");
  grid.innerHTML = "";

  const roles = [
    { name: 'מלצרים', needed: ev.needed.מלצרים, approved: ev.approved.מלצרים },
    { name: 'הקמה/פירוק', needed: ev.needed['הקמה/פירוק'], approved: ev.approved['הקמה/פירוק'] },
    { name: 'תפעול אטרקציות', needed: ev.needed['תפעול אטרקציות'], approved: ev.approved['תפעול אטרקציות'] },
    { name: 'דוכני מזון', needed: ev.needed['דוכני מזון'], approved: ev.approved['דוכני מזון'] },
  ];

  for (const role of roles) {
    if (role.needed === 0) continue;

    const remaining = role.needed - role.approved;
    const isFull = remaining <= 0;
    let spotsClass = "";
    let spotsText = `${role.needed} מקומות`;

    if (isFull) {
      spotsClass = "full";
      spotsText = "אין מקומות פנויים — אפשר עדיין לרשום, אם יבטלו תיכנס למסלול";
    } else if (remaining <= 2) {
      spotsClass = "few";
      spotsText = `נשארו ${remaining} מקומות`;
    } else {
      spotsText = `${role.needed} מקומות זמינים`;
    }

    const card = document.createElement("div");
    card.className = "role-card";
    card.dataset.role = role.name;
    card.innerHTML = `
      <div>
        <div class="role-card-name">${escapeHtml(role.name)}</div>
        <div class="role-card-spots ${spotsClass}">${spotsText}</div>
      </div>
      <div class="role-card-icon">${ROLE_ICONS[role.name]}</div>
    `;
    card.onclick = () => selectRole(role.name);
    grid.appendChild(card);
  }
}

function selectRole(role) {
  state.selectedRole = role;
  document.querySelectorAll(".role-card").forEach(c => {
    c.classList.toggle("selected", c.dataset.role === role);
  });
  $("signup-form-section").style.display = "block";
  setTimeout(() => $("signup-name").focus(), 100);
}

async function submitSignup() {
  setError("signup-error", "");

  if (!state.selectedRole) {
    setError("signup-error", "בחר תפקיד קודם");
    return;
  }

  const name = $("signup-name").value.trim();
  const phone = $("signup-phone").value.trim();
  const notes = $("signup-notes").value.trim();

  if (!name) { setError("signup-error", "חובה למלא שם"); return; }
  if (name.length < 2) { setError("signup-error", "שם קצר מדי"); return; }

  $("btn-signup").disabled = true;

  try {
    const res = await fetch("/api/events/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        share_id: state.shareId,
        name, phone, notes,
        role: state.selectedRole,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error && data.error.includes("כבר נרשמת")) {
        $("already-signed-msg").textContent = data.error;
        showSection("already-signed");
        return;
      }
      throw new Error(data.error || "שגיאה");
    }

    showSection("success");
  } catch (e) {
    setError("signup-error", String(e.message || e));
    $("btn-signup").disabled = false;
  }
}

$("btn-signup").onclick = submitSignup;

init();
