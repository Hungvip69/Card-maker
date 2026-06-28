import { renderCard } from '/js/render.js';
import { t, applyI18n } from '/js/i18n.js';

const token = location.pathname.split('/').pop();

const loading = document.getElementById('loading');
const content = document.getElementById('content');
const errorState = document.getElementById('errorState');
const deletedState = document.getElementById('deletedState');

let lastData = null;

function showError() {
  loading.hidden = true; content.hidden = true; errorState.hidden = false;
  document.getElementById('errTitle').textContent = t('mn.invalid.h');
  document.getElementById('errMsg').textContent = t('mn.invalid.p');
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtExpiry(expiresAt, expired) {
  if (expired) return t('mn.expired');
  const ms = expiresAt - Date.now();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const left = days >= 1 ? `${days}${t('time.days')}${hours ? ` ${hours}${t('time.hours')}` : ''}` : `${Math.max(1, hours)}${t('time.hours')}`;
  return `${t('mn.left')} ${left} · ${t('mn.expiresAt')} ${fmtDate(expiresAt)}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function load() {
  try {
    const res = await fetch(`/api/manage/${encodeURIComponent(token)}`);
    if (res.status === 404) return showError();
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    lastData = data;
    render(data);
    loading.hidden = true; content.hidden = false;
  } catch {
    showError();
  }
}

function render(data) {
  const p = data.payload;
  p.recipientLabel = t('to');
  renderCard(document.getElementById('card'), p);
  document.getElementById('mTitle').textContent = p.title || t('mn.title');
  document.getElementById('mExpiry').textContent = fmtExpiry(data.expiresAt, data.expired);
  document.getElementById('sViews').textContent = String(data.views);
  document.getElementById('sMsgs').textContent = String(data.messages.length);
  document.getElementById('shareLink').value = `${location.origin}/c/${data.id}`;
  renderMessages(data.messages);
}

function renderMessages(messages) {
  const list = document.getElementById('msgList');
  const sub = document.getElementById('msgSub');
  if (!messages.length) {
    sub.textContent = t('mn.noMsgs');
    list.innerHTML = `<div class="empty-msgs">${t('mn.emptyBox')}</div>`;
    return;
  }
  sub.textContent = `${messages.length} · ${t('mn.received')}`;
  list.innerHTML = messages.map((m) => `
    <div class="msg">
      <div class="who">
        <span class="name">${m.sender ? esc(m.sender) : t('mn.anon')}</span>
        <span class="when">${fmtDate(m.created_at)}</span>
      </div>
      <div class="body">${esc(m.body)}</div>
    </div>
  `).join('');
}

document.getElementById('copyShare').addEventListener('click', async (e) => {
  const input = document.getElementById('shareLink');
  try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
  const b = e.currentTarget; const old = b.textContent; b.textContent = t('mn.copied');
  setTimeout(() => (b.textContent = old), 1400);
});

// Sửa: mở editor với token để nạp lại payload cũ.
document.getElementById('editBtn').addEventListener('click', () => {
  location.href = `/create?edit=${encodeURIComponent(token)}`;
});

// Nhân bản (#4): mở editor nạp nội dung nhưng tạo thiệp mới.
document.getElementById('cloneBtn').addEventListener('click', () => {
  location.href = `/create?clone=${encodeURIComponent(token)}`;
});

// Gia hạn +7 ngày.
document.getElementById('extendBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget; const old = btn.textContent;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/manage/${encodeURIComponent(token)}/extend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'fail');
    if (lastData) { lastData.expiresAt = data.expiresAt; lastData.expired = false; render(lastData); }
    btn.textContent = t('mn.extended');
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1600);
  } catch {
    toast(t('mn.extendFail')); btn.textContent = old; btn.disabled = false;
  }
});

document.getElementById('deleteBtn').addEventListener('click', async (e) => {
  if (!confirm(t('mn.confirm'))) return;
  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = t('mn.deleting');
  try {
    const res = await fetch(`/api/manage/${encodeURIComponent(token)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    content.hidden = true; deletedState.hidden = false;
  } catch {
    toast(t('mn.deleteFail')); btn.disabled = false; btn.textContent = t('mn.delete');
  }
});

let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

applyI18n();
window.addEventListener('langchange', () => { applyI18n(); if (lastData) render(lastData); });

load();
