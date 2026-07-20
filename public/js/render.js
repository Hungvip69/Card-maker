// Render thiệp dùng chung: editor preview + trang người nhận đều gọi hàm này
// để thiệp hiển thị y hệt nhau. Mọi tùy chỉnh mới phải được render ở đây.

export const TEMPLATES = {
  birthday: { bg: '#fbf3db', bg2: '#f6e3b0', fg: '#2f3437', accent: '#956400', font: 'serif', effect: 'confetti',
    title: 'Happy Birthday!', message: 'Wishing you a year full of health, joy and everything your heart desires.' },
  love: { bg: '#fdebec', bg2: '#f7cdd0', fg: '#3a2326', accent: '#9f2f2d', font: 'serif', effect: 'hearts',
    title: 'For someone I love', message: 'Every day with you is a gift. Thank you for always being here.' },
  thanks: { bg: '#edf3ec', bg2: '#d3e6d2', fg: '#26302a', accent: '#346538', font: 'serif', effect: 'petals',
    title: 'Thank you', message: 'Thank you for everything you have done. I truly appreciate it.' },
  congrats: { bg: '#e1f3fe', bg2: '#bfe3fb', fg: '#1f3340', accent: '#1f6c9f', font: 'serif', effect: 'confetti',
    title: 'Congratulations!', message: 'You earned every bit of this. Congratulations on your new milestone!' },
  holiday: { bg: '#f7f6f3', bg2: '#e6eef5', fg: '#2f3437', accent: '#1f6c9f', font: 'serif', effect: 'snow',
    title: 'Happy Holidays', message: 'May the season bring you peace, warmth and a fresh start.' },
  wedding: { bg: '#faf7f2', bg2: '#efe6d8', fg: '#3a3128', accent: '#9a7b4f', font: 'display', effect: 'petals',
    title: 'Happily ever after', message: 'Wishing you a lifetime of love and laughter together.' },
  newbaby: { bg: '#eef4f8', bg2: '#dcebf2', fg: '#33414a', accent: '#5b91ad', font: 'sans', effect: 'bubbles',
    title: 'Welcome, little one', message: 'A tiny new heartbeat, a whole new world of love.' },
  graduation: { bg: '#eef1f8', bg2: '#d7deef', fg: '#252b3a', accent: '#3f4e8c', font: 'display', effect: 'confetti',
    title: 'Congratulations, graduate!', message: 'All your hard work paid off. Here is to the next chapter!' },
  anniversary: { bg: '#fbeef0', bg2: '#f2ccd4', fg: '#3a2429', accent: '#a83b53', font: 'serif', effect: 'hearts',
    title: 'Happy anniversary', message: 'Another year of us. Grateful for every moment together.' },
  farewell: { bg: '#eef3f4', bg2: '#d6e3e5', fg: '#25353a', accent: '#3f7d86', font: 'serif', effect: 'leaves',
    title: 'Farewell & good luck', message: 'Wishing you all the best on your new journey. Keep in touch!' },
  getwell: { bg: '#eef7f0', bg2: '#d4ecda', fg: '#243528', accent: '#3f8b52', font: 'sans', effect: 'bubbles',
    title: 'Get well soon', message: 'Take it easy and rest up. Sending you warm wishes for a speedy recovery.' },
  plain: { bg: '#ffffff', bg2: '#f1f1ef', fg: '#2f3437', accent: '#787774', font: 'sans', effect: 'none',
    title: 'A note for you', message: 'Write what you want to say here.' },
};

// Bảng màu gợi ý (#8): bộ {bg, bg2, fg, accent} đẹp sẵn để bấm một cái áp vào thiệp.
export const PALETTES = [
  { name: 'sand',    bg: '#fbf3db', bg2: '#f6e3b0', fg: '#2f3437', accent: '#956400' },
  { name: 'blush',   bg: '#fdebec', bg2: '#f7cdd0', fg: '#3a2326', accent: '#9f2f2d' },
  { name: 'sage',    bg: '#edf3ec', bg2: '#d3e6d2', fg: '#26302a', accent: '#346538' },
  { name: 'sky',     bg: '#e1f3fe', bg2: '#bfe3fb', fg: '#1f3340', accent: '#1f6c9f' },
  { name: 'plum',    bg: '#f3e9f5', bg2: '#e2cce8', fg: '#33263a', accent: '#7b4f9a' },
  { name: 'midnight',bg: '#1e2230', bg2: '#2a3145', fg: '#e8e6e3', accent: '#e3bd6a' },
  { name: 'mono',    bg: '#f7f6f3', bg2: '#e8e6e1', fg: '#2f3437', accent: '#787774' },
  { name: 'coral',   bg: '#fff0e8', bg2: '#ffd9c4', fg: '#3a2820', accent: '#d2622e' },
];

// Mặc định đầy đủ cho mọi trường — bảo đảm payload luôn có shape nhất quán.
export function defaultsFor(template) {
  const t = TEMPLATES[template] || TEMPLATES.birthday;
  return {
    template,
    title: t.title, message: t.message, recipient: '', sender: '',
    bg: t.bg, bg2: t.bg2, fg: t.fg, accent: t.accent,
    bgStyle: 'solid', pattern: 'dots', gradientAngle: 135, patternScale: 1, patternOpacity: 0.18, texture: false,
    font: t.font, titleSize: 'l',
    layout: 'top', frame: 'line', shadow: 'soft', radius: 12, ratio: 'portrait', size: 'm',
    effect: t.effect,
    image: '', drawing: '', stickers: [], overlays: [], textBlocks: [], envelope: false, reveal: false, burst: false,
    imageZoom: 1, imageX: 50, imageY: 50, imageRadius: 0, imageOpacity: 1, imageFilter: 'none', scrim: 0.45,
    music: '', openAt: 0, allowReplies: true, guestbook: false, allowReactions: true,
    snap: true,
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const RATIO = { portrait: '4 / 5', landscape: '5 / 4', square: '1 / 1' };
const TITLE_SIZE = { s: '1.5rem', m: '2.1rem', l: '2.6rem', xl: '3.2rem' };

// Số an toàn cho CSS: ép Number, kẹp trong [min,max], fallback nếu NaN/Infinity.
// render.js không tin caller — dựng thiệp cho cả preview (state chưa qua server) lẫn card đã lưu.
function num(v, fallback, min = -Infinity, max = Infinity) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
// Chỉ nhả màu nếu đúng dạng hex; ngăn chuỗi tùy ý chèn vào style (vd 'red;position:fixed').
function safeColor(v) {
  return typeof v === 'string' && HEX_RE.test(v) ? v : '';
}

function alphaHex(n) {
  const v = Math.round(Math.min(1, Math.max(0, Number(n) || 0)) * 255);
  return v.toString(16).padStart(2, '0');
}

function withAlpha(hex, alpha) {
  return /^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex + alphaHex(alpha) : '#787774' + alphaHex(alpha);
}

/** Dựng CSS nền theo bgStyle (đơn sắc / gradient / hoa văn). */
function buildBackground(el, p) {
  const bg = p.bg || '#ffffff';
  const bg2 = p.bg2 || bg;
  el.style.removeProperty('background-image');
  if (p.bgStyle === 'gradient') {
    el.style.background = `linear-gradient(${p.gradientAngle || 135}deg, ${bg}, ${bg2})`;
  } else if (p.bgStyle === 'pattern') {
    el.style.background = bg;
    el.style.backgroundImage = patternCss(p.pattern, p.accent || '#787774', p.patternOpacity ?? 0.18);
  } else {
    el.style.background = bg;
  }
}

function patternCss(pattern, accent, opacity) {
  const a = withAlpha(accent, opacity);
  const b = withAlpha(accent, Math.min(0.7, opacity * 1.6));
  switch (pattern) {
    case 'grid':
      return `linear-gradient(${a} 1px, transparent 1px), linear-gradient(90deg, ${a} 1px, transparent 1px)`;
    case 'paper':
      return `radial-gradient(${a} 1px, transparent 1.4px)`;
    case 'diagonal':
      return `repeating-linear-gradient(45deg, ${a}, ${a} 1px, transparent 1px, transparent 11px)`;
    case 'confettiBg':
      return `radial-gradient(${b} 2px, transparent 3px), radial-gradient(${a} 2px, transparent 3px)`;
    case 'dots':
    default:
      return `radial-gradient(${a} 2px, transparent 2.5px)`;
  }
}

function patternSize(pattern, scale = 1) {
  const s = Math.min(3, Math.max(0.5, Number(scale) || 1));
  switch (pattern) {
    case 'grid': return `${22 * s}px ${22 * s}px`;
    case 'paper': return `${14 * s}px ${14 * s}px`;
    case 'diagonal': return 'auto';
    case 'confettiBg': return `${40 * s}px ${40 * s}px, ${40 * s}px ${40 * s}px`;
    case 'dots':
    default: return `${20 * s}px ${20 * s}px`;
  }
}

function imageFilterCss(name) {
  switch (name) {
    case 'warm': return 'saturate(0.9) sepia(0.18) hue-rotate(-8deg)';
    case 'cool': return 'saturate(0.85) hue-rotate(10deg) brightness(1.02)';
    case 'mono': return 'grayscale(1) contrast(1.04)';
    case 'fade': return 'saturate(0.72) contrast(0.92) brightness(1.06)';
    default: return 'none';
  }
}

function imageStyle(p) {
  const zoom = Math.min(2.5, Math.max(1, Number(p.imageZoom) || 1));
  const x = Math.min(100, Math.max(0, Number(p.imageX) || 50));
  const y = Math.min(100, Math.max(0, Number(p.imageY) || 50));
  const radius = Math.min(28, Math.max(0, Number(p.imageRadius) || 0));
  const opacity = Math.min(1, Math.max(0.1, Number(p.imageOpacity) || 1));
  return `object-position:${x}% ${y}%;transform:scale(${zoom});border-radius:${radius}px;opacity:${opacity};filter:${imageFilterCss(p.imageFilter)};`;
}

function itemOrder(items) {
  return [...(Array.isArray(items) ? items : [])].map((item, i) => ({ item, i }))
    .sort((a, b) => (a.item.z ?? 0) - (b.item.z ?? 0));
}

/**
 * Dựng nội dung thiệp vào một phần tử .card-surface.
 * @param {HTMLElement} el  phần tử .card-surface
 * @param {object} p        payload thiệp (đã merge với defaults)
 */
export function renderCard(el, p) {
  const t = TEMPLATES[p.template] || TEMPLATES.birthday;
  const fg = p.fg || t.fg;
  const accent = p.accent || t.accent;
  const font = p.font || t.font;
  const layout = p.layout || 'top';

  // Tỉ lệ & kích cỡ
  if (!el.dataset.fixedRatio) {
    el.style.aspectRatio = RATIO[p.ratio] || RATIO.portrait;
  }
  el.classList.remove('size-s', 'size-m', 'size-l');
  el.classList.add('size-' + (p.size || 'm'));

  // Nền
  buildBackground(el, p);
  if (p.bgStyle === 'pattern') el.style.backgroundSize = patternSize(p.pattern, p.patternScale);
  else el.style.removeProperty('background-size');
  el.dataset.texture = p.texture ? 'paper' : 'none';

  // Màu chữ & accent
  el.style.setProperty('--c-fg', fg);
  el.style.setProperty('--c-accent', accent);
  el.style.setProperty('--c-title-size', TITLE_SIZE[p.titleSize] || TITLE_SIZE.l);
  el.style.setProperty('--c-radius', (p.radius ?? 12) + 'px');
  el.style.borderRadius = (p.radius ?? 12) + 'px';

  // Font
  el.classList.remove('font-serif', 'font-sans', 'font-mono', 'font-display', 'font-hand');
  el.classList.add('font-' + font);

  // Layout class
  el.classList.remove('layout-top', 'layout-full', 'layout-none', 'no-image');
  const hasImage = !!p.image;
  if (!hasImage) {
    el.classList.add('layout-none', 'no-image');
  } else {
    el.classList.add('layout-' + (layout === 'none' ? 'top' : layout));
  }

  // Frame + shadow (bóng đổ ngoài của thẻ)
  el.dataset.frame = p.frame || 'line';
  el.dataset.shadow = p.shadow || 'soft';

  const title = p.title || t.title;
  const message = p.message || '';
  const fullBg = hasImage && layout === 'full';

  el.innerHTML = `
    ${hasImage && layout === 'full' ? `<img class="c-image c-image-full" src="${esc(p.image)}" alt="" style="${imageStyle(p)}">` : ''}
    ${hasImage && layout !== 'full' ? `<img class="c-image" src="${esc(p.image)}" alt="" style="${imageStyle(p)}">` : ''}
    <div class="c-frame"></div>
    ${fullBg ? `<div class="c-scrim" style="opacity:${Math.min(0.8, Math.max(0, Number(p.scrim) || 0))}"></div>` : ''}
    <div class="c-body">
      ${p.recipient ? `<div class="c-recipient">${esc(recipientLabel(p))}</div>` : ''}
      <div class="c-title">${esc(title)}</div>
      ${message ? `<div class="c-rule"></div><div class="c-message">${esc(message)}</div>` : ''}
      ${p.sender ? `<div class="c-sender">— ${esc(p.sender)}</div>` : ''}
    </div>
    <div class="c-overlays">${renderOverlays(p.overlays)}${renderStickers(p.stickers)}${renderTextBlocks(p.textBlocks)}</div>
    ${p.drawing ? `<img class="c-drawing" src="${esc(p.drawing)}" alt="">` : ''}
    <div class="fx-layer" aria-hidden="true"></div>
  `;

  applyEffect(el.querySelector('.fx-layer'), p.effect || t.effect, accent);
}

// "Gửi X" — nhãn này do editor truyền sẵn qua p.recipientLabel để theo ngôn ngữ;
// fallback tiếng Anh nếu không có.
function recipientLabel(p) {
  if (p.recipientLabel) return p.recipientLabel.replace('{name}', p.recipient);
  return 'To ' + p.recipient;
}

function renderStickers(stickers) {
  if (!Array.isArray(stickers)) return '';
  return itemOrder(stickers).filter(({ item: s }) => !s.hidden).map(({ item: s, i }) => `
    <span class="c-sticker" data-i="${i}" style="left:${num(s.x, 50, 0, 100)}%;top:${num(s.y, 50, 0, 100)}%;z-index:${num(s.z, 10, 0, 999)};opacity:${num(s.opacity, 1, 0, 1)};transform:translate(-50%,-50%) rotate(${num(s.rot, 0, -180, 180)}deg) scale(${(s.flipX ? -1 : 1) * num(s.scale, 1, 0.3, 6)},${(s.flipY ? -1 : 1) * num(s.scale, 1, 0.3, 6)})">${esc(s.char)}</span>
  `).join('');
}

function renderOverlays(overlays) {
  if (!Array.isArray(overlays)) return '';
  return itemOrder(overlays).filter(({ item: o }) => !o.hidden).map(({ item: o, i }) => `
    <img class="c-overlay${o.round ? ' round' : ''}" data-i="${i}" src="${esc(o.src)}" alt=""
      style="left:${num(o.x, 50, 0, 100)}%;top:${num(o.y, 50, 0, 100)}%;z-index:${num(o.z, 20, 0, 999)};opacity:${num(o.opacity, 1, 0, 1)};filter:${imageFilterCss(o.filter)};transform:translate(-50%,-50%) rotate(${num(o.rot, 0, -180, 180)}deg) scale(${(o.flipX ? -1 : 1) * num(o.scale, 1, 0.1, 4)},${(o.flipY ? -1 : 1) * num(o.scale, 1, 0.1, 4)})">
  `).join('');
}

// Khối chữ tự do (#6). color rỗng -> kế thừa màu chữ thiệp.
function renderTextBlocks(blocks) {
  if (!Array.isArray(blocks)) return '';
  const fontMap = { serif: 'var(--serif)', sans: 'var(--sans)', mono: 'var(--mono)', display: 'var(--display)', hand: 'var(--hand)' };
  return itemOrder(blocks).filter(({ item: b }) => !b.hidden).map(({ item: b, i }) => {
    const color = safeColor(b.color);
    const bg = safeColor(b.bg);
    const style = [
      `left:${num(b.x, 50, 0, 100)}%`,
      `top:${num(b.y, 50, 0, 100)}%`,
      `font-size:${num(b.size, 20, 8, 64)}px`,
      `z-index:${num(b.z, 30, 0, 999)}`,
      `opacity:${num(b.opacity, 1, 0, 1)}`,
      `text-align:${b.align === 'left' || b.align === 'right' ? b.align : 'center'}`,
      `font-weight:${b.weight === 'bold' ? 700 : 400}`,
      `font-style:${b.italic ? 'italic' : 'normal'}`,
      color ? `color:${color}` : '',
      bg ? `background:${bg}` : '',
      bg ? 'padding:0.12em 0.28em' : '',
      bg ? 'border-radius:5px' : '',
      b.font && fontMap[b.font] ? `font-family:${fontMap[b.font]}` : '',
      b.shadow ? 'text-shadow:0 1px 8px rgba(0,0,0,0.22)' : '',
      b.outline ? '-webkit-text-stroke:0.45px currentColor' : '',
      `transform:translate(-50%,-50%) rotate(${num(b.rot, 0, -180, 180)}deg)`,
    ].filter(Boolean).join(';');
    return `<span class="c-textblock" data-ti="${i}" style="${style}">${esc(b.text)}</span>`;
  }).join('');
}

const CONFETTI_COLORS = ['#9f2f2d', '#1f6c9f', '#346538', '#956400', '#2f3437', '#b5651d'];

function applyEffect(layer, effect, accent) {
  if (!layer) return;
  layer.innerHTML = '';
  if (!effect || effect === 'none') return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = reduce ? 10 : 28;
  const count = effect === 'fireworks' ? (reduce ? 6 : 16) : base;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'fx-piece';
    const left = Math.random() * 100;
    const dur = 4 + Math.random() * 5;
    const delay = -Math.random() * dur;
    const size = 6 + Math.random() * 8;
    const spin = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540);
    piece.style.left = left + '%';
    piece.style.setProperty('--spin', spin + 'deg');

    const fall = (anim) => { if (!reduce) piece.style.animation = anim; };

    if (effect === 'confetti') {
      piece.style.width = size + 'px'; piece.style.height = size * 0.5 + 'px';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.borderRadius = '1px';
      fall(`fx-fall ${dur}s linear ${delay}s infinite`);
    } else if (effect === 'snow') {
      piece.style.width = piece.style.height = size * 0.7 + 'px';
      piece.style.background = '#fff'; piece.style.borderRadius = '50%';
      piece.style.boxShadow = '0 0 3px rgba(0,0,0,0.06)';
      fall(`fx-fall ${dur}s linear ${delay}s infinite`);
    } else if (effect === 'petals') {
      piece.style.width = size + 'px'; piece.style.height = size * 1.2 + 'px';
      piece.style.background = accent; piece.style.opacity = '0.55';
      piece.style.borderRadius = '60% 0 60% 0';
      fall(`fx-sway ${dur}s ease-in-out ${delay}s infinite`);
    } else if (effect === 'hearts') {
      piece.style.width = piece.style.height = size + 'px';
      piece.style.background = accent; piece.style.opacity = '0.6';
      piece.style.clipPath = "path('M8 14C8 14 1 9.5 1 4.8C1 2.7 2.7 1 4.8 1C6.1 1 7.3 1.7 8 2.8C8.7 1.7 9.9 1 11.2 1C13.3 1 15 2.7 15 4.8C15 9.5 8 14 8 14Z')";
      fall(`fx-sway ${dur}s ease-in-out ${delay}s infinite`);
    } else if (effect === 'bubbles') {
      piece.style.top = 'auto'; piece.style.bottom = '-12%';
      piece.style.width = piece.style.height = size * 1.1 + 'px';
      piece.style.borderRadius = '50%';
      piece.style.background = 'transparent';
      piece.style.border = `1px solid ${accent}66`;
      piece.style.boxShadow = `inset 0 0 6px ${accent}22`;
      fall(`fx-rise ${dur}s ease-in ${delay}s infinite`);
    } else if (effect === 'sparkle') {
      piece.style.width = piece.style.height = size * 0.8 + 'px';
      piece.style.top = Math.random() * 100 + '%';
      piece.style.background = accent;
      piece.style.clipPath = 'polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)';
      if (!reduce) piece.style.animation = `fx-twinkle ${1.2 + Math.random() * 2}s ease-in-out ${delay}s infinite`;
    } else if (effect === 'bokeh') {
      const s2 = size * (2 + Math.random() * 2);
      piece.style.width = piece.style.height = s2 + 'px';
      piece.style.top = Math.random() * 100 + '%';
      piece.style.borderRadius = '50%';
      piece.style.background = `radial-gradient(circle, ${accent}55, transparent 70%)`;
      if (!reduce) piece.style.animation = `fx-drift ${6 + Math.random() * 6}s ease-in-out ${delay}s infinite`;
    } else if (effect === 'leaves') {
      piece.style.width = size * 1.1 + 'px'; piece.style.height = size * 0.7 + 'px';
      piece.style.background = i % 2 ? '#b5651d' : '#346538'; piece.style.opacity = '0.6';
      piece.style.borderRadius = '0 70% 0 70%';
      fall(`fx-sway ${dur}s ease-in-out ${delay}s infinite`);
    } else if (effect === 'fireworks') {
      piece.style.left = (10 + Math.random() * 80) + '%';
      piece.style.top = (10 + Math.random() * 50) + '%';
      piece.style.width = piece.style.height = '3px';
      piece.style.borderRadius = '50%';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.setProperty('--bx', (Math.random() * 80 - 40) + 'px');
      piece.style.setProperty('--by', (Math.random() * 80 - 40) + 'px');
      if (!reduce) piece.style.animation = `fx-burst ${1 + Math.random() * 1.5}s ease-out ${delay}s infinite`;
    }
    layer.appendChild(piece);
  }
}
