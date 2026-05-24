// ═══════════════════════════════════════════════
// חוזה דיגיטלי - דף עובד
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

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

let state = {
  shareId: null,
  contract: null,
  currentStep: 1,
  signatureCanvas: null,
  signatureCtx: null,
  isDrawing: false,
  hasSignature: false
};

// ─── טעינת החוזה ────────────────────────────────

async function loadContract() {
  // קבל share_id מה-URL
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get('id');

  if (!shareId) {
    showScreen('not-found-screen');
    return;
  }

  state.shareId = shareId;

  try {
    const response = await fetch(`/api/contracts/get?share_id=${shareId}`);
    const data = await response.json();

    if (!response.ok || !data.contract) {
      showScreen('not-found-screen');
      return;
    }

    state.contract = data.contract;

    if (data.contract.status === 'completed') {
      showScreen('already-signed-screen');
      return;
    }

    // הצג טופס
    showForm();
  } catch (error) {
    console.error('Load contract error:', error);
    showScreen('not-found-screen');
  }
}

function showScreen(screenId) {
  ['loading-screen', 'not-found-screen', 'already-signed-screen', 'form-screen', 'success-screen'].forEach(id => {
    $(id).style.display = 'none';
  });
  $(screenId).style.display = '';
}

function showForm() {
  showScreen('form-screen');
  $('form-screen').style.display = 'block';

  // הצג פרטי מעסיק
  const employer = state.contract.employer;
  if (employer) {
    $('employer-name').textContent = employer.name;

    let details = '';
    if (employer.business_id) details += `<div>ח.פ.: ${escapeHtml(employer.business_id)}</div>`;
    if (employer.address) details += `<div>כתובת: ${escapeHtml(employer.address)}</div>`;
    if (employer.phone) details += `<div>טלפון: ${escapeHtml(employer.phone)}</div>`;
    $('employer-details').innerHTML = details;
  }

  // אם יש נתונים שכבר נשמרו - מלא אותם
  if (state.contract.contract_data && state.contract.contract_data.length > 0) {
    const cd = state.contract.contract_data[0];
    if (cd.first_name) $('first_name').value = cd.first_name;
    if (cd.last_name) $('last_name').value = cd.last_name;
    if (cd.id_number) $('id_number').value = cd.id_number;
    if (cd.birth_date) $('birth_date').value = cd.birth_date;
    if (cd.street) $('street').value = cd.street;
    if (cd.city) $('city').value = cd.city;
    if (cd.zip_code) $('zip_code').value = cd.zip_code;
    if (cd.mobile_phone) $('mobile_phone').value = cd.mobile_phone;
    if (cd.email) $('email').value = cd.email;
    if (cd.bank_name) $('bank_name').value = cd.bank_name;
    if (cd.bank_branch) $('bank_branch').value = cd.bank_branch;
    if (cd.bank_account) $('bank_account').value = cd.bank_account;
    if (cd.marital_status) $('marital_status').value = cd.marital_status;
    if (cd.health_fund) $('health_fund').value = cd.health_fund;
    if (cd.emergency_contact_name) $('emergency_contact_name').value = cd.emergency_contact_name;
    if (cd.emergency_contact_phone) $('emergency_contact_phone').value = cd.emergency_contact_phone;
  } else if (state.contract.employee_name) {
    // אם אין נתונים אבל יש שם מהאדמין - פצל אותו
    const parts = state.contract.employee_name.trim().split(/\s+/);
    if (parts.length >= 1) $('first_name').value = parts[0];
    if (parts.length >= 2) $('last_name').value = parts.slice(1).join(' ');
  }

  if (state.contract.employee_phone) {
    $('mobile_phone').value = state.contract.employee_phone;
  }
}

// ─── ניווט בין שלבים ────────────────────────────

function goToStep(step) {
  // ולידציה - שלב 1 → 2
  if (state.currentStep === 1 && step === 2) {
    if (!validateStep1()) return;
  }

  // עדכן את האינדיקטור
  for (let i = 1; i <= 3; i++) {
    const dot = $(`step-${i}`);
    dot.classList.remove('active', 'completed');
    if (i < step) dot.classList.add('completed');
    if (i === step) dot.classList.add('active');
  }

  // הצג את החלק הנכון
  $('section-personal').style.display = step === 1 ? '' : 'none';
  $('section-bank').style.display = step === 2 ? '' : 'none';
  $('section-signature').style.display = step === 3 ? '' : 'none';

  state.currentStep = step;

  // גלול למעלה
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // אם הגענו לשלב 3 - אתחל את הקנבס לחתימה
  if (step === 3) {
    setTimeout(initSignaturePad, 100);
  }
}

function validateStep1() {
  const required = [
    { id: 'first_name', label: 'שם פרטי' },
    { id: 'last_name', label: 'שם משפחה' },
    { id: 'id_number', label: 'תעודת זהות' },
    { id: 'mobile_phone', label: 'טלפון נייד' }
  ];

  for (const field of required) {
    const value = $(field.id).value.trim();
    if (!value) {
      showToast(`חסר: ${field.label}`, 'error');
      $(field.id).focus();
      return false;
    }
  }

  // בדוק ת.ז.
  const idNumber = $('id_number').value.trim();
  if (!/^\d{5,9}$/.test(idNumber)) {
    showToast('תעודת זהות לא תקינה', 'error');
    $('id_number').focus();
    return false;
  }

  return true;
}

// ─── חתימה דיגיטלית ─────────────────────────────

function initSignaturePad() {
  const canvas = $('signature-pad');
  if (!canvas) return;

  // התאם רוחב לאלמנט
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 200;

  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  state.signatureCanvas = canvas;
  state.signatureCtx = ctx;
  state.isDrawing = false;
  state.hasSignature = false;

  // אירועי עכבר
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  // אירועי מגע (לטלפון)
  canvas.addEventListener('touchstart', handleTouch, { passive: false });
  canvas.addEventListener('touchmove', handleTouch, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);
}

function getPosition(e) {
  const rect = state.signatureCanvas.getBoundingClientRect();
  const scaleX = state.signatureCanvas.width / rect.width;
  const scaleY = state.signatureCanvas.height / rect.height;

  if (e.touches && e.touches.length > 0) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY
    };
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  state.isDrawing = true;
  state.hasSignature = true;
  const pos = getPosition(e);
  state.signatureCtx.beginPath();
  state.signatureCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!state.isDrawing) return;
  const pos = getPosition(e);
  state.signatureCtx.lineTo(pos.x, pos.y);
  state.signatureCtx.stroke();
}

function stopDrawing() {
  state.isDrawing = false;
}

function handleTouch(e) {
  e.preventDefault();
  if (e.type === 'touchstart') startDrawing(e);
  else if (e.type === 'touchmove') draw(e);
}

function clearSignature() {
  if (!state.signatureCtx) return;
  state.signatureCtx.clearRect(0, 0, state.signatureCanvas.width, state.signatureCanvas.height);
  state.hasSignature = false;
}

// ─── הגשת החוזה ─────────────────────────────────

async function submitContract() {
  if (!state.hasSignature) {
    $('submit-error').textContent = 'חתום קודם';
    return;
  }

  $('submit-error').textContent = '';
  $('btn-submit').disabled = true;
  $('btn-submit').textContent = 'שולח...';

  try {
    // המר את החתימה ל-base64
    const signatureData = state.signatureCanvas.toDataURL('image/png');

    const payload = {
      share_id: state.shareId,
      first_name: $('first_name').value.trim(),
      last_name: $('last_name').value.trim(),
      id_number: $('id_number').value.trim(),
      birth_date: $('birth_date').value || null,
      street: $('street').value.trim(),
      city: $('city').value.trim(),
      zip_code: $('zip_code').value.trim(),
      mobile_phone: $('mobile_phone').value.trim(),
      email: $('email').value.trim(),
      bank_name: $('bank_name').value.trim(),
      bank_branch: $('bank_branch').value.trim(),
      bank_account: $('bank_account').value.trim(),
      marital_status: $('marital_status').value,
      health_fund: $('health_fund').value,
      emergency_contact_name: $('emergency_contact_name').value.trim(),
      emergency_contact_phone: $('emergency_contact_phone').value.trim(),
      signature_data: signatureData
    };

    const response = await fetch('/api/contracts/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'שגיאה');
    }

    showScreen('success-screen');
  } catch (error) {
    console.error('Submit error:', error);
    $('submit-error').textContent = `שגיאה: ${error.message}`;
    $('btn-submit').disabled = false;
    $('btn-submit').textContent = '✓ שלח חתום';
  }
}

// ─── אתחול ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadContract);
