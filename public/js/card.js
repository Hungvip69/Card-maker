import { renderCard } from '/js/render.js';
import { t, applyI18n, getLang } from '/js/i18n.js';

const id = location.pathname.split('/').pop();

const loading = document.getElementById('loading');
const content = document.getElementById('content');
const errorState = document.getElementById('errorState');
const lockedState = document.getElementById('lockedState');
const cardEl = document.getElementById('card');

function showError(titleKey, msgKey) {
  loading.hidden = true; content.hidden = true; if (lockedState) lockedState.hidden = true;
  errorState.hidden = false;
  document.getElementById('errTitle').textContent = t(titleKey);
  document.getElementById('errMsg').textContent = t(msgKey);
}

function fmtDuration(ms) {
  if (ms <= 0) return '';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days}${t('time.days')}${hours ? ` ${hours}${t('time.hours')}` : ''}`;
  if (hours >= 1) return `${hours}${t('time.hours')}`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}${t('time.mins')}`;
}

let lockTimer = 0;
function showLocked(openAt) {
  loading.hidden = true; content.hidden = true; errorState.hidden = true;
  lockedState.hidden = false;
  const elIn = document.getElementById('lockCountdown');
  const tick = () => {
    const left = openAt - Date.now();
    if (left <= 0) { clearInterval(lockTimer); load(); return; }
    elIn.textContent = `${t('view.locked.in')} ${fmtDuration(left)}`;
  };
  tick();
  lockTimer = setInterval(tick, 30_000);
}

async function load() {
  try {
    const res = await fetch(`/api/cards/${encodeURIComponent(id)}`);
    if (res.status === 404) return showError('view.gone.h', 'view.gone.p');
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();

    if (data.locked) { showLocked(data.openAt); return; }

    const p = data.payload;
    p.recipientLabel = t('to');
    renderCard(cardEl, p);
    document.getElementById('expiry').textContent = fmtExpiry(data.expiresAt);
    if (p.title) document.title = p.title;
    if (p.allowReplies !== false) document.getElementById('replyBox').hidden = false;
    if (p.music) mountMusic(p.music);
    if (p.allowReactions !== false) mountReactions();
    if (p.guestbook === true) loadGuestbook();

    loading.hidden = true; content.hidden = false;
    fetch(`/api/cards/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
  } catch {
    showError('view.gone.h', 'view.gone.p');
  }
}

function fmtExpiry(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return '';
  return `${t('mn.left')} ${fmtDuration(ms)}`;
}

// ---------- Nhạc nền: nhúng an toàn YouTube/Spotify ----------
// Trình duyệt chặn autoplay CÓ TIẾNG khi chưa tương tác, nhưng cho autoplay TẮT TIẾNG.
// Nên: nhúng autoplay+muted (tự chạy ngay), rồi tự bật tiếng vào lần người nhận
// chạm/cuộn/bấm phím đầu tiên — không cần nút, không phiền mỗi lần vào.
function mountMusic(url) {
  const slot = document.getElementById('musicSlot');
  if (!slot) return;
  const embed = musicEmbed(url);
  if (!embed) return;

  const isYouTube = embed.includes('youtube-nocookie.com');
  slot.innerHTML = `<iframe id="musicFrame" src="${embed}" `
    + `allow="autoplay; encrypted-media; fullscreen; picture-in-picture" `
    + `referrerpolicy="strict-origin-when-cross-origin" `
    + `loading="lazy" allowfullscreen></iframe>`;
  slot.hidden = false;

  if (!isYouTube) return; // Spotify tự xử lý player của nó

  const frame = document.getElementById('musicFrame');
  // Bật tiếng YouTube qua postMessage API (iframe đang muted ở URL).
  const unmute = () => {
    try {
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
    } catch {}
  };
  // Lần tương tác đầu tiên bất kỳ -> bật tiếng, rồi gỡ listener.
  const events = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'click'];
  const onFirst = () => {
    unmute();
    events.forEach((e) => window.removeEventListener(e, onFirst));
  };
  events.forEach((e) => window.addEventListener(e, onFirst, { once: false, passive: true }));
}

// Dựng URL nhúng YouTube. autoplay+mute để trình duyệt cho tự phát (autoplay có tiếng
// bị chặn khi chưa tương tác; muted thì được phép). Sau đó JS tự bật tiếng khi người
// nhận chạm/cuộn. enablejsapi để gửi lệnh unMute qua postMessage. loop+playlist để lặp.
function ytEmbed(videoId) {
  const id = encodeURIComponent(videoId);
  const origin = encodeURIComponent(location.origin);
  return `https://www.youtube-nocookie.com/embed/${id}`
    + `?origin=${origin}&enablejsapi=1&rel=0&autoplay=1&mute=1&loop=1&playlist=${id}`;
}

// Chỉ chấp nhận YouTube & Spotify; trả về URL nhúng đã chuẩn hóa, ngược lại null.
function musicEmbed(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = u.searchParams.get('v');
    return v ? ytEmbed(v) : null;
  }
  if (host === 'youtu.be') {
    const v = u.pathname.slice(1);
    return v ? ytEmbed(v) : null;
  }
  if (host === 'open.spotify.com') {
    return `https://open.spotify.com/embed${u.pathname}`;
  }
  return null;
}

// ---------- Tải PNG ----------
document.getElementById('downloadBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget; const old = btn.innerHTML;
  btn.disabled = true; btn.textContent = '…';
  try {
    cardEl.querySelectorAll('.fx-piece').forEach((p) => (p.style.animationPlayState = 'paused'));
    const dataUrl = await window.htmlToImage.toPng(cardEl, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement('a'); a.download = 'card.png'; a.href = dataUrl; a.click();
  } catch {
    toast(t('view.dlFail'));
  } finally {
    cardEl.querySelectorAll('.fx-piece').forEach((p) => (p.style.animationPlayState = ''));
    btn.disabled = false; btn.innerHTML = old;
  }
});

// ---------- Gửi lời nhắn ----------
const sendBtn = document.getElementById('sendReply');
if (sendBtn) {
  sendBtn.addEventListener('click', async () => {
    const body = document.getElementById('replyBody').value.trim();
    const sender = document.getElementById('replySender').value.trim();
    if (!body) { toast(t('view.replyEmpty')); return; }
    sendBtn.disabled = true; sendBtn.textContent = t('view.reply.sending');
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(id)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, sender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'fail');
      document.getElementById('replyForm').hidden = true;
      document.getElementById('replySent').hidden = false;
      loadGuestbook(); // cập nhật sổ lưu bút nếu đang bật
    } catch {
      toast(t('view.dlFail')); sendBtn.disabled = false; sendBtn.textContent = t('view.reply.send');
    }
  });
}

// ---------- Reaction (#11) ----------
const REACTION_SET = ['❤️', '🎉', '😍', '👏', '🥹', '🔥', '🌸', '😂'];
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function mountReactions() {
  const bar = document.getElementById('reactBar');
  const btns = document.getElementById('reactBtns');
  if (!bar || !btns) return;
  let counts = {};
  try { counts = (await (await fetch(`/api/cards/${encodeURIComponent(id)}/reactions`)).json()).counts || {}; } catch {}

  const draw = () => {
    btns.innerHTML = REACTION_SET.map((e) =>
      `<button type="button" class="react-btn" data-emoji="${e}">${e}<span class="rc">${counts[e] || ''}</span></button>`
    ).join('');
  };
  draw();
  bar.hidden = false;

  btns.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.react-btn'); if (!b) return;
    const emoji = b.dataset.emoji;
    b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 300);
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(id)}/reactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (res.ok && data.counts) { counts = data.counts; draw(); }
    } catch {}
  });
}

// ---------- Sổ lưu bút (#10) ----------
async function loadGuestbook() {
  const box = document.getElementById('guestbook');
  const list = document.getElementById('gbList');
  if (!box || !list) return;
  try {
    const data = await (await fetch(`/api/cards/${encodeURIComponent(id)}/messages`)).json();
    if (!data.guestbook) return;
    box.hidden = false;
    if (!data.messages.length) { list.innerHTML = `<div class="gb-empty">—</div>`; return; }
    list.innerHTML = data.messages.map((m) => `
      <div class="gb-item">
        <span class="gb-name">${m.sender ? esc(m.sender) : '•'}</span>
        <span class="gb-body">${esc(m.body)}</span>
      </div>
    `).join('');
  } catch {}
}

// ---------- Toast ----------
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ---------- i18n ----------
applyI18n();
window.addEventListener('langchange', () => { applyI18n(); load(); });

load();
