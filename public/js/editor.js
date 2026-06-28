import { TEMPLATES, PALETTES, defaultsFor, renderCard } from '/js/render.js';
import { t, applyI18n, buildLangSwitcher, getLang } from '/js/i18n.js';
import { initThemeToggle } from '/js/theme.js';

const $ = (s) => document.querySelector(s);

let state = defaultsFor('birthday');
const touched = new Set();
// Token quản lý khi vào /create?edit=<token> — đặt ở đây để dòng dữ liệu rõ ràng;
// chỉ được gán trong maybeLoadExisting() ở cuối file (chế độ sửa, không phải clone).
let editToken = null;

// Bộ emoji/sticker chọn nhanh
const STICKER_SET = ['🎉','🎂','🎈','❤️','✨','🌸','🎁','⭐','🥳','🌟','🍰','💐','🎊','😊','🫶','🌈','🦋','🍀','👑','💖'];

const els = {
  recipient: $('#f-recipient'), title: $('#f-title'), message: $('#f-message'), sender: $('#f-sender'),
  bg: $('#f-bg'), bg2: $('#f-bg2'), fg: $('#f-fg'), accent: $('#f-accent'),
  angle: $('#f-angle'), radius: $('#f-radius'),
  image: $('#f-image'), overlay: $('#f-overlay'), music: $('#f-music'), openat: $('#f-openat'),
  brush: $('#f-brush'), replies: $('#f-replies'),
  guestbook: $('#f-guestbook'), reactions: $('#f-reactions'),
  msgCount: $('#msgCount'), preview: $('#previewCard'), hero: $('#heroCard'),
  imgHint: $('#imgHint'), removeImg: $('#removeImg'), createBtn: $('#createBtn'),
  canvas: $('#drawCanvas'), stage: $('#previewStage'),
  drawTools: $('#drawTools'), drawUndo: $('#drawUndo'),
  drawModeSeg: $('#drawModeSeg'), drawStyleSeg: $('#drawStyleSeg'),
  drawSwatches: $('#drawSwatches'),
  brushSize: $('#f-brush-size'), brushSizeVal: $('#brushSizeVal'),
};

// ---------- Render preview ----------
let rafId = 0;
function draw() {
  cancelAnimationFrame(rafId);
  // Re-render thay toàn bộ node; chỉ số khối chữ đang chọn không còn ý nghĩa -> bỏ chọn.
  selectedTextBlock = null;
  rafId = requestAnimationFrame(() => {
    state.recipientLabel = t('to');
    renderCard(els.preview, state);
    attachInteractions();
  });
}

function toColor(v) {
  if (!v) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return '#' + v.slice(1).split('').map((c) => c + c).join('');
  return '#000000';
}

function setActive(scope, attr, val) {
  document.querySelectorAll(`${scope} button`).forEach((b) => b.classList.toggle('active', b.dataset[attr] === val));
}

function syncConditional() {
  $('#patternField').hidden = state.bgStyle !== 'pattern';
  $('#angleField').hidden = state.bgStyle !== 'gradient';
  $('#bg2Wrap').hidden = state.bgStyle === 'solid';
}

function syncInputsFromState() {
  els.title.value = state.title;
  els.message.value = state.message;
  els.recipient.value = touched.has('recipient') ? state.recipient : '';
  els.sender.value = touched.has('sender') ? state.sender : '';
  els.bg.value = toColor(state.bg);
  els.bg2.value = toColor(state.bg2);
  els.fg.value = toColor(state.fg);
  els.accent.value = toColor(state.accent);
  els.angle.value = state.gradientAngle;
  els.radius.value = state.radius;
  els.music.value = state.music || '';
  els.replies.checked = state.allowReplies !== false;
  els.msgCount.textContent = String(state.message.length);
  setActive('#bgStyleSeg', 'bgstyle', state.bgStyle);
  setActive('#patternSeg', 'pattern', state.pattern);
  setActive('#fontSeg', 'font', state.font);
  setActive('#titleSizeSeg', 'titlesize', state.titleSize);
  setActive('#effectSeg', 'effect', state.effect);
  setActive('#layoutSeg', 'layout', state.layout);
  setActive('#frameSeg', 'frame', state.frame);
  setActive('#ratioSeg', 'ratio', state.ratio);
  syncConditional();
}

// ---------- Templates ----------
function buildTemplateGrid() {
  const grid = $('#templateGrid');
  grid.innerHTML = '';
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.template = key;
    btn.innerHTML = `<span class="swatch" style="background:${tpl.bg};border-color:${tpl.accent}33"></span><span class="tpl-name" data-i18n="tpl.${key}">${key}</span>`;
    btn.addEventListener('click', () => applyTemplate(key));
    grid.appendChild(btn);
  }
}

function markTemplate(key) {
  document.querySelectorAll('#templateGrid button').forEach((b) => b.classList.toggle('active', b.dataset.template === key));
}

function applyTemplate(key) {
  const d = defaultsFor(key);
  state.template = key;
  const carry = ['title', 'message', 'bg', 'bg2', 'fg', 'accent', 'font', 'effect'];
  for (const k of carry) if (!touched.has(k)) state[k] = d[k];
  markTemplate(key);
  syncInputsFromState();
  draw();
}

// ---------- Text & color bindings ----------
function bindText(el, key) {
  el.addEventListener('input', () => {
    state[key] = el.value; touched.add(key);
    if (key === 'message') els.msgCount.textContent = String(el.value.length);
    draw();
  });
}
function bindColor(el, key) {
  el.addEventListener('input', () => { state[key] = el.value; touched.add(key); draw(); });
}
[['recipient','recipient'],['title','title'],['message','message'],['sender','sender']].forEach(([id,k]) => bindText(els[id], k));
[['bg','bg'],['bg2','bg2'],['fg','fg'],['accent','accent']].forEach(([id,k]) => bindColor(els[id], k));

els.angle.addEventListener('input', () => { state.gradientAngle = +els.angle.value; draw(); });
els.radius.addEventListener('input', () => { state.radius = +els.radius.value; draw(); });
els.music.addEventListener('input', () => { state.music = els.music.value; });
els.openat.addEventListener('input', () => {
  state.openAt = els.openat.value ? new Date(els.openat.value).getTime() : 0;
});
els.replies.addEventListener('change', () => { state.allowReplies = els.replies.checked; });
els.guestbook.addEventListener('change', () => { state.guestbook = els.guestbook.checked; });
els.reactions.addEventListener('change', () => { state.allowReactions = els.reactions.checked; });

// Thời hạn thiệp (1/7/30 ngày) — gửi riêng khi tạo, không nằm trong payload.
let selectedDays = 7;
$('#durationSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  selectedDays = Number(b.dataset.days) || 7;
  setActive('#durationSeg', 'days', String(selectedDays));
});

// ---------- Segmented controls ----------
function bindSeg(sel, attr, key, after) {
  $(sel).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state[key] = b.dataset[attr]; touched.add(key);
    setActive(sel, attr, state[key]);
    if (after) after();
    draw();
  });
}
bindSeg('#bgStyleSeg', 'bgstyle', 'bgStyle', syncConditional);
bindSeg('#patternSeg', 'pattern', 'pattern');
bindSeg('#fontSeg', 'font', 'font');
bindSeg('#titleSizeSeg', 'titlesize', 'titleSize');
bindSeg('#effectSeg', 'effect', 'effect');
bindSeg('#layoutSeg', 'layout', 'layout');
bindSeg('#frameSeg', 'frame', 'frame');
bindSeg('#ratioSeg', 'ratio', 'ratio', resizeCanvas);

// ---------- Main image ----------
$('#uploadBtn').addEventListener('click', () => els.image.click());
els.image.addEventListener('change', () => {
  const file = els.image.files[0]; if (!file) return;
  if (file.size > 1_500_000) { els.imgHint.textContent = t('ed.imgTooBig'); els.imgHint.style.color = 'var(--red-fg)'; els.image.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    state.image = reader.result; touched.add('image');
    if (state.layout === 'none') { state.layout = 'top'; setActive('#layoutSeg', 'layout', 'top'); }
    els.imgHint.textContent = file.name; els.imgHint.style.color = '';
    els.removeImg.hidden = false; draw();
  };
  reader.readAsDataURL(file);
});
els.removeImg.addEventListener('click', () => {
  state.image = ''; els.image.value = '';
  els.imgHint.textContent = t('ed.imgHint'); els.removeImg.hidden = true; draw();
});

// ---------- Stickers ----------
function buildStickerPicker() {
  const wrap = $('#stickerPicker');
  wrap.innerHTML = '';
  STICKER_SET.forEach((char) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sticker-btn'; b.textContent = char;
    b.addEventListener('click', () => {
      state.stickers.push({ char, x: 50, y: 42, scale: 1, rot: 0 });
      draw();
    });
    wrap.appendChild(b);
  });
}

// ---------- Khối chữ tự do (#6) ----------
// Thêm một khối chữ mặc định ở y:58 (dưới sticker y:42 để không chồng), vẽ lại,
// rồi vào sửa tại chỗ ngay để người dùng gõ luôn. Double-rAF: draw() tự defer 1 rAF,
// nên đợi thêm 1 frame nữa mới chắc node .c-textblock đã có trong DOM.
function addTextBlock() {
  state.textBlocks.push({ text: t('ed.textPh') || 'Your text', x: 50, y: 58, size: 22, color: '', rot: 0 });
  draw();
  const i = state.textBlocks.length - 1;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const node = els.preview.querySelector(`.c-textblock[data-ti="${i}"]`);
    if (node) startTextEdit(node, i);
  }));
}
$('#addTextBtn').addEventListener('click', addTextBlock);

// ---------- Palette gợi ý (#8) ----------
function buildPaletteGrid() {
  const wrap = $('#paletteGrid');
  if (!wrap) return;
  wrap.innerHTML = '';
  PALETTES.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'palette-btn';
    b.title = p.name;
    b.innerHTML = `<span style="background:${p.bg}"></span>`
      + `<span style="background:${p.bg2}"></span>`
      + `<span style="background:${p.accent}"></span>`
      + `<span style="background:${p.fg}"></span>`;
    b.addEventListener('click', () => {
      state.bg = p.bg; state.bg2 = p.bg2; state.fg = p.fg; state.accent = p.accent;
      ['bg', 'bg2', 'fg', 'accent'].forEach((k) => touched.add(k));
      els.bg.value = p.bg; els.bg2.value = p.bg2; els.fg.value = p.fg; els.accent.value = p.accent;
      draw();
    });
    wrap.appendChild(b);
  });
}

// ---------- Photo overlays ----------
$('#overlayBtn').addEventListener('click', () => els.overlay.click());
els.overlay.addEventListener('change', () => {
  const file = els.overlay.files[0]; if (!file) return;
  if (file.size > 800_000) { toast(t('ed.imgTooBig')); els.overlay.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    state.overlays.push({ src: reader.result, x: 50, y: 50, scale: 1, rot: 0, round: false });
    els.overlay.value = ''; draw();
  };
  reader.readAsDataURL(file);
});

// ---------- Tìm GIF / Sticker online (KLIPY) ----------
// Đẩy overlay từ xa dùng ĐÚNG shape overlay sẵn có {src,x:50,y:50,scale:1,rot:0,round:false}.
// Không viết drag mới: resolveItem (nhánh overlay) + startDrag + dblclick-xóa đã chạy vì
// chỉ key theo data-i và state.overlays[i], không quan tâm src là data: hay https:.
const gifEls = {
  seg: $('#gifKindSeg'),
  input: $('#f-gif-q'),
  results: $('#gifResults'),
};
let gifKind = 'gif';   // 'gif' | 'sticker'
let gifReqSeq = 0;     // chống race: chỉ kết quả của lần tìm mới nhất được dựng
let gifDebounce = 0;
const GIF_OVERLAY_CAP = 8; // khớp LIMITS.overlays phía server

function gifEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function gifSetState(kind, msgKey) {
  const box = gifEls.results;
  box.hidden = false;
  box.dataset.state = kind;
  box.innerHTML = `<div class="gif-msg">${gifEsc(t(msgKey))}</div>`;
}
function gifClear() {
  gifEls.results.hidden = true;
  gifEls.results.dataset.state = '';
  gifEls.results.innerHTML = '';
}

function addRemoteOverlay(url) {
  if (!url) return;
  if (state.overlays.length >= GIF_OVERLAY_CAP) { toast(t('ed.overlayFull')); return; }
  state.overlays.push({ src: url, x: 50, y: 50, scale: 1, rot: 0, round: false });
  draw();
}

function gifRenderResults(items) {
  const box = gifEls.results;
  if (!items.length) { gifSetState('empty', 'ed.gif.empty'); return; }
  box.hidden = false;
  box.dataset.state = 'ok';
  box.innerHTML = '';
  const frag = document.createDocumentFragment();
  items.forEach((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gif-cell';
    btn.setAttribute('role', 'option');
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = it.preview || it.full; // thumbnail nhẹ cho lưới
    img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', () => addRemoteOverlay(it.full || it.preview));
    frag.appendChild(btn);
  });
  box.appendChild(frag);
}

async function gifSearch(q) {
  const seq = ++gifReqSeq;
  gifSetState('loading', 'ed.gif.loading');
  try {
    const url = `/api/gif/search?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(gifKind)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (seq !== gifReqSeq) return;        // đã có lần tìm mới hơn -> bỏ
    if (res.status === 429) { gifSetState('error', 'ed.gif.rate'); return; }
    if (!res.ok) { gifSetState('error', 'ed.gif.error'); return; }
    const data = await res.json();
    if (seq !== gifReqSeq) return;
    const raw = Array.isArray(data) ? data : (data.results || data.items || []);
    const norm = raw
      .map((r) => ({
        preview: r.preview || r.thumb || r.tiny || r.url || r.full || '',
        full: r.full || r.url || r.src || r.preview || '',
      }))
      .filter((r) => r.full || r.preview);
    gifRenderResults(norm);
  } catch {
    if (seq !== gifReqSeq) return;
    gifSetState('error', 'ed.gif.error');
  }
}

gifEls.seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  gifKind = b.dataset.kind === 'sticker' ? 'sticker' : 'gif';
  gifEls.seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  const q = gifEls.input.value.trim();
  if (q) gifSearch(q); else gifClear();
});

gifEls.input.addEventListener('input', () => {
  const q = gifEls.input.value.trim();
  clearTimeout(gifDebounce);
  if (!q) { gifReqSeq++; gifClear(); return; }  // huỷ request đang chờ
  gifDebounce = setTimeout(() => gifSearch(q), 350);
});

gifEls.input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const q = gifEls.input.value.trim();
  clearTimeout(gifDebounce);
  if (q) gifSearch(q);
});

// ---------- Drag stickers / overlays / khối chữ trên preview ----------
// Một nguồn duy nhất ánh xạ node -> mảng state + chỉ số. Sticker & overlay dùng
// data-i; khối chữ dùng data-ti. Nhờ vậy logic kéo/xóa chung cho cả ba loại mà
// không phá đường cũ của sticker/overlay (trả về đúng {arr,i} như trước).
function resolveItem(node) {
  if (node.classList.contains('c-sticker')) return { arr: state.stickers, i: +node.dataset.i, type: 'sticker' };
  if (node.classList.contains('c-textblock')) return { arr: state.textBlocks, i: +node.dataset.ti, type: 'text' };
  return { arr: state.overlays, i: +node.dataset.i, type: 'overlay' };
}

let selectedTextBlock = null; // chỉ số khối chữ đang chọn (để xóa bằng phím Delete)

function attachInteractions() {
  const surface = els.preview;
  surface.querySelectorAll('.c-sticker, .c-overlay, .c-textblock').forEach((node) => {
    node.style.pointerEvents = 'auto';
    node.style.cursor = 'grab';
    node.addEventListener('pointerdown', startDrag);
    if (node.classList.contains('c-textblock')) {
      node.addEventListener('pointerdown', () => { selectedTextBlock = +node.dataset.ti; });
    }
    node.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const it = resolveItem(node);
      // Khối chữ: nháy đúp để SỬA (không xóa). Sticker/overlay: nháy đúp để XÓA (như cũ).
      if (it.type === 'text') { startTextEdit(node, it.i); return; }
      it.arr.splice(it.i, 1); draw();
    });
  });
}

// Sửa chữ tại chỗ (WYSIWYG): thấy ngay font/cỡ/màu/vị trí thật trên thiệp.
// Ghi về state CHỈ khi blur/Enter (không phải mỗi phím) để rAF re-render không nuốt con trỏ.
// Commit rỗng -> tự xóa khối. Escape -> hủy, khôi phục chữ cũ.
function startTextEdit(node, i) {
  node.contentEditable = 'true';
  node.classList.add('editing');
  node.focus();
  const r = document.createRange();
  r.selectNodeContents(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);

  const finish = () => {
    node.removeEventListener('keydown', onKey);
    node.removeEventListener('blur', onBlur);
    node.contentEditable = 'false';
    node.classList.remove('editing');
  };
  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); node.blur(); }
    else if (e.key === 'Escape') {
      e.preventDefault();
      node.textContent = state.textBlocks[i]?.text || '';
      finish(); draw();
    }
  };
  const onBlur = () => {
    finish();
    const txt = node.textContent.trim();
    if (!txt) state.textBlocks.splice(i, 1);
    else if (state.textBlocks[i]) state.textBlocks[i].text = txt;
    draw();
  };
  node.addEventListener('keydown', onKey);
  node.addEventListener('blur', onBlur, { once: true });
}

let drag = null;
function startDrag(e) {
  if (drawing.on) return;
  if (e.currentTarget.isContentEditable) return; // đang sửa chữ thì không kéo
  e.preventDefault();
  const node = e.currentTarget;
  const { arr, i } = resolveItem(node);
  const item = arr[i];
  const rect = els.preview.getBoundingClientRect();
  drag = { item, rect, node };
  node.style.cursor = 'grabbing';
  node.setPointerCapture(e.pointerId);
  node.addEventListener('pointermove', onDrag);
  node.addEventListener('pointerup', endDrag, { once: true });
}
function onDrag(e) {
  if (!drag) return;
  const { item, rect } = drag;
  item.x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
  item.y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
  drag.node.style.left = item.x + '%';
  drag.node.style.top = item.y + '%';
}
function endDrag() {
  if (drag) { drag.node.style.cursor = 'grab'; drag.node.removeEventListener('pointermove', onDrag); drag = null; }
}

// ---------- Canvas drawing ----------
// mode: 'pen' | 'eraser'; style: kiểu bút; size: nét; undo: ngăn ảnh chụp
// pts: điểm của nét đang vẽ; snapshot: ảnh canvas trước nét hiện tại (để vẽ lại mượt)
const drawing = {
  on: false, painting: false, ctx: null,
  mode: 'pen', style: 'smooth', size: 4,
  undo: [], pts: [], snapshot: null,
};
const UNDO_LIMIT = 20;

// Bảng màu nhanh — pastel ấm đồng bộ với palette dự án
const BRUSH_SWATCHES = ['#9f2f2d', '#1f6c9f', '#346538', '#956400', '#2b2b2b', '#ffffff'];

function resizeCanvas() {
  const c = els.canvas;
  const rect = els.preview.getBoundingClientRect();
  if (!rect.width) return;
  // giữ nét vẽ cũ khi đổi kích thước
  const prev = state.drawing;
  // Backing store theo devicePixelRatio để nét sắc, không răng cưa trên màn hình HiDPI
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  drawing.cssW = rect.width;
  drawing.cssH = rect.height;
  c.width = Math.round(rect.width * dpr);
  c.height = Math.round(rect.height * dpr);
  c.style.width = rect.width + 'px';
  c.style.height = rect.height + 'px';
  drawing.ctx = c.getContext('2d');
  // làm việc theo toạ độ CSS; ctx tự scale lên backing store
  drawing.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawing.ctx.lineCap = 'round';
  drawing.ctx.lineJoin = 'round';
  drawing.ctx.imageSmoothingEnabled = true;
  drawing.ctx.imageSmoothingQuality = 'high';
  if (prev) {
    const img = new Image();
    img.onload = () => drawing.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = prev;
  }
}

function updateUndoBtn() {
  els.drawUndo.disabled = drawing.undo.length === 0;
}

// Chụp lại canvas trước mỗi nét để hoàn tác được
function pushUndo() {
  if (!drawing.ctx) return;
  drawing.undo.push(els.canvas.toDataURL('image/png'));
  if (drawing.undo.length > UNDO_LIMIT) drawing.undo.shift();
  updateUndoBtn();
}

function restoreSnapshot(dataUrl) {
  drawing.ctx.clearRect(0, 0, drawing.cssW, drawing.cssH);
  if (!dataUrl) { state.drawing = ''; draw(); return; }
  const img = new Image();
  img.onload = () => {
    drawing.ctx.drawImage(img, 0, 0, drawing.cssW, drawing.cssH);
    state.drawing = els.canvas.toDataURL('image/png');
    draw();
  };
  img.src = dataUrl;
}

$('#drawToggle').addEventListener('click', (e) => {
  drawing.on = !drawing.on;
  els.canvas.hidden = !drawing.on;
  els.canvas.classList.toggle('active', drawing.on);
  els.drawTools.hidden = !drawing.on;
  e.currentTarget.textContent = drawing.on ? t('ed.drawOff') : t('ed.drawOn');
  e.currentTarget.classList.toggle('btn-primary', drawing.on);
  e.currentTarget.classList.toggle('btn-ghost', !drawing.on);
  if (drawing.on) resizeCanvas();
});

els.drawUndo.addEventListener('click', () => {
  if (!drawing.undo.length) return;
  restoreSnapshot(drawing.undo.pop());
  updateUndoBtn();
});

$('#drawClear').addEventListener('click', () => {
  if (drawing.ctx && state.drawing) pushUndo();
  if (drawing.ctx) drawing.ctx.clearRect(0, 0, drawing.cssW, drawing.cssH);
  state.drawing = ''; draw();
});

// Chọn công cụ: bút / tẩy
els.drawModeSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.draw-mode');
  if (!btn) return;
  drawing.mode = btn.dataset.mode;
  els.drawModeSeg.querySelectorAll('.draw-mode').forEach((b) => b.classList.toggle('active', b === btn));
});

// Chọn kiểu vẽ: mượt / dạ quang / thư pháp / chấm bi
els.drawStyleSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.draw-style');
  if (!btn) return;
  drawing.style = btn.dataset.style;
  drawing.mode = 'pen'; // chọn kiểu là quay về bút (không phải tẩy)
  els.drawStyleSeg.querySelectorAll('.draw-style').forEach((b) => b.classList.toggle('active', b === btn));
  els.drawModeSeg.querySelectorAll('.draw-mode').forEach((m) => m.classList.toggle('active', m.dataset.mode === 'pen'));
});

// Kích cỡ nét
els.brushSize.addEventListener('input', () => {
  drawing.size = +els.brushSize.value;
  els.brushSizeVal.textContent = drawing.size;
});

// Bảng màu nhanh — bấm để đặt màu bút và chuyển về chế độ bút
BRUSH_SWATCHES.forEach((color) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'draw-swatch';
  b.style.background = color;
  b.title = color;
  b.addEventListener('click', () => {
    els.brush.value = color;
    drawing.mode = 'pen';
    els.drawModeSeg.querySelectorAll('.draw-mode').forEach((m) => m.classList.toggle('active', m.dataset.mode === 'pen'));
  });
  els.drawSwatches.appendChild(b);
});

function canvasPos(e) {
  // toạ độ CSS thuần — ctx đã được scale theo DPR nên không nhân lại
  const r = els.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Làm mượt buffer điểm bằng trung bình trượt có trọng số (giảm răng cưa do lấy mẫu thô)
function smoothPoints(raw) {
  if (raw.length < 3) return raw;
  const out = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    const p = raw[i], a = raw[i - 1], b = raw[i + 1];
    out.push({ x: p.x * 0.5 + a.x * 0.25 + b.x * 0.25, y: p.y * 0.5 + a.y * 0.25 + b.y * 0.25 });
  }
  out.push(raw[raw.length - 1]);
  return out;
}

// Đặt thuộc tính ctx theo công cụ + kiểu vẽ hiện tại
function applyStroke() {
  const ctx = drawing.ctx;
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1;
  if (drawing.mode === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = drawing.size * 2.4;
    return;
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = els.brush.value;
  ctx.lineWidth = drawing.size;
  switch (drawing.style) {
    case 'marker': // dạ quang: nét dày, đầu vuông, hơi trong
      ctx.lineWidth = drawing.size * 1.8;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.globalAlpha = 0.55;
      break;
    case 'calligraphy': // thư pháp: đầu nghiêng vuông
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'bevel';
      break;
    case 'dotted': // chấm bi: nét đứt tròn
      ctx.setLineDash([0.1, drawing.size * 2.2]);
      break;
    // 'smooth' dùng mặc định round/round
  }
}

// Vẽ lại nét hiện tại từ buffer điểm bằng đường cong qua trung điểm → mượt
function renderCurrentStroke() {
  const ctx = drawing.ctx;
  const pts = smoothPoints(drawing.pts);
  // phục hồi canvas về trạng thái trước nét, rồi vẽ lại cả nét đã mượt
  // putImageData làm việc theo pixel backing store, bỏ qua transform → dùng reset tạm
  if (drawing.snapshot) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(drawing.snapshot, 0, 0);
    ctx.restore();
  }
  if (!pts.length) return;
  applyStroke();
  ctx.beginPath();
  if (pts.length < 3) {
    // ít điểm: chấm tròn / đoạn ngắn
    const a = pts[0], b = pts[pts.length - 1];
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y + 0.01);
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    // mỗi đoạn là đường cong bậc 2: điểm điều khiển = pts[i], đích = trung điểm(pts[i], pts[i+1])
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    // nối tới điểm cuối
    const last = pts[pts.length - 1];
    ctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
  }
  ctx.stroke();
}

els.canvas.addEventListener('pointerdown', (e) => {
  if (!drawing.on) return;
  pushUndo();
  drawing.painting = true;
  els.canvas.setPointerCapture(e.pointerId);
  // chụp canvas trước nét để vẽ lại mượt mà không mất nét cũ
  // chụp full backing-store (pixel thật, không theo transform)
  drawing.snapshot = drawing.ctx.getImageData(0, 0, els.canvas.width, els.canvas.height);
  drawing.pts = [canvasPos(e)];
  renderCurrentStroke();
});
els.canvas.addEventListener('pointermove', (e) => {
  if (!drawing.painting) return;
  // gộp các sự kiện trung gian (bút cảm ứng/chuột nhanh) để nét dày điểm hơn
  const coalesced = e.getCoalescedEvents?.() ?? [];
  const events = coalesced.length ? coalesced : [e];
  for (const ev of events) drawing.pts.push(canvasPos(ev));
  renderCurrentStroke();
});
function endStroke() {
  if (!drawing.painting) return;
  drawing.painting = false;
  drawing.ctx.globalCompositeOperation = 'source-over';
  drawing.ctx.globalAlpha = 1;
  drawing.ctx.setLineDash([]);
  drawing.snapshot = null;
  drawing.pts = [];
  state.drawing = els.canvas.toDataURL('image/png');
  draw();
}
els.canvas.addEventListener('pointerup', endStroke);
els.canvas.addEventListener('pointercancel', endStroke);

// Xóa khối chữ đang chọn bằng Delete/Backspace — chỉ khi KHÔNG đang gõ trong
// input/textarea/contentEditable (để không cướp phím xóa lúc soạn chữ).
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextBlock != null) {
    const ae = document.activeElement;
    if (ae?.isContentEditable || ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA') return;
    if (state.textBlocks[selectedTextBlock]) {
      state.textBlocks.splice(selectedTextBlock, 1);
      selectedTextBlock = null;
      draw();
    }
  }
});

// ---------- Create ----------
els.createBtn.addEventListener('click', async () => {
  if (!state.title.trim() && !state.message.trim()) { toast(t('ed.needContent')); return; }
  const span = els.createBtn.querySelector('span');
  els.createBtn.disabled = true;
  const orig = span.textContent; span.textContent = t('ed.creating');
  try {
    // bỏ recipientLabel (chỉ dùng cho preview) ra khỏi payload gửi đi
    const { recipientLabel, ...payload } = state;
    if (editToken) {
      // Chế độ sửa: lưu đè qua manage token, rồi về trang quản lý.
      const res = await fetch(`/api/manage/${encodeURIComponent(editToken)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('ed.createFail'));
      location.href = `/m/${encodeURIComponent(editToken)}`;
      return;
    }
    const res = await fetch('/api/cards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, days: selectedDays }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('ed.createFail'));
    showSuccess(data);
  } catch (err) {
    toast(err.message);
  } finally {
    els.createBtn.disabled = false; span.textContent = orig;
  }
});

function showSuccess({ id, manageToken }) {
  const origin = location.origin;
  const shareUrl = `${origin}/c/${id}`;
  $('#shareLink').value = shareUrl;
  $('#manageLink').value = `${origin}/m/${manageToken}`;
  $('#openCard').href = shareUrl;
  renderQR(shareUrl);
  $('#successModal').hidden = false;
}

// Vẽ QR cho link gửi đi. Dùng thư viện qrcode (nạp qua CDN ở create.html).
function renderQR(url) {
  const box = $('#qrBox');
  if (!box) return;
  box.innerHTML = '';
  if (typeof window.QRCode === 'undefined') { box.hidden = true; return; }
  try {
    new window.QRCode(box, { text: url, width: 132, height: 132, correctLevel: window.QRCode.CorrectLevel.M });
    box.hidden = false;
  } catch { box.hidden = true; }
}
$('#closeModal').addEventListener('click', () => { $('#successModal').hidden = true; });
$('#successModal').addEventListener('click', (e) => { if (e.target.id === 'successModal') e.currentTarget.hidden = true; });
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const input = $('#' + btn.dataset.copy);
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
    const old = btn.textContent; btn.textContent = t('modal.copied');
    setTimeout(() => { btn.textContent = old; }, 1400);
  });
});

// ---------- Toast ----------
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ---------- FAQ ----------
document.querySelectorAll('.faq-q').forEach((q) => {
  q.addEventListener('click', () => {
    const item = q.closest('.faq-item');
    const open = item.classList.toggle('open');
    q.querySelector('.sign').textContent = open ? '−' : '+';
  });
});

// ---------- Scroll reveal ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ---------- i18n ----------
buildLangSwitcher($('#langSelect'));
initThemeToggle();
window.addEventListener('langchange', () => {
  applyI18n();
  // dịch lại tên template (được thêm động)
  document.querySelectorAll('#templateGrid [data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  draw(); // cập nhật nhãn "Gửi" trên thiệp
});

// ---------- Init ----------
buildTemplateGrid();
buildStickerPicker();
buildPaletteGrid();
markTemplate('birthday');
syncInputsFromState();
applyI18n();
state.recipientLabel = t('to');
renderCard(els.preview, state);
attachInteractions();
if (els.hero) renderCard(els.hero, { ...defaultsFor('love'), recipientLabel: t('to') });
window.addEventListener('resize', () => { if (drawing.on) resizeCanvas(); });

// ---------- Chế độ sửa (#1) / nhân bản (#4) ----------
// /create?edit=<token>  -> nạp & LƯU ĐÈ thiệp cũ.
// /create?clone=<token> -> nạp nội dung nhưng TẠO MỚI (không set editToken).
(async function maybeLoadExisting() {
  const params = new URLSearchParams(location.search);
  const editTok = params.get('edit');
  const cloneTok = params.get('clone');
  const tok = editTok || cloneTok;
  if (!tok) return;
  try {
    const res = await fetch(`/api/manage/${encodeURIComponent(tok)}`);
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    // nạp payload vào state; coi mọi trường là "đã chỉnh" để không bị template ghi đè
    state = { ...defaultsFor(data.payload.template || 'birthday'), ...data.payload };
    Object.keys(state).forEach((k) => touched.add(k));
    if (state.template) markTemplate(state.template);
    if (state.guestbook) els.guestbook.checked = true;
    els.reactions.checked = state.allowReactions !== false;
    syncInputsFromState();
    state.recipientLabel = t('to');
    renderCard(els.preview, state);
    attachInteractions();
    if (editTok) {
      editToken = editTok;                 // chỉ chế độ sửa mới lưu đè
      const span = els.createBtn.querySelector('span');
      if (span) span.textContent = t('mn.edit');
    }
    // chế độ clone: giữ nguyên nút "Tạo" -> sẽ POST tạo thiệp mới
  } catch {
    toast(t('mn.invalid.p'));
  }
})();
