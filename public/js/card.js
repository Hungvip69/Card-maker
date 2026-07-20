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
    mountReplyCard(p);
    if (p.music) mountMusic(p.music);
    if (p.allowReactions !== false) mountReactions();
    if (p.guestbook === true) loadGuestbook();

    loading.hidden = true; content.hidden = false;
    mountSpeak(p);
    mountShare(p);
    // Chuỗi mở: nếu có phong bì thì reveal/burst chạy SAU khi mở bao thư; nếu không thì chạy ngay.
    const onOpen = () => { if (p.reveal) revealText(); if (p.burst) burstConfetti(p); };
    if (p.envelope === true) mountEnvelope(p, onOpen);
    else onOpen();
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

// ---------- Thiệp phản hồi ----------
// Nút "Gửi thiệp đáp lại" mở /create với vai đảo ngược điền sẵn qua query param.
// Editor đọc reply=1&to=&from= để prefill (tạo thiệp MỚI, không clone token cũ).
function mountReplyCard(p) {
  const box = document.getElementById('replyBox');
  if (!box) return;
  const btn = document.createElement('a');
  btn.className = 'btn btn-ghost reply-card-btn';
  btn.textContent = t('view.replyCard');
  // người gửi thiệp gốc (p.sender) trở thành người NHẬN của thiệp đáp lại
  const params = new URLSearchParams({ reply: '1' });
  if (p.sender) params.set('to', p.sender);
  if (p.recipient) params.set('from', p.recipient);
  btn.href = `/create?${params.toString()}`;
  box.appendChild(btn);
}

// ---------- Chia sẻ (Web Share API) ----------
// Hiện nút Share nếu trình duyệt hỗ trợ navigator.share (mở share sheet gốc trên mobile).
function mountShare(p) {
  const btn = document.getElementById('shareViewBtn');
  if (!btn || !navigator.share) return;
  btn.hidden = false;
  btn.addEventListener('click', () => {
    navigator.share({ title: p.title || t('view.private'), url: location.href }).catch(() => {});
  });
}

// ---------- Hé lộ chữ từng dòng (typewriter) ----------
// Ẩn tiêu đề + lời nhắn, rồi hiện từng ký tự. Dùng textContent (KHÔNG innerHTML) nên
// giữ nguyên escaping — không mở cửa XSS. Tôn trọng prefers-reduced-motion (hiện ngay).
function revealText() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes = [cardEl.querySelector('.c-title'), cardEl.querySelector('.c-message')].filter(Boolean);
  if (!nodes.length) return;
  if (reduce) return;   // giữ nguyên, không ẩn/hiện

  let delay = 0;
  for (const node of nodes) {
    const full = node.textContent;
    node.textContent = '';
    for (const ch of full) {
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.opacity = '0';
      span.style.transition = `opacity 0.25s ease ${delay}ms`;
      node.appendChild(span);
      // buộc reflow rồi bật hiện
      requestAnimationFrame(() => { span.style.opacity = '1'; });
      delay += ch === ' ' ? 12 : 26;
    }
    delay += 260;   // nghỉ giữa tiêu đề và lời nhắn
  }
}

// ---------- Bắn confetti một lần khi mở ----------
// Tái dùng .fx-piece + màu accent, animation fx-burst rồi tự dọn DOM.
const BURST_COLORS = ['#9f2f2d', '#1f6c9f', '#346538', '#956400', '#b5651d', '#7b4f9a'];
function burstConfetti(p) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.querySelector('.view-card-wrap');
  if (!wrap) return;
  const layer = document.createElement('div');
  layer.className = 'burst-layer'; layer.setAttribute('aria-hidden', 'true');
  wrap.appendChild(layer);
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(p.accent || '') ? p.accent : '#956400';
  const N = 40;
  for (let i = 0; i < N; i++) {
    const piece = document.createElement('span');
    piece.className = 'burst-piece';
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.3;
    const dist = 60 + Math.random() * 120;
    piece.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
    piece.style.setProperty('--by', Math.sin(angle) * dist + 'px');
    piece.style.background = i % 3 === 0 ? accent : BURST_COLORS[i % BURST_COLORS.length];
    piece.style.animationDelay = Math.random() * 0.08 + 's';
    layer.appendChild(piece);
  }
  setTimeout(() => layer.remove(), 1600);
}

// ---------- Đọc thiệp (text-to-speech) ----------
// Dùng Web Speech API (không cần server). Đọc tiêu đề + lời nhắn theo ngôn ngữ hiện tại.
// Bấm lần nữa để dừng. Ẩn nút nếu trình duyệt không hỗ trợ.
function mountSpeak(p) {
  const btn = document.getElementById('speakBtn');
  if (!btn) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;

  const text = [p.title, p.message, p.sender ? `— ${p.sender}` : '']
    .map((s) => (s || '').trim()).filter(Boolean).join('. ');
  if (!text) return;

  const langMap = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' };
  btn.hidden = false;

  const stop = () => { synth.cancel(); btn.classList.remove('speaking'); };
  btn.addEventListener('click', () => {
    if (synth.speaking) { stop(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langMap[getLang()] || 'en-US';
    u.rate = 0.95;
    u.onend = () => btn.classList.remove('speaking');
    u.onerror = () => btn.classList.remove('speaking');
    btn.classList.add('speaking');
    synth.speak(u);
  });
  // dừng đọc khi rời trang
  window.addEventListener('pagehide', stop);
}

// ---------- Mở kiểu phong bì (#7) ----------
// Phủ một bao thư lên trước thiệp; người nhận chạm để mở nắp, bao thư trượt đi lộ thiệp.
// Chỉ trang trí — nội dung thiệp đã có sẵn bên dưới, không phụ thuộc JS để đọc được.
let envelopeMounted = false;
function mountEnvelope(p, onOpen) {
  if (envelopeMounted) return;
  envelopeMounted = true;
  const wrap = document.querySelector('.view-card-wrap');
  if (!wrap) return;

  const accent = /^#[0-9a-fA-F]{3,8}$/.test(p.accent || '') ? p.accent : '#956400';
  const env = document.createElement('div');
  env.className = 'envelope';
  env.setAttribute('role', 'button');
  env.setAttribute('tabindex', '0');
  env.setAttribute('aria-label', t('view.envOpen'));
  env.style.setProperty('--env-accent', accent);
  env.innerHTML = `
    <div class="env-body">
      <div class="env-flap"></div>
      <div class="env-heart">✉</div>
      <div class="env-hint">${esc(t('view.envOpen'))}</div>
    </div>`;
  wrap.appendChild(env);

  const open = () => {
    if (env.classList.contains('opening')) return;
    env.classList.add('opening');
    // gỡ khỏi DOM sau khi animation trượt xong để không chặn tương tác thiệp
    setTimeout(() => env.remove(), 1100);
    if (typeof onOpen === 'function') setTimeout(onOpen, 500);   // reveal/burst sau khi nắp bật
  };
  env.addEventListener('click', open);
  env.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
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
    const scaleSel = document.getElementById('dlScale');
    const pixelRatio = Math.min(3, Math.max(1, Number(scaleSel?.value) || 2));
    const dataUrl = await window.htmlToImage.toPng(cardEl, { pixelRatio, cacheBust: true });
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
