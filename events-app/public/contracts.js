// ═══════════════════════════════════════════════
// ניהול חוזים - אדמין
// ═══════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

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

let state = {
  token: null,
  employers: [],
  contracts: [],
  currentFilter: 'pending',
  currentContract: null
};

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  confirmCallback = onConfirm;
  $("confirm-modal").style.display = "flex";
}

// ─── API Helper ─────────────────────────────────

async function api(path, opts = {}) {
  const options = {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
      ...(opts.headers || {})
    }
  };

  if (opts.body) options.body = JSON.stringify(opts.body);

  const response = await fetch(path, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `שגיאה ${response.status}`);
  }

  return data;
}

// ─── התחברות ────────────────────────────────────

async function login() {
  const password = $('login-pwd').value;
  if (!password) {
    $('login-error').textContent = 'יש להזין סיסמה';
    return;
  }

  $('login-error').textContent = '';
  $('btn-login').disabled = true;

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { password }
    });

    state.token = data.token;
    localStorage.setItem('admin_token', data.token);

    $('screen-login').style.display = 'none';
    $('screen-app').style.display = '';
    $('login-pwd').value = '';

    await loadAll();
  } catch (e) {
    $('login-error').textContent = e.message;
  } finally {
    $('btn-login').disabled = false;
  }
}

function logout() {
  state.token = null;
  localStorage.removeItem('admin_token');
  $('screen-app').style.display = 'none';
  $('screen-login').style.display = '';
}

function tryAutoLogin() {
  const saved = localStorage.getItem('admin_token');
  if (saved) {
    state.token = saved;
    $('screen-login').style.display = 'none';
    $('screen-app').style.display = '';
    loadAll().catch(() => logout());
  }
}

// ─── טעינת נתונים ──────────────────────────────

async function loadAll() {
  await Promise.all([loadEmployers(), loadContracts()]);
}

async function loadEmployers() {
  try {
    const data = await api('/api/employers/list');
    state.employers = data.employers || [];
  } catch (e) {
    showToast(`שגיאה בטעינת מעסיקים: ${e.message}`, 'error');
  }
}

async function loadContracts() {
  try {
    const data = await api('/api/contracts/list');
    state.contracts = data.contracts || [];
    renderContracts();
  } catch (e) {
    showToast(`שגיאה בטעינת חוזים: ${e.message}`, 'error');
  }
}

// ─── תצוגת חוזים ───────────────────────────────

function renderContracts() {
  const list = $('contracts-list');
  const empty = $('contracts-empty');

  let filtered = state.contracts;
  if (state.currentFilter === 'pending') {
    filtered = state.contracts.filter(c => c.status === 'pending');
  } else if (state.currentFilter === 'completed') {
    filtered = state.contracts.filter(c => c.status === 'completed');
  }

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  for (const contract of filtered) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const statusBadge = contract.status === 'completed'
      ? '<span class="status-badge status-completed">✓ חתום</span>'
      : '<span class="status-badge status-pending">⏳ ממתין</span>';

    const employerName = contract.employer?.name || 'ללא מעסיק';
    const dateStr = new Date(contract.created_at).toLocaleDateString('he-IL');

    card.innerHTML = `
      <div class="item-card-body">
        <div class="item-card-title">${escapeHtml(contract.employee_name)} ${statusBadge}</div>
        <div class="item-card-sub">
          🏢 ${escapeHtml(employerName)} • 📅 ${dateStr}
          ${contract.employee_phone ? ` • 📞 ${escapeHtml(contract.employee_phone)}` : ''}
        </div>
      </div>
      <div class="item-card-actions">
        ${contract.status === 'pending' ? `
          <button class="btn-secondary" data-share-link="${contract.share_id}">📋 קישור</button>
        ` : ''}
        <button class="btn-primary" data-view-id="${contract.id}">פרטים</button>
      </div>
    `;
    list.appendChild(card);
  }

  // bind buttons
  list.querySelectorAll('[data-share-link]').forEach(btn => {
    btn.onclick = () => showContractLink(btn.dataset.shareLink);
  });

  list.querySelectorAll('[data-view-id]').forEach(btn => {
    btn.onclick = () => openContractDetails(parseInt(btn.dataset.viewId));
  });
}

function setFilter(filter) {
  state.currentFilter = filter;
  document.querySelectorAll('.contracts-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  renderContracts();
}

// ─── מעסיקים - תצוגה ───────────────────────────

function openEmployersModal() {
  renderEmployers();
  $('employers-modal').style.display = 'flex';
}

function renderEmployers() {
  const list = $('employers-list');
  const empty = $('employers-empty');

  if (state.employers.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  for (const emp of state.employers) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-card-body">
        <div class="item-card-title">${escapeHtml(emp.name)}</div>
        <div class="item-card-sub">
          ${emp.business_id ? `ח.פ. ${escapeHtml(emp.business_id)}` : ''}
          ${emp.tax_file_number ? ` • תיק ניכויים: ${escapeHtml(emp.tax_file_number)}` : ''}
          ${emp.phone ? ` • 📞 ${escapeHtml(emp.phone)}` : ''}
        </div>
      </div>
      <div class="item-card-actions">
        <button class="btn-secondary" data-edit-id="${emp.id}">ערוך</button>
        <button class="btn-danger" data-delete-id="${emp.id}" data-name="${escapeHtml(emp.name)}">🗑</button>
      </div>
    `;
    list.appendChild(card);
  }

  // bind buttons
  list.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.onclick = () => editEmployer(parseInt(btn.dataset.editId));
  });

  list.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.onclick = () => deleteEmployer(parseInt(btn.dataset.deleteId), btn.dataset.name);
  });
}

// ─── מעסיק - יצירה/עריכה ─────────────────────────

function newEmployer() {
  $('employer-id').value = '';
  $('employer-edit-title').textContent = 'מעסיק חדש';
  $('emp-name').value = '';
  $('emp-business-id').value = '';
  $('emp-tax-file').value = '';
  $('emp-address').value = '';
  $('emp-phone').value = '';
  $('emp-contact-name').value = '';
  $('emp-contact-phone').value = '';
  $('employer-error').textContent = '';
  $('employer-edit-modal').style.display = 'flex';
}

function editEmployer(id) {
  const emp = state.employers.find(e => e.id === id);
  if (!emp) return;

  $('employer-id').value = emp.id;
  $('employer-edit-title').textContent = 'עריכת מעסיק';
  $('emp-name').value = emp.name || '';
  $('emp-business-id').value = emp.business_id || '';
  $('emp-tax-file').value = emp.tax_file_number || '';
  $('emp-address').value = emp.address || '';
  $('emp-phone').value = emp.phone || '';
  $('emp-contact-name').value = emp.contact_name || '';
  $('emp-contact-phone').value = emp.contact_phone || '';
  $('employer-error').textContent = '';
  $('employer-edit-modal').style.display = 'flex';
}

async function saveEmployer() {
  const name = $('emp-name').value.trim();
  if (!name) {
    $('employer-error').textContent = 'שם החברה חובה';
    return;
  }

  $('employer-error').textContent = '';
  $('btn-save-employer').disabled = true;

  try {
    const payload = {
      name,
      business_id: $('emp-business-id').value.trim(),
      tax_file_number: $('emp-tax-file').value.trim(),
      address: $('emp-address').value.trim(),
      phone: $('emp-phone').value.trim(),
      contact_name: $('emp-contact-name').value.trim(),
      contact_phone: $('emp-contact-phone').value.trim()
    };

    const id = $('employer-id').value;
    if (id) payload.id = parseInt(id);

    await api('/api/employers/save', {
      method: 'POST',
      body: payload
    });

    $('employer-edit-modal').style.display = 'none';
    showToast(id ? 'המעסיק עודכן' : 'המעסיק נוסף', 'success');
    await loadEmployers();
    renderEmployers();
  } catch (e) {
    $('employer-error').textContent = e.message;
  } finally {
    $('btn-save-employer').disabled = false;
  }
}

function deleteEmployer(id, name) {
  showConfirm(
    'מחיקת מעסיק',
    `האם למחוק את "${name}"? לא ניתן לבטל.`,
    async () => {
      try {
        await api('/api/employers/delete', {
          method: 'POST',
          body: { employer_id: id }
        });
        $('confirm-modal').style.display = 'none';
        showToast('המעסיק נמחק', 'info');
        await loadEmployers();
        renderEmployers();
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, 'error');
      }
    }
  );
}

// ─── שליחת חוזה לעובד ───────────────────────────

function openNewContract() {
  if (state.employers.length === 0) {
    showToast('יש להוסיף קודם מעסיק', 'error');
    openEmployersModal();
    return;
  }

  $('contract-employee-name').value = '';
  $('contract-employee-phone').value = '';
  $('contract-error').textContent = '';

  // מלא את ה-select של המעסיקים
  const select = $('contract-employer-select');
  select.innerHTML = '<option value="">בחר מעסיק...</option>';
  for (const emp of state.employers) {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = emp.name;
    select.appendChild(option);
  }

  $('new-contract-modal').style.display = 'flex';
}

async function createContract() {
  const name = $('contract-employee-name').value.trim();
  const phone = $('contract-employee-phone').value.trim();
  const employerId = $('contract-employer-select').value;

  if (!name) {
    $('contract-error').textContent = 'שם העובד חובה';
    return;
  }
  if (!employerId) {
    $('contract-error').textContent = 'יש לבחור מעסיק';
    return;
  }

  $('contract-error').textContent = '';
  $('btn-create-contract').disabled = true;

  try {
    const data = await api('/api/contracts/create', {
      method: 'POST',
      body: {
        employee_name: name,
        employee_phone: phone,
        employer_id: parseInt(employerId)
      }
    });

    $('new-contract-modal').style.display = 'none';
    showToast('הקישור נוצר!', 'success');
    showContractLink(data.contract.share_id);
    await loadContracts();
  } catch (e) {
    $('contract-error').textContent = e.message;
  } finally {
    $('btn-create-contract').disabled = false;
  }
}

function showContractLink(shareId) {
  const url = `${window.location.origin}/contract.html?id=${shareId}`;
  $('contract-link').value = url;
  $('copy-confirm').textContent = '';

  // שמור את ה-shareId לכפתור WhatsApp
  $('btn-send-contract-whatsapp').setAttribute('data-share-id', shareId);

  $('link-modal').style.display = 'flex';
}

function copyContractLink() {
  const url = $('contract-link').value;
  navigator.clipboard.writeText(url).then(() => {
    $('copy-confirm').textContent = '✓ הקישור הועתק!';
    setTimeout(() => $('copy-confirm').textContent = '', 3000);
  }).catch(() => {
    $('contract-link').select();
    showToast('סמן והעתק ידנית', 'info');
  });
}

function sendContractWhatsApp() {
  const shareId = $('btn-send-contract-whatsapp').dataset.shareId;
  if (!shareId) return;

  const contract = state.contracts.find(c => c.share_id === shareId);
  if (!contract) return;

  const url = `${window.location.origin}/contract.html?id=${shareId}`;
  const employerName = contract.employer?.name || '';

  let message = `שלום ${contract.employee_name}! 👋\n\n`;
  message += `אנא מלא את הטפסים הבאים לקראת תחילת העבודה`;
  if (employerName) message += ` ב${employerName}`;
  message += `:\n\n`;
  message += `📋 פרטים אישיים\n`;
  message += `📄 טופס 101\n`;
  message += `🏥 הצהרת בריאות\n\n`;
  message += `👇 לחץ על הקישור למילוי:\n${url}\n\n`;
  message += `_גלובל - חברת כוח אדם_`;

  // אם יש טלפון לעובד - שלח אליו ישירות
  if (contract.employee_phone) {
    const phone = normalizePhone(contract.employee_phone);
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      return;
    }
  }

  // אחרת - העתק ופתח WhatsApp Web
  navigator.clipboard.writeText(message).then(() => {
    showToast('✅ ההודעה הועתקה! פותח WhatsApp...', 'success');
    setTimeout(() => window.open('https://web.whatsapp.com/', '_blank'), 500);
  }).catch(() => {
    showToast('העתק את הקישור ידנית', 'info');
  });
}

function normalizePhone(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+972')) return clean.substring(1);
  if (clean.startsWith('972')) return clean;
  if (clean.startsWith('0')) return '972' + clean.substring(1);
  return '972' + clean;
}

// ─── פרטי חוזה ─────────────────────────────────

function openContractDetails(contractId) {
  const contract = state.contracts.find(c => c.id === contractId);
  if (!contract) return;

  state.currentContract = contract;

  const body = $('contract-details-body');
  const cd = contract.contract_data?.[0];

  let html = `
    <div style="background:#f9fafb;padding:14px;border-radius:10px;margin-bottom:14px">
      <div style="font-weight:700;color:#1f2937;margin-bottom:8px">פרטי החוזה</div>
      <div style="font-size:13px;color:#4b5563">
        <div>👤 ${escapeHtml(contract.employee_name)}</div>
        <div>🏢 ${escapeHtml(contract.employer?.name || 'לא ידוע')}</div>
        <div>📅 נשלח: ${new Date(contract.created_at).toLocaleString('he-IL')}</div>
        ${contract.signed_at ? `<div>✓ נחתם: ${new Date(contract.signed_at).toLocaleString('he-IL')}</div>` : ''}
      </div>
    </div>
  `;

  if (cd) {
    html += `<h3 class="section-title">פרטים אישיים</h3>`;
    html += `<div style="background:white;border:1px solid #e5e7eb;padding:14px;border-radius:10px;font-size:14px;line-height:1.8">`;
    html += renderField('שם מלא', `${cd.first_name || ''} ${cd.last_name || ''}`);
    html += renderField('ת.ז.', cd.id_number);
    html += renderField('תאריך לידה', cd.birth_date ? new Date(cd.birth_date).toLocaleDateString('he-IL') : null);
    html += renderField('כתובת', [cd.street, cd.city, cd.zip_code].filter(Boolean).join(', '));
    html += renderField('טלפון נייד', cd.mobile_phone);
    html += renderField('אימייל', cd.email);
    html += renderField('מצב משפחתי', cd.marital_status);
    html += renderField('קופת חולים', cd.health_fund);
    html += `</div>`;

    if (cd.bank_name || cd.bank_account) {
      html += `<h3 class="section-title">חשבון בנק</h3>`;
      html += `<div style="background:white;border:1px solid #e5e7eb;padding:14px;border-radius:10px;font-size:14px;line-height:1.8">`;
      html += renderField('בנק', cd.bank_name);
      html += renderField('סניף', cd.bank_branch);
      html += renderField('חשבון', cd.bank_account);
      html += `</div>`;
    }

    if (cd.emergency_contact_name) {
      html += `<h3 class="section-title">איש קשר לחירום</h3>`;
      html += `<div style="background:white;border:1px solid #e5e7eb;padding:14px;border-radius:10px;font-size:14px;line-height:1.8">`;
      html += renderField('שם', cd.emergency_contact_name);
      html += renderField('טלפון', cd.emergency_contact_phone);
      html += `</div>`;
    }

    if (cd.signature_data) {
      html += `<h3 class="section-title">חתימה</h3>`;
      html += `<div style="background:white;border:1px solid #e5e7eb;padding:14px;border-radius:10px;text-align:center">`;
      html += `<img src="${cd.signature_data}" alt="חתימה" style="max-width:100%;max-height:120px">`;
      html += `</div>`;
    }
  } else {
    html += `<p style="text-align:center;color:#6b7280;padding:20px">⏳ העובד עדיין לא מילא את הטפסים</p>`;
  }

  body.innerHTML = html;
  $('contract-details-modal').style.display = 'flex';
}

function renderField(label, value) {
  if (!value) return '';
  return `<div><strong>${label}:</strong> ${escapeHtml(value)}</div>`;
}

function deleteContract() {
  if (!state.currentContract) return;
  const contract = state.currentContract;

  showConfirm(
    'מחיקת חוזה',
    `האם למחוק את החוזה של "${contract.employee_name}"? לא ניתן לבטל.`,
    async () => {
      try {
        await api('/api/contracts/delete', {
          method: 'POST',
          body: { contract_id: contract.id }
        });
        $('confirm-modal').style.display = 'none';
        $('contract-details-modal').style.display = 'none';
        showToast('החוזה נמחק', 'info');
        await loadContracts();
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, 'error');
      }
    }
  );
}

// ─── אירועים ────────────────────────────────────

function attachEvents() {
  $('btn-login').onclick = login;
  $('login-pwd').addEventListener('keypress', e => {
    if (e.key === 'Enter') login();
  });
  $('btn-logout').onclick = logout;

  $('btn-employers').onclick = openEmployersModal;
  $('btn-new-employer').onclick = newEmployer;
  $('btn-save-employer').onclick = saveEmployer;

  $('btn-new-contract').onclick = openNewContract;
  $('btn-create-contract').onclick = createContract;

  $('btn-copy-contract-link').onclick = copyContractLink;
  $('btn-send-contract-whatsapp').onclick = sendContractWhatsApp;

  $('btn-delete-contract').onclick = deleteContract;

  // טאבים
  document.querySelectorAll('.contracts-tab').forEach(tab => {
    tab.onclick = () => setFilter(tab.dataset.filter);
  });

  // סגירת חלונות
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => {
      const modalId = btn.dataset.close;
      $(modalId).style.display = 'none';
    };
  });

  // אישור
  $('btn-confirm-yes').onclick = () => {
    if (confirmCallback) {
      const cb = confirmCallback;
      confirmCallback = null;
      cb();
    }
  };
}

// ─── אתחול ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  tryAutoLogin();
});
