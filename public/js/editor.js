import { TEMPLATES, PALETTES, defaultsFor, renderCard } from '/js/render.js';
import { t, applyI18n, buildLangSwitcher, getLang } from '/js/i18n.js';
import { initThemeToggle } from '/js/theme.js';

const $ = (s) => document.querySelector(s);

let state = localizedDefaultsFor('birthday');
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
  patternScale: $('#f-pattern-scale'), patternOpacity: $('#f-pattern-opacity'), texture: $('#f-texture'),
  snap: $('#f-snap'),
  imageZoom: $('#f-image-zoom'), imageX: $('#f-image-x'), imageY: $('#f-image-y'),
  imageOpacity: $('#f-image-opacity'), imageRadius: $('#f-image-radius'), scrim: $('#f-scrim'),
  imageFilterSeg: $('#imageFilterSeg'), extractPalette: $('#extractPaletteBtn'),
  image: $('#f-image'), overlay: $('#f-overlay'), music: $('#f-music'), openat: $('#f-openat'),
  brush: $('#f-brush'), replies: $('#f-replies'),
  guestbook: $('#f-guestbook'), reactions: $('#f-reactions'), envelope: $('#f-envelope'),
  reveal: $('#f-reveal'), burst: $('#f-burst'),
  msgCount: $('#msgCount'), preview: $('#previewCard'), hero: $('#heroCard'),
  imgHint: $('#imgHint'), removeImg: $('#removeImg'), createBtn: $('#createBtn'),
  canvas: $('#drawCanvas'), stage: $('#previewStage'),
  guideX: $('#guideX'), guideY: $('#guideY'), selectionToolbar: $('#selectionToolbar'),
  layerList: $('#layerList'), checkList: $('#checkList'), autoFix: $('#autoFixBtn'),
  clearSelection: $('#clearSelectionBtn'), undo: $('#designUndo'), redo: $('#designRedo'),
  presetGrid: $('#designPresetGrid'), saveTemplate: $('#designSaveTpl'), savedTemplates: $('#savedTemplateSelect'),
  selectedEmpty: $('#selectedEmpty'), selectedPanel: $('#selectedPanel'),
  selScale: $('#sel-scale'), selSize: $('#sel-size'), selRot: $('#sel-rot'), selOpacity: $('#sel-opacity'),
  selScaleWrap: $('#selScaleWrap'), selSizeWrap: $('#selSizeWrap'),
  textStylePanel: $('#textStylePanel'), overlayStylePanel: $('#overlayStylePanel'),
  selTextColor: $('#sel-text-color'), selTextBg: $('#sel-text-bg'),
  selFontSeg: $('#selFontSeg'), selTextStyleSeg: $('#selTextStyleSeg'), selAlignSeg: $('#selAlignSeg'),
  selRound: $('#sel-round'), selOverlayFilterSeg: $('#selOverlayFilterSeg'),
  drawTools: $('#drawTools'), drawUndo: $('#drawUndo'),
  drawModeSeg: $('#drawModeSeg'), drawStyleSeg: $('#drawStyleSeg'),
  drawSwatches: $('#drawSwatches'),
  brushSize: $('#f-brush-size'), brushSizeVal: $('#brushSizeVal'),
  aiSuggest: $('#aiSuggestBtn'), aiTone: $('#aiTone'), aiRegen: $('#aiRegenBtn'), aiNotes: $('#aiNotes'), aiPolish: $('#aiPolishBtn'),
};

const DESIGN_PRESETS = [
  { key: 'editorial', name: 'Editorial', bg: '#fbfbfa', bg2: '#f7f6f3', fg: '#2f3437', accent: '#787774', font: 'serif', frame: 'line', effect: 'none', bgStyle: 'solid', titleSize: 'l' },
  { key: 'softLove', name: 'Soft love', bg: '#fdebec', bg2: '#f7cdd0', fg: '#3a2326', accent: '#9f2f2d', font: 'serif', frame: 'double', effect: 'hearts', bgStyle: 'gradient', titleSize: 'xl' },
  { key: 'freshNote', name: 'Fresh note', bg: '#edf3ec', bg2: '#d3e6d2', fg: '#26302a', accent: '#346538', font: 'sans', frame: 'inset', effect: 'petals', bgStyle: 'pattern', pattern: 'paper', titleSize: 'm' },
  { key: 'quietBlue', name: 'Quiet blue', bg: '#e1f3fe', bg2: '#bfe3fb', fg: '#1f3340', accent: '#1f6c9f', font: 'display', frame: 'line', effect: 'sparkle', bgStyle: 'gradient', titleSize: 'l' },
  { key: 'warmFormal', name: 'Warm formal', bg: '#fbf3db', bg2: '#f6e3b0', fg: '#2f3437', accent: '#956400', font: 'display', frame: 'double', effect: 'none', bgStyle: 'pattern', pattern: 'grid', titleSize: 'xl' },
  { key: 'mono', name: 'Mono', bg: '#ffffff', bg2: '#f1f1ef', fg: '#2f3437', accent: '#787774', font: 'sans', frame: 'none', effect: 'none', bgStyle: 'solid', titleSize: 'm' },
];
const SAVED_TEMPLATES_KEY = 'cardmaker.designTemplates';
const HISTORY_LIMIT = 80;
let selected = null;
let selectedTextBlock = null;
let drag = null;
let isRestoringHistory = false;
const historyStack = [];
const redoStack = [];

function localizedDefaultsFor(template) {
  const d = defaultsFor(template);
  const titleKey = `default.${template}.title`;
  const messageKey = `default.${template}.message`;
  const title = t(titleKey);
  const message = t(messageKey);
  return {
    ...d,
    title: title === titleKey ? d.title : title,
    message: message === messageKey ? d.message : message,
  };
}

// ---------- Render preview ----------
let rafId = 0;
function draw() {
  cancelAnimationFrame(rafId);
  // Re-render the card and then re-attach editor-only interactions.
  rafId = requestAnimationFrame(() => {
    ensureDesignState();
    state.recipientLabel = t('to');
    renderCard(els.preview, state);
    attachInteractions();
    syncDesignPanels();
  });
}

function toColor(v) {
  if (!v) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return '#' + v.slice(1).split('').map((c) => c + c).join('');
  return '#000000';
}

function toDatetimeLocalValue(ts) {
  const d = new Date(Number(ts) || 0);
  if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Bỏ recipientLabel (chỉ dùng cho preview) khỏi payload gửi đi / snapshot history.
function cloneState(value = state) {
  const { recipientLabel, ...payload } = value;
  return payload;
}

function ensureDesignState() {
  state.patternScale ??= 1;
  state.patternOpacity ??= 0.18;
  state.texture ??= false;
  state.imageZoom ??= 1;
  state.imageX ??= 50;
  state.imageY ??= 50;
  state.imageRadius ??= 0;
  state.imageOpacity ??= 1;
  state.imageFilter ??= 'none';
  state.scrim ??= 0.45;
  state.snap ??= true;
  state.guestbook ??= false;
  state.allowReactions ??= true;
  state.stickers ??= [];
  state.overlays ??= [];
  state.textBlocks ??= [];
  let z = 10;
  state.stickers.forEach((item) => {
    item.opacity ??= 1; item.z ??= z; item.hidden ??= false; item.locked ??= false;
    item.flipX ??= false; item.flipY ??= false; z += 10;
  });
  state.overlays.forEach((item) => {
    item.opacity ??= 1; item.filter ??= 'none'; item.z ??= z; item.hidden ??= false; item.locked ??= false;
    item.flipX ??= false; item.flipY ??= false; z += 10;
  });
  state.textBlocks.forEach((item) => {
    item.opacity ??= 1; item.bg ??= ''; item.font ??= ''; item.align ??= 'center';
    item.weight ??= 'normal'; item.italic ??= false; item.shadow ??= false; item.outline ??= false;
    item.z ??= z; item.hidden ??= false; item.locked ??= false; z += 10;
  });
}

function selectedItem() {
  if (!selected) return null;
  const arr = selected.type === 'text' ? state.textBlocks : selected.type === 'sticker' ? state.stickers : state.overlays;
  const item = arr?.[selected.i];
  return item ? { arr, item, type: selected.type, i: selected.i } : null;
}

function setSelected(type, i) {
  selected = type ? { type, i } : null;
  selectedTextBlock = type === 'text' ? i : null;
  syncDesignPanels();
}

function maxZ() {
  return Math.max(0, ...state.stickers.map((x) => x.z || 0), ...state.overlays.map((x) => x.z || 0), ...state.textBlocks.map((x) => x.z || 0));
}

function nextZ() {
  return maxZ() + 10;
}

function setActiveButtons(root, attr, val) {
  if (!root) return;
  root.querySelectorAll('button').forEach((b) => b.classList.toggle('active', String(b.dataset[attr]) === String(val)));
}

// Undo/redo dùng snapshot đầy đủ (chứa cả base64) để undo đúng cả khi đổi ảnh/drawing.
//
// QUAN TRỌNG: snapshotHistory() được gọi từ listener CAPTURE-phase (chạy TRƯỚC handler
// bubble-phase mutate state), nên `state` lúc này vẫn là trạng thái TRƯỚC thay đổi. Ta
// commit ngay (leading-edge), KHÔNG debounce trì hoãn — nếu trì hoãn 400ms thì snap chụp
// phải state SAU khi đã sửa, khiến undo đầu tiên không hoàn tác được.
//
// Chống phình: một burst (gõ liên tục / kéo slider) chỉ đẩy 1 bản pre-change đầu tiên;
// các event trong 400ms kế bị bỏ qua bằng cờ thời gian. pushSnapshot dedup theo nội dung.
let lastSnapAt = 0;
function pushSnapshot() {
  const snap = JSON.stringify(cloneState());
  if (historyStack[historyStack.length - 1] !== snap) {
    historyStack.push(snap);
    if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
  }
  redoStack.length = 0;
  updateHistoryButtons();
}
function snapshotHistory() {
  if (isRestoringHistory) return;
  const now = performance.now();
  if (now - lastSnapAt < 400) { lastSnapAt = now; return; } // trong burst → bỏ qua
  lastSnapAt = now;
  pushSnapshot();   // chụp state PRE-change (đang ở capture-phase)
}

// Commit ngay tức thì (dùng cho các hành động rời rạc: xóa, duplicate, front/back).
// Reset cửa sổ burst để lần snapshot kế (nếu có) không bị bỏ qua nhầm.
function snapshotHistoryNow() {
  if (isRestoringHistory) return;
  lastSnapAt = performance.now();
  pushSnapshot();
}

function restoreHistorySnapshot(snap) {
  isRestoringHistory = true;
  const parsed = JSON.parse(snap);
  state = { ...defaultsFor(parsed.template || 'birthday'), ...parsed };
  selected = null;
  selectedTextBlock = null;
  ensureDesignState();
  Object.keys(state).forEach((k) => touched.add(k));
  syncInputsFromState();
  markTemplate(state.template);
  draw();
  isRestoringHistory = false;
}

function updateHistoryButtons() {
  if (els.undo) els.undo.disabled = historyStack.length === 0;
  if (els.redo) els.redo.disabled = redoStack.length === 0;
}

function setActive(scope, attr, val) {
  document.querySelectorAll(`${scope} button`).forEach((b) => b.classList.toggle('active', b.dataset[attr] === val));
}

function syncConditional() {
  $('#patternField').hidden = state.bgStyle !== 'pattern';
  $('#patternAdvanced').hidden = state.bgStyle !== 'pattern';
  $('#angleField').hidden = state.bgStyle !== 'gradient';
  $('#bg2Wrap').hidden = state.bgStyle === 'solid';
}

function syncInputsFromState() {
  ensureDesignState();
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
  els.patternScale.value = state.patternScale;
  els.patternOpacity.value = state.patternOpacity;
  els.texture.checked = state.texture === true;
  els.snap.checked = state.snap !== false;
  els.imageZoom.value = state.imageZoom;
  els.imageX.value = state.imageX;
  els.imageY.value = state.imageY;
  els.imageOpacity.value = state.imageOpacity;
  els.imageRadius.value = state.imageRadius;
  els.scrim.value = state.scrim;
  els.music.value = state.music || '';
  els.openat.value = toDatetimeLocalValue(state.openAt);
  els.replies.checked = state.allowReplies !== false;
  els.guestbook.checked = state.guestbook === true;
  els.reactions.checked = state.allowReactions !== false;
  els.envelope.checked = state.envelope === true;
  els.reveal.checked = state.reveal === true;
  els.burst.checked = state.burst === true;
  els.msgCount.textContent = String(state.message.length);
  setActive('#bgStyleSeg', 'bgstyle', state.bgStyle);
  setActive('#patternSeg', 'pattern', state.pattern);
  setActive('#fontSeg', 'font', state.font);
  setActive('#titleSizeSeg', 'titlesize', state.titleSize);
  setActive('#sizeSeg', 'size', state.size || 'm');
  setActive('#effectSeg', 'effect', state.effect);
  setActive('#layoutSeg', 'layout', state.layout);
  setActive('#frameSeg', 'frame', state.frame);
  setActive('#shadowSeg', 'shadow', state.shadow || 'soft');
  setActive('#ratioSeg', 'ratio', state.ratio);
  setActiveButtons(els.imageFilterSeg, 'filter', state.imageFilter);
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
  const d = localizedDefaultsFor(key);
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
els.patternScale.addEventListener('input', () => { state.patternScale = +els.patternScale.value; draw(); });
els.patternOpacity.addEventListener('input', () => { state.patternOpacity = +els.patternOpacity.value; draw(); });
els.texture.addEventListener('change', () => { state.texture = els.texture.checked; draw(); });
els.snap.addEventListener('change', () => { state.snap = els.snap.checked; });
[
  ['imageZoom', 'imageZoom'], ['imageX', 'imageX'], ['imageY', 'imageY'],
  ['imageOpacity', 'imageOpacity'], ['imageRadius', 'imageRadius'], ['scrim', 'scrim'],
].forEach(([elKey, stateKey]) => {
  els[elKey].addEventListener('input', () => { state[stateKey] = +els[elKey].value; draw(); });
});
els.music.addEventListener('input', () => { state.music = els.music.value; });
els.openat.addEventListener('input', () => {
  state.openAt = els.openat.value ? new Date(els.openat.value).getTime() : 0;
});
els.replies.addEventListener('change', () => { state.allowReplies = els.replies.checked; });
els.guestbook.addEventListener('change', () => { state.guestbook = els.guestbook.checked; });
els.reactions.addEventListener('change', () => { state.allowReactions = els.reactions.checked; });
els.envelope.addEventListener('change', () => { state.envelope = els.envelope.checked; });
els.reveal.addEventListener('change', () => { state.reveal = els.reveal.checked; });
els.burst.addEventListener('change', () => { state.burst = els.burst.checked; });

els.imageFilterSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.imageFilter = b.dataset.filter || 'none';
  setActiveButtons(els.imageFilterSeg, 'filter', state.imageFilter);
  draw();
});

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
bindSeg('#sizeSeg', 'size', 'size');
bindSeg('#effectSeg', 'effect', 'effect');
bindSeg('#layoutSeg', 'layout', 'layout');
bindSeg('#frameSeg', 'frame', 'frame');
bindSeg('#shadowSeg', 'shadow', 'shadow');
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
      state.stickers.push({ char, x: 50, y: 42, scale: 1, rot: 0, opacity: 1, z: nextZ(), hidden: false, locked: false });
      setSelected('sticker', state.stickers.length - 1);
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
  state.textBlocks.push({ text: t('ed.textPh') || 'Your text', x: 50, y: 58, size: 22, color: '', bg: '', font: '', align: 'center', weight: 'normal', italic: false, shadow: false, outline: false, opacity: 1, rot: 0, z: nextZ(), hidden: false, locked: false });
  setSelected('text', state.textBlocks.length - 1);
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
    state.overlays.push({ src: reader.result, x: 50, y: 50, scale: 1, rot: 0, opacity: 1, filter: 'none', z: nextZ(), hidden: false, locked: false, round: false });
    setSelected('overlay', state.overlays.length - 1);
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
  state.overlays.push({ src: url, x: 50, y: 50, scale: 1, rot: 0, opacity: 1, filter: 'none', z: nextZ(), hidden: false, locked: false, round: false });
  setSelected('overlay', state.overlays.length - 1);
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
function buildDesignPresets() {
  if (!els.presetGrid) return;
  els.presetGrid.innerHTML = '';
  DESIGN_PRESETS.forEach((preset) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset-btn';
    b.innerHTML = `<span class="preset-swatch" style="background:${preset.bg};border-color:${preset.accent}"></span><span>${gifEsc(t(`preset.${preset.key}`) || preset.name)}</span>`;
    b.addEventListener('click', () => {
      Object.assign(state, preset);
      ['bg', 'bg2', 'fg', 'accent', 'font', 'frame', 'effect', 'bgStyle', 'pattern', 'titleSize'].forEach((k) => touched.add(k));
      syncInputsFromState();
      draw();
    });
    els.presetGrid.appendChild(b);
  });
}

function savedTemplates() {
  try { return JSON.parse(localStorage.getItem(SAVED_TEMPLATES_KEY) || '[]'); } catch { return []; }
}

// Template lưu trọn payload (kể base64) — dễ vượt quota localStorage. Nếu đầy,
// bỏ template cũ nhất cho đến khi lưu được; vẫn trượt thì báo lỗi ra toast.
function writeSavedTemplates(list) {
  let capped = list.slice(0, 24);
  for (;;) {
    const json = JSON.stringify(capped);
    try { localStorage.setItem(SAVED_TEMPLATES_KEY, json); renderSavedTemplates(); return true; }
    catch {
      if (capped.length <= 1) { toast(t('ed.imgTooBig')); return false; }   // fallback thông báo
      capped = capped.slice(0, capped.length - 1);  // bỏ cũ nhất, thử lại
    }
  }
}

function renderSavedTemplates() {
  if (!els.savedTemplates) return;
  const list = savedTemplates();
  els.savedTemplates.innerHTML = `<option value="">${gifEsc(t('ed.savedTemplates'))}</option>` + list.map((item, i) => `<option value="${i}">${gifEsc(item.name)}</option>`).join('');
}

els.saveTemplate?.addEventListener('click', () => {
  const name = prompt(t('ed.templateName'), state.title || t('ed.myCardDesign'));
  if (!name) return;
  const list = savedTemplates();
  list.unshift({ name: name.trim().slice(0, 40), savedAt: Date.now(), payload: cloneState() });
  writeSavedTemplates(list);
  toast(t('ed.templateSaved'));
});

els.savedTemplates?.addEventListener('change', () => {
  const i = Number(els.savedTemplates.value);
  const item = savedTemplates()[i];
  if (!item) return;
  state = { ...defaultsFor(item.payload.template || 'birthday'), ...item.payload };
  selected = null;
  selectedTextBlock = null;
  ensureDesignState();
  Object.keys(state).forEach((k) => touched.add(k));
  syncInputsFromState();
  markTemplate(state.template);
  draw();
  els.savedTemplates.value = '';
});

els.undo?.addEventListener('click', () => {
  if (!historyStack.length) return;
  redoStack.push(JSON.stringify(cloneState()));
  restoreHistorySnapshot(historyStack.pop());
  updateHistoryButtons();
});

els.redo?.addEventListener('click', () => {
  if (!redoStack.length) return;
  historyStack.push(JSON.stringify(cloneState()));
  restoreHistorySnapshot(redoStack.pop());
  updateHistoryButtons();
});

function shouldCaptureHistory(e) {
  const target = e.target;
  if (isRestoringHistory) return false;
  if (target.closest('#successModal, .nav, #gifResults, #f-gif-q')) return false;
  if (target.closest('#designUndo, #designRedo, #clearSelectionBtn')) return false;
  if (target.closest('.layer-row') && !target.closest('[data-layer-action]')) return false;
  return Boolean(target.closest('.editor-controls, .preview-stage'));
}

['input', 'change', 'click', 'pointerdown', 'keydown'].forEach((eventName) => {
  document.addEventListener(eventName, (e) => {
    if (!shouldCaptureHistory(e)) return;
    snapshotHistory();
  }, true);
});

function layerEntries() {
  const entries = [];
  state.textBlocks.forEach((item, i) => entries.push({ type: 'text', i, item, label: item.text || t('ed.layerText') }));
  state.overlays.forEach((item, i) => entries.push({ type: 'overlay', i, item, label: item.src?.startsWith('https:') ? t('ed.layerGif') : t('ed.layerPhoto') }));
  state.stickers.forEach((item, i) => entries.push({ type: 'sticker', i, item, label: item.char || t('ed.layerSticker') }));
  return entries.sort((a, b) => (b.item.z || 0) - (a.item.z || 0));
}

function renderLayers() {
  if (!els.layerList) return;
  const entries = layerEntries();
  if (!entries.length) {
    els.layerList.innerHTML = `<div class="layer-empty">${gifEsc(t('ed.layerEmpty'))}</div>`;
    return;
  }
  els.layerList.innerHTML = entries.map((entry) => {
    const active = selected?.type === entry.type && selected?.i === entry.i ? ' active' : '';
    const muted = entry.item.hidden ? ' muted' : '';
    return `
      <div class="layer-row${active}${muted}" data-type="${entry.type}" data-i="${entry.i}">
        <button type="button" class="layer-main">
          <span class="layer-kind">${gifEsc(t(`ed.kind.${entry.type}`))}</span>
          <span class="layer-name">${gifEsc(entry.label.slice(0, 40))}</span>
        </button>
        <button type="button" data-layer-action="hide">${entry.item.hidden ? gifEsc(t('ed.layerShow')) : gifEsc(t('ed.layerHide'))}</button>
        <button type="button" data-layer-action="lock">${entry.item.locked ? gifEsc(t('ed.layerUnlock')) : gifEsc(t('ed.layerLock'))}</button>
      </div>`;
  }).join('');
}

els.layerList?.addEventListener('click', (e) => {
  const row = e.target.closest('.layer-row');
  if (!row) return;
  const type = row.dataset.type;
  const i = Number(row.dataset.i);
  const action = e.target.closest('[data-layer-action]')?.dataset.layerAction;
  setSelected(type, i);
  const it = selectedItem();
  if (!it) return;
  if (action === 'hide') it.item.hidden = !it.item.hidden;
  if (action === 'lock') it.item.locked = !it.item.locked;
  if (action) draw();
});

function renderLegibility() {
  if (!els.checkList) return;
  const issues = [];
  if ((state.title || '').length > 70 && state.titleSize === 'xl') issues.push(t('check.titleLong'));
  if ((state.message || '').length > 700) issues.push(t('check.messageDense'));
  if (state.layout === 'full' && state.image && (state.scrim || 0) < 0.3) issues.push(t('check.scrim'));
  const contrast = contrastRatio(state.fg || '#2f3437', state.bg || '#ffffff');
  if (contrast && contrast < 4.5 && state.layout !== 'full') issues.push(t('check.contrast'));
  if (!issues.length) issues.push(t('check.ok'));
  els.checkList.innerHTML = issues.map((x) => `<div class="check-item">${gifEsc(x)}</div>`).join('');
}

function luminance(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return null;
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

els.autoFix?.addEventListener('click', () => {
  if ((state.title || '').length > 70) state.titleSize = 'm';
  if (state.layout === 'full' && state.image) state.scrim = Math.max(state.scrim || 0, 0.45);
  if (contrastRatio(state.fg || '#2f3437', state.bg || '#ffffff') < 4.5) {
    state.fg = '#2f3437';
    state.accent = state.accent || '#787774';
  }
  syncInputsFromState();
  draw();
});

function syncDesignPanels() {
  const it = selectedItem();
  if (selected && !it) selected = null;
  renderLayers();
  renderLegibility();
  updateHistoryButtons();
  syncSelectionUi();
  els.preview.querySelectorAll('.c-sticker, .c-overlay, .c-textblock').forEach((node) => {
    const resolved = resolveItem(node);
    node.classList.toggle('selected', Boolean(selected && selected.type === resolved.type && selected.i === resolved.i));
    node.classList.toggle('locked', Boolean(resolved.item?.locked));
  });
}

function syncSelectionUi() {
  const it = selectedItem();
  if (!it) {
    if (els.selectionToolbar) els.selectionToolbar.hidden = true;
    if (els.selectedEmpty) els.selectedEmpty.hidden = false;
    if (els.selectedPanel) els.selectedPanel.hidden = true;
    return;
  }
  if (els.selectionToolbar) els.selectionToolbar.hidden = false;
  if (els.selectedEmpty) els.selectedEmpty.hidden = true;
  if (els.selectedPanel) els.selectedPanel.hidden = false;
  const item = it.item;
  els.selRot.value = item.rot ?? 0;
  els.selOpacity.value = item.opacity ?? 1;
  const isText = it.type === 'text';
  els.selScaleWrap.hidden = isText;
  els.selSizeWrap.hidden = !isText;
  if (isText) els.selSize.value = item.size ?? 22;
  else els.selScale.value = item.scale ?? 1;
  els.textStylePanel.hidden = !isText;
  els.overlayStylePanel.hidden = it.type !== 'overlay';
  if (isText) {
    els.selTextColor.value = toColor(item.color || state.fg);
    els.selTextBg.value = toColor(item.bg || '#ffffff');
    setActiveButtons(els.selFontSeg, 'font', item.font || '');
    setActiveButtons(els.selAlignSeg, 'align', item.align || 'center');
    els.selTextStyleSeg.querySelector('[data-style="bold"]')?.classList.toggle('active', item.weight === 'bold');
    els.selTextStyleSeg.querySelector('[data-style="italic"]')?.classList.toggle('active', item.italic === true);
    els.selTextStyleSeg.querySelector('[data-style="shadow"]')?.classList.toggle('active', item.shadow === true);
    els.selTextStyleSeg.querySelector('[data-style="outline"]')?.classList.toggle('active', item.outline === true);
    els.selTextStyleSeg.querySelector('[data-style="bg"]')?.classList.toggle('active', Boolean(item.bg));
  }
  if (it.type === 'overlay') {
    els.selRound.checked = item.round === true;
    setActiveButtons(els.selOverlayFilterSeg, 'filter', item.filter || 'none');
  }
}

function mutateSelected(fn) {
  const it = selectedItem();
  if (!it) return;
  fn(it.item, it);
  draw();
}

els.selectionToolbar?.addEventListener('click', (e) => {
  const action = e.target.closest('button')?.dataset.action;
  if (!action) return;
  const it = selectedItem();
  if (!it) return;
  if (action === 'delete') {
    it.arr.splice(it.i, 1);
    setSelected(null, null);
  } else if (action === 'duplicate') {
    const copy = { ...JSON.parse(JSON.stringify(it.item)), x: Math.min(100, (it.item.x || 50) + 5), y: Math.min(100, (it.item.y || 50) + 5), z: nextZ(), locked: false, hidden: false };
    it.arr.push(copy);
    setSelected(it.type, it.arr.length - 1);
  } else if (action === 'front') {
    it.item.z = nextZ();
  } else if (action === 'back') {
    it.item.z = Math.max(0, Math.min(...layerEntries().map((x) => x.item.z || 0)) - 10);
  } else if (action === 'centerX') {
    it.item.x = 50;
  } else if (action === 'centerY') {
    it.item.y = 50;
  } else if (action === 'flipX') {
    it.item.flipX = !it.item.flipX;
  } else if (action === 'flipY') {
    it.item.flipY = !it.item.flipY;
  } else if (action === 'lock') {
    it.item.locked = !it.item.locked;
  } else if (action === 'hide') {
    it.item.hidden = !it.item.hidden;
  }
  draw();
});

els.clearSelection?.addEventListener('click', () => setSelected(null, null));

els.selScale?.addEventListener('input', () => mutateSelected((item) => { item.scale = +els.selScale.value; }));
els.selSize?.addEventListener('input', () => mutateSelected((item) => { item.size = +els.selSize.value; }));
els.selRot?.addEventListener('input', () => mutateSelected((item) => { item.rot = +els.selRot.value; }));
els.selOpacity?.addEventListener('input', () => mutateSelected((item) => { item.opacity = +els.selOpacity.value; }));
els.selTextColor?.addEventListener('input', () => mutateSelected((item) => { item.color = els.selTextColor.value; }));
els.selTextBg?.addEventListener('input', () => mutateSelected((item) => { item.bg = els.selTextBg.value; }));
els.selRound?.addEventListener('change', () => mutateSelected((item) => { item.round = els.selRound.checked; }));
els.selFontSeg?.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  mutateSelected((item) => { item.font = b.dataset.font || ''; });
});
els.selAlignSeg?.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  mutateSelected((item) => { item.align = b.dataset.align || 'center'; });
});
els.selTextStyleSeg?.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  mutateSelected((item) => {
    const s = b.dataset.style;
    if (s === 'bold') item.weight = item.weight === 'bold' ? 'normal' : 'bold';
    if (s === 'italic') item.italic = !item.italic;
    if (s === 'shadow') item.shadow = !item.shadow;
    if (s === 'outline') item.outline = !item.outline;
    if (s === 'bg') item.bg = item.bg ? '' : els.selTextBg.value;
  });
});
els.selOverlayFilterSeg?.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  mutateSelected((item) => { item.filter = b.dataset.filter || 'none'; });
});

function applyPaletteFromImage() {
  if (!state.image) { toast(t('ed.needImageFirst')); return; }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    c.width = 32; c.height = 32;
    ctx.drawImage(img, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < data.length; j += 16) { r += data[j]; g += data[j + 1]; b += data[j + 2]; n++; }
    const avg = [r / n, g / n, b / n];
    const toHex = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    const hex = (arr) => '#' + arr.map(toHex).join('');
    state.bg = hex(avg.map((v) => v + (255 - v) * 0.76));
    state.bg2 = hex(avg.map((v) => v + (255 - v) * 0.55));
    state.accent = hex(avg.map((v) => v * 0.62));
    state.fg = '#2f3437';
    ['bg', 'bg2', 'fg', 'accent'].forEach((k) => touched.add(k));
    syncInputsFromState();
    draw();
  };
  img.onerror = () => toast(t('ed.paletteReadFail'));
  img.src = state.image;
}

els.extractPalette?.addEventListener('click', applyPaletteFromImage);

// ---------- Gợi ý lời chúc bằng AI ----------
// Gọi /api/suggest (server giấu key Claude), điền title + message. Coi là "đã chỉnh"
// để template không ghi đè. Nếu chưa cấu hình (503) báo nhẹ + ẩn nút.
// Nút "Another" (regen) gọi lại cùng hàm — giữ nguyên occasion/tone/notes để ra biến thể mới.
// mode='polish' gửi title/message hiện có để AI trau chuốt (giữ ý), không sinh mới.
async function runSuggest(mode = 'generate') {
  if (mode === 'polish' && !state.title?.trim() && !state.message?.trim()) {
    toast(t('ai.needText')); return;
  }
  const btn = mode === 'polish' ? els.aiPolish : els.aiSuggest;
  if (!btn) return;
  const orig = btn.textContent;
  btn.disabled = true; if (els.aiRegen) els.aiRegen.disabled = true;
  btn.textContent = t('ai.working');
  try {
    const res = await fetch('/api/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        occasion: state.template || 'plain',
        recipient: state.recipient || '',
        tone: els.aiTone?.value || 'warm',
        lang: getLang(),
        notes: (els.aiNotes?.value || '').trim(),
        title: state.title || '',
        message: state.message || '',
      }),
    });
    const data = await res.json();
    if (res.status === 503) {
      toast(t('ai.unconfigured'));
      if (els.aiSuggest) els.aiSuggest.hidden = true;
      if (els.aiRegen) els.aiRegen.hidden = true;
      if (els.aiPolish) els.aiPolish.hidden = true;
      return;
    }
    if (!res.ok) throw new Error(data.error || t('ai.fail'));
    if (data.title) { state.title = data.title; touched.add('title'); }
    if (data.message) { state.message = data.message; touched.add('message'); }
    syncInputsFromState();
    draw();
    if (els.aiRegen) els.aiRegen.hidden = false;   // đã có 1 lần -> cho tạo biến thể khác
    toast(t('ai.done'));
  } catch (err) {
    toast(err.message || t('ai.fail'));
  } finally {
    btn.disabled = false; if (els.aiRegen) els.aiRegen.disabled = false;
    btn.textContent = orig;
  }
}
els.aiSuggest?.addEventListener('click', () => runSuggest('generate'));
els.aiRegen?.addEventListener('click', () => runSuggest('generate'));
els.aiPolish?.addEventListener('click', () => runSuggest('polish'));

function resolveItem(node) {
  if (node.classList.contains('c-sticker')) {
    const i = +node.dataset.i; return { arr: state.stickers, item: state.stickers[i], i, type: 'sticker' };
  }
  if (node.classList.contains('c-textblock')) {
    const i = +node.dataset.ti; return { arr: state.textBlocks, item: state.textBlocks[i], i, type: 'text' };
  }
  const i = +node.dataset.i; return { arr: state.overlays, item: state.overlays[i], i, type: 'overlay' };
}


function attachInteractions() {
  const surface = els.preview;
  surface.querySelectorAll('.c-sticker, .c-overlay, .c-textblock').forEach((node) => {
    const resolved = resolveItem(node);
    node.style.pointerEvents = 'auto';
    node.style.cursor = resolved.item?.locked ? 'default' : 'grab';
    node.addEventListener('pointerdown', startDrag);   // startDrag đã tự setSelected — không cần listener chọn riêng
    node.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const it = resolveItem(node);
      if (it.item?.locked) return;
      // Khối chữ: nháy đúp để SỬA (không xóa). Sticker/overlay: nháy đúp để XÓA (như cũ).
      if (it.type === 'text') { startTextEdit(node, it.i); return; }
      it.arr.splice(it.i, 1);
      setSelected(null, null);   // reset index để không chọn/xóa nhầm item kế (fix staleness)
      draw();
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
    const txt = node.textContent.trim().slice(0, 120);   // khớp trần server (120) để preview không lệch kết quả
    if (!txt) state.textBlocks.splice(i, 1);
    else if (state.textBlocks[i]) state.textBlocks[i].text = txt;
    draw();
  };
  node.addEventListener('keydown', onKey);
  node.addEventListener('blur', onBlur, { once: true });
}

function snapValue(v, axis) {
  if (state.snap === false) return { value: v, snapped: false };
  const guides = [0, 25, 50, 75, 100];
  for (const g of guides) {
    if (Math.abs(v - g) <= 2.2) return { value: g, snapped: true };
  }
  return { value: v, snapped: false };
}

function showGuides(x, y) {
  if (els.guideX) els.guideX.hidden = !x;
  if (els.guideY) els.guideY.hidden = !y;
}

function startDrag(e) {
  if (drawing.on) return;
  if (e.currentTarget.isContentEditable) return; // đang sửa chữ thì không kéo
  e.preventDefault();
  const node = e.currentTarget;
  const { arr, i } = resolveItem(node);
  const item = arr[i];
  const type = node.classList.contains('c-textblock') ? 'text' : node.classList.contains('c-sticker') ? 'sticker' : 'overlay';
  setSelected(type, i);
  if (item?.locked) return;
  const rect = els.preview.getBoundingClientRect();
  drag = { item, rect, node };
  node.style.cursor = 'grabbing';
  node.setPointerCapture(e.pointerId);
  node.addEventListener('pointermove', onDrag);
  // pointerup thường; pointercancel/lostpointercapture để không rò listener khi mất capture
  // (menu ngữ cảnh, node bị draw() dựng lại, hệ điều hành gián đoạn).
  node.addEventListener('pointerup', endDrag, { once: true });
  node.addEventListener('pointercancel', endDrag, { once: true });
  node.addEventListener('lostpointercapture', endDrag, { once: true });
}
function onDrag(e) {
  if (!drag) return;
  const { item, rect } = drag;
  const sx = snapValue(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)), 'x');
  const sy = snapValue(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)), 'y');
  item.x = sx.value;
  item.y = sy.value;
  showGuides(sx.snapped, sy.snapped);
  drag.node.style.left = item.x + '%';
  drag.node.style.top = item.y + '%';
}
function endDrag() {
  if (drag) {
    const node = drag.node;
    node.style.cursor = 'grab';
    node.removeEventListener('pointermove', onDrag);
    // gỡ các listener kết thúc còn treo (cái đã fire tự gỡ do {once}; cái chưa thì gỡ ở đây)
    node.removeEventListener('pointerup', endDrag);
    node.removeEventListener('pointercancel', endDrag);
    node.removeEventListener('lostpointercapture', endDrag);
    drag = null;
    showGuides(false, false);
    draw();
  }
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
const ARROW_STEP = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
document.addEventListener('keydown', (e) => {
  const ae = document.activeElement;
  const typing = ae?.isContentEditable || ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA';

  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
    if (typing) return;
    const it = selectedItem();
    if (it && !it.item.locked) {
      snapshotHistoryNow();   // hành động rời rạc → commit ngay, không debounce
      it.arr.splice(it.i, 1);
      setSelected(null, null);
      draw();
    }
    return;
  }

  // Nudge đối tượng đang chọn bằng phím mũi tên: 1% mỗi lần, Shift = 5%.
  // Kẹp trong [0,100]. Bỏ qua khi đang gõ trong ô nhập.
  if (ARROW_STEP[e.key] && selected && !typing) {
    const it = selectedItem();
    if (!it || it.item.locked) return;
    e.preventDefault();
    const [dx, dy] = ARROW_STEP[e.key];
    const step = e.shiftKey ? 5 : 1;
    it.item.x = Math.min(100, Math.max(0, (it.item.x ?? 50) + dx * step));
    it.item.y = Math.min(100, Math.max(0, (it.item.y ?? 50) + dy * step));
    draw();
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
    clearDraft();   // tạo xong -> bỏ nháp để lần sau vào /create là trắng
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
  // Nút chia sẻ native (Web Share API) — chỉ hiện nếu trình duyệt hỗ trợ (đa phần mobile).
  const shareBtn = $('#shareBtn');
  if (shareBtn && navigator.share) {
    shareBtn.hidden = false;
    shareBtn.onclick = () => {
      navigator.share({ title: state.title || t('modal.h3'), text: t('modal.shareText'), url: shareUrl }).catch(() => {});
    };
  }
  $('#successModal').hidden = false;
}

// Vẽ QR cho link gửi đi. Dùng thư viện qrcode (nạp qua CDN ở create.html).
// Tô QR theo màu accent của thiệp cho đồng bộ; nền vẫn trắng để đảm bảo quét được.
function renderQR(url) {
  const box = $('#qrBox');
  if (!box) return;
  box.innerHTML = '';
  if (typeof window.QRCode === 'undefined') { box.hidden = true; return; }
  // accent tối thì dùng làm màu QR; nếu quá nhạt (khó quét) thì lùi về đen.
  const accent = /^#[0-9a-fA-F]{6}$/.test(state.accent || '') ? state.accent : '#111111';
  const dark = contrastRatio(accent, '#ffffff') >= 3 ? accent : '#111111';
  try {
    new window.QRCode(box, {
      text: url, width: 132, height: 132,
      colorDark: dark, colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M,
    });
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
  const d = localizedDefaultsFor(state.template || 'birthday');
  if (!touched.has('title')) state.title = d.title;
  if (!touched.has('message')) state.message = d.message;
  syncInputsFromState();
  // dịch lại tên template (được thêm động)
  document.querySelectorAll('#templateGrid [data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  buildDesignPresets();
  renderSavedTemplates();
  draw(); // cập nhật nhãn "Gửi" trên thiệp
});

// ---------- Init ----------
buildTemplateGrid();
buildStickerPicker();
buildPaletteGrid();
buildDesignPresets();
renderSavedTemplates();
markTemplate('birthday');
ensureDesignState();
syncInputsFromState();
applyI18n();
state.recipientLabel = t('to');
renderCard(els.preview, state);
attachInteractions();
syncDesignPanels();
if (els.hero) renderCard(els.hero, { ...defaultsFor('love'), recipientLabel: t('to') });
window.addEventListener('resize', () => { if (drawing.on) resizeCanvas(); });

// ---------- Tự lưu nháp vào localStorage ----------
// Lưu state (kèm base64) sau mỗi thay đổi, debounce 800ms. Chỉ ở chế độ /create thuần
// (không edit/clone). Khôi phục khi quay lại nếu người dùng chưa tạo xong. Bỏ nháp sau
// khi tạo thành công. try/catch vì quota localStorage có thể đầy do ảnh base64.
const DRAFT_KEY = 'cardmaker.draft';
const isFreshCreate = !new URLSearchParams(location.search).get('edit')
  && !new URLSearchParams(location.search).get('clone')
  && new URLSearchParams(location.search).get('reply') !== '1';
let draftTimer = 0;
function saveDraft() {
  if (!isFreshCreate) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ state: cloneState(), touched: [...touched], days: selectedDays, savedAt: Date.now() }));
    } catch { /* quota đầy (ảnh lớn) — bỏ qua, không chặn thao tác */ }
  }, 800);
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }
function restoreDraft() {
  if (!isFreshCreate) return false;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return false; }
  if (!saved?.state) return false;
  state = { ...defaultsFor(saved.state.template || 'birthday'), ...saved.state };
  ensureDesignState();
  (saved.touched || []).forEach((k) => touched.add(k));
  if (Array.isArray(saved.days)) selectedDays = saved.days;
  else if (saved.days) selectedDays = saved.days;
  if (state.template) markTemplate(state.template);
  setActive('#durationSeg', 'days', String(selectedDays));
  syncInputsFromState();
  state.recipientLabel = t('to');
  renderCard(els.preview, state);
  attachInteractions();
  syncDesignPanels();
  toast(t('ed.draftRestored'));
  return true;
}
// bắt mọi thay đổi trong khu vực soạn (capture-phase, cùng chỗ history)
['input', 'change', 'pointerup'].forEach((ev) =>
  document.addEventListener(ev, (e) => {
    if (isRestoringHistory) return;
    if (e.target?.closest?.('.editor-controls, .preview-stage')) saveDraft();
  }, true));

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
    ensureDesignState();
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

// Thiệp phản hồi: /create?reply=1&to=&from= -> prefill người nhận/người gửi (đảo vai),
// để trống tiêu đề+lời nhắn cho người dùng tự viết. Không đụng edit/clone/token.
(function maybeReplyPrefill() {
  const params = new URLSearchParams(location.search);
  if (params.get('reply') !== '1') return false;
  const to = (params.get('to') || '').slice(0, 80);
  const from = (params.get('from') || '').slice(0, 80);
  if (to) { state.recipient = to; touched.add('recipient'); }
  if (from) { state.sender = from; touched.add('sender'); }
  syncInputsFromState();
  draw();
  return true;
})();

// Khôi phục nháp nếu là /create thuần và có nháp đã lưu (chạy sau init, không đụng edit/clone).
// Bỏ qua khi đang ở chế độ reply prefill (đã điền sẵn, không ghi đè bằng nháp cũ).
if (new URLSearchParams(location.search).get('reply') !== '1') restoreDraft();
