import express from 'express';
import { customAlphabet } from 'nanoid';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import db, { purgeExpired } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * DAY;
const ALLOWED_DAYS = [1, 7, 30];   // các mốc thời hạn cho phép
const MAX_DAYS = 30;
const REACTION_SET = ['❤️', '🎉', '😍', '👏', '🥹', '🔥', '🌸', '😂'];

// KLIPY — nguồn GIF/Sticker miễn phí (thay Tenor đã đóng cửa). Key chỉ ở server,
// KHÔNG bao giờ gửi cho client; client gọi qua proxy /api/gif/search.
const KLIPY_KEY = process.env.KLIPY_KEY || '';
const KLIPY_LIMIT = 24;
if (!KLIPY_KEY) {
  console.warn('[klipy] KLIPY_KEY chưa đặt — route /api/gif/search sẽ trả 503.');
}

// id thiệp (công khai, trong link gửi đi) và token quản lý (bí mật) dùng bảng chữ an toàn URL.
const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);
const makeToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 24);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

// --- Giới hạn nội dung để tránh payload lạm dụng ---
const LIMITS = {
  title: 120,
  recipient: 80,
  sender: 80,
  message: 2000,
  imageBytes: 1_500_000,   // ~1.5MB cho data URL ảnh chính
  overlayBytes: 800_000,   // ảnh phụ (sticker ảnh) nhỏ hơn
  overlayUrl: 2048,        // độ dài tối đa URL remote cho overlay (GIF KLIPY)
  drawingBytes: 1_200_000, // lớp nét vẽ
  stickers: 24,
  overlays: 8,
  sticker: 16,             // độ dài tối đa 1 emoji/ký tự sticker
  gifQuery: 80,            // độ dài tối đa từ khóa tìm GIF
};

function clampString(v, max) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
function cleanHex(v) {
  const s = clampString(v, 9);
  return HEX.test(s) ? s : '';
}

// Chỉ chấp nhận ảnh raster base64 hợp lệ; loại bỏ data:image/svg+xml và chuỗi rác.
// Kiểm tra độ dài TRƯỚC khi cắt: ảnh quá lớn bị từ chối hẳn, không lưu data URL cụt.
const DATA_IMG = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/;
function cleanDataImage(v, maxBytes) {
  if (typeof v !== 'string' || v.length > maxBytes) return '';
  return DATA_IMG.test(v) ? v : '';
}

// Cổng chặn SSRF cho ảnh remote (overlay GIF KLIPY). So khớp trên hostname ĐÃ PARSE
// (không phải substring) nên 'media.klipy.com.evil.com' và 'x@evil.com' đều bị loại.
// new URL() đã loại userinfo khỏi hostname và punycode-hóa, nên homograph cũng bị chặn.
const REMOTE_IMG_HOSTS = ['klipy.com', 'klipy.co'];
function cleanRemoteImage(v) {
  if (typeof v !== 'string' || v.length === 0 || v.length > LIMITS.overlayUrl) return '';
  let u;
  try { u = new URL(v); } catch { return ''; }
  if (u.protocol !== 'https:') return '';   // chỉ https; chặn http/data/javascript/file/blob
  const host = u.hostname.toLowerCase();
  // host === gốc HOẶC kết thúc bằng '.<gốc>'. Dấu '.' chặn 'evilklipy.com' & 'klipy.com.evil.tld'.
  const ok = REMOTE_IMG_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  if (!ok) return '';
  return u.href;   // URL chuẩn hóa
}

/** Lọc & chuẩn hóa payload thiệp từ client thành đối tượng an toàn để lưu. */
function sanitizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const allowedTemplates = ['birthday', 'love', 'thanks', 'congrats', 'holiday', 'wedding', 'newbaby', 'plain'];
  const allowedEffects = ['none', 'confetti', 'petals', 'snow', 'hearts', 'bubbles', 'sparkle', 'bokeh', 'leaves', 'fireworks'];
  const allowedFonts = ['serif', 'sans', 'mono', 'display', 'hand'];
  const allowedBgStyles = ['solid', 'gradient', 'pattern'];
  const allowedPatterns = ['dots', 'grid', 'paper', 'diagonal', 'confettiBg'];
  const allowedLayouts = ['top', 'full', 'none'];
  const allowedFrames = ['none', 'line', 'double', 'dashed', 'inset'];
  const allowedRatios = ['portrait', 'landscape', 'square'];
  const allowedSizes = ['s', 'm', 'l'];
  const allowedTitleSizes = ['s', 'm', 'l', 'xl'];

  // Stickers: emoji/ký tự + vị trí + tỉ lệ + góc xoay
  const stickers = Array.isArray(raw.stickers)
    ? raw.stickers.slice(0, LIMITS.stickers).map((s) => ({
        char: clampString(s?.char, LIMITS.sticker),
        x: clampNum(s?.x, 0, 100, 50),
        y: clampNum(s?.y, 0, 100, 50),
        scale: clampNum(s?.scale, 0.3, 6, 1),
        rot: clampNum(s?.rot, -180, 180, 0),
      })).filter((s) => s.char)
    : [];

  // Overlay images: ảnh phụ có thể di chuyển
  const overlays = Array.isArray(raw.overlays)
    ? raw.overlays.slice(0, LIMITS.overlays).map((o) => ({
        // Ưu tiên ảnh base64 inline; nếu rỗng thì thử URL KLIPY đã allowlist.
        src: cleanDataImage(o?.src, LIMITS.overlayBytes) || cleanRemoteImage(o?.src),
        x: clampNum(o?.x, 0, 100, 50),
        y: clampNum(o?.y, 0, 100, 50),
        scale: clampNum(o?.scale, 0.1, 4, 1),
        rot: clampNum(o?.rot, -180, 180, 0),
        round: o?.round === true,
      })).filter((o) => o.src)   // overlay thất bại CẢ HAI cleaner đều bị bỏ
    : [];

  // Khối chữ tự do (#6): text + vị trí + cỡ + màu + góc
  const textBlocks = Array.isArray(raw.textBlocks)
    ? raw.textBlocks.slice(0, 12).map((b) => ({
        text: clampString(b?.text, 120),
        x: clampNum(b?.x, 0, 100, 50),
        y: clampNum(b?.y, 0, 100, 50),
        size: clampNum(b?.size, 8, 64, 20),
        rot: clampNum(b?.rot, -180, 180, 0),
        color: cleanHex(b?.color) || '',
      })).filter((b) => b.text)
    : [];

  const payload = {
    template: allowedTemplates.includes(raw.template) ? raw.template : 'birthday',
    title: clampString(raw.title, LIMITS.title),
    recipient: clampString(raw.recipient, LIMITS.recipient),
    sender: clampString(raw.sender, LIMITS.sender),
    message: clampString(raw.message, LIMITS.message),

    // Màu & nền
    bg: cleanHex(raw.bg),
    bg2: cleanHex(raw.bg2),
    fg: cleanHex(raw.fg),
    accent: cleanHex(raw.accent),
    bgStyle: allowedBgStyles.includes(raw.bgStyle) ? raw.bgStyle : 'solid',
    pattern: allowedPatterns.includes(raw.pattern) ? raw.pattern : 'dots',
    gradientAngle: clampNum(raw.gradientAngle, 0, 360, 135),

    // Chữ
    font: allowedFonts.includes(raw.font) ? raw.font : 'serif',
    titleSize: allowedTitleSizes.includes(raw.titleSize) ? raw.titleSize : 'l',

    // Bố cục & khung
    layout: allowedLayouts.includes(raw.layout) ? raw.layout : 'top',
    frame: allowedFrames.includes(raw.frame) ? raw.frame : 'line',
    radius: clampNum(raw.radius, 0, 28, 12),
    ratio: allowedRatios.includes(raw.ratio) ? raw.ratio : 'portrait',
    size: allowedSizes.includes(raw.size) ? raw.size : 'm',

    // Hiệu ứng
    effect: allowedEffects.includes(raw.effect) ? raw.effect : 'confetti',

    // Ảnh & lớp trang trí
    image: cleanDataImage(raw.image, LIMITS.imageBytes),
    drawing: cleanDataImage(raw.drawing, LIMITS.drawingBytes),
    stickers,
    overlays,
    textBlocks,                               // #6: khối chữ tự do
    envelope: raw.envelope === true,          // #7: mở kiểu phong bì

    // Nhạc & hẹn giờ mở
    music: clampString(raw.music, 300),
    // Trần thực của openAt = thời hạn thiệp (phụ thuộc days, không biết ở đây);
    // tạm chặn trần MAX_DAYS, route sẽ siết lại theo expiresAt thật sau khi tính.
    openAt: clampNum(raw.openAt, 0, Date.now() + MAX_DAYS * DAY, 0),

    allowReplies: raw.allowReplies !== false,
    guestbook: raw.guestbook === true,        // #10: cho người nhận xem lời chúc của nhau
    allowReactions: raw.allowReactions !== false, // #11: cho thả reaction
  };

  return payload;
}

// --- Rate limit đơn giản theo IP (chống spam tạo thiệp) ---
const rl = new Map(); // "bucket:ip" -> { count, resetAt }
const RL_WINDOW = 60 * 1000;
// Quota riêng theo loại hành động: tạo thiệp tốn kém nên siết, reaction tần suất cao nên nới.
const RL_LIMITS = { create: 20, message: 10, reaction: 60, search: 30 };
function rateLimited(req, bucket = 'create') {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const rec = rl.get(key);
  if (!rec || now > rec.resetAt) { rl.set(key, { count: 1, resetAt: now + RL_WINDOW }); return false; }
  rec.count += 1;
  return rec.count > (RL_LIMITS[bucket] ?? 20);
}
// dọn map định kỳ
setInterval(() => { const now = Date.now(); for (const [key, r] of rl) if (now > r.resetAt) rl.delete(key); }, RL_WINDOW);

// Số ngày hợp lệ -> ms (mặc định 7 ngày).
function durationMs(days) {
  const d = Number(days);
  return (ALLOWED_DAYS.includes(d) ? d : 7) * DAY;
}

// Dò URL ảnh trong một object KLIPY (cấu trúc field có thể khác nhau giữa các phiên bản).
// Trả về chuỗi URL đầu tiên tìm thấy theo danh sách khóa ưu tiên, hoặc '' nếu không có.
function pickUrl(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v) return v;
    // KLIPY hay lồng { url, width, height }
    if (v && typeof v === 'object' && typeof v.url === 'string' && v.url) return v.url;
  }
  return '';
}

// --- API: tìm GIF/Sticker qua KLIPY (proxy server-side, giấu API key trong path) ---
// Client gọi /api/gif/search?q=...&kind=gif|sticker. Key KLIPY KHÔNG bao giờ lộ ra ngoài.
// Mọi URL trả về đều qua cleanRemoteImage -> chỉ host *.klipy.com sống sót.
app.get('/api/gif/search', async (req, res) => {
  if (rateLimited(req, 'search')) {
    return res.status(429).json({ error: 'Bạn tìm quá nhanh. Thử lại sau một phút.' });
  }
  if (!KLIPY_KEY) {
    return res.status(503).json({ error: 'Tính năng tìm ảnh động chưa được cấu hình.' });
  }

  const q = clampString(req.query?.q, LIMITS.gifQuery).trim();
  if (!q) return res.status(400).json({ error: 'Nhập từ khóa để tìm.' });

  const kind = req.query?.kind === 'sticker' ? 'stickers' : 'gifs';
  // Key nằm trong PATH của KLIPY — encode để an toàn, và KHÔNG bao giờ lộ ra response.
  const endpoint = `https://api.klipy.com/api/v1/${encodeURIComponent(KLIPY_KEY)}/${kind}/search`;
  const url = new URL(endpoint);
  url.searchParams.set('q', q);
  url.searchParams.set('per_page', String(KLIPY_LIMIT));
  url.searchParams.set('content_filter', 'medium'); // lọc nội dung nhạy cảm

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) {
      console.error(`[klipy] ${kind} search HTTP ${r.status} cho q="${q}"`);
      return res.status(502).json({ error: 'Không lấy được kết quả.' });
    }
    const body = await r.json();
    // Envelope KLIPY: { result, data: { data: [...] } }. Phòng cả mảng trần / data.data / data.
    const list = Array.isArray(body?.data?.data) ? body.data.data
      : Array.isArray(body?.data) ? body.data
      : Array.isArray(body) ? body : [];

    const results = [];
    for (const item of list) {
      const f = item?.file || item?.images || item || {};
      // full: ưu tiên gif/url; preview: ưu tiên thumbnail nhẹ. KLIPY hay lồng theo cỡ (hd/md/sm).
      const full = cleanRemoteImage(
        pickUrl(f, ['gif', 'url', 'webp', 'mp4', 'file'])
        || pickUrl(f.hd || f.md || {}, ['gif', 'url', 'webp'])
        || pickUrl(item, ['url', 'gif'])
      );
      if (!full) continue; // bỏ nếu không có URL nào thuộc *.klipy.com
      const preview = cleanRemoteImage(
        pickUrl(f, ['preview', 'thumbnail', 'sm', 'xs', 'tiny'])
        || pickUrl(f.sm || f.xs || {}, ['gif', 'url', 'webp'])
      ) || full;
      results.push({ id: clampString(item?.slug || item?.id, 64), full, preview });
    }

    res.set('Cache-Control', 'public, max-age=120');
    res.json({ results, attribution: 'Powered by KLIPY' });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'Phản hồi quá chậm. Thử lại.' });
    }
    console.error('[klipy] fetch lỗi:', err?.message || err);
    return res.status(502).json({ error: 'Không lấy được kết quả.' });
  } finally {
    clearTimeout(timer);
  }
});

// --- API: tạo thiệp ---
app.post('/api/cards', (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: 'Bạn tạo thiệp quá nhanh. Thử lại sau một phút.' });

  const payload = sanitizePayload(req.body);
  if (!payload) return res.status(400).json({ error: 'Dữ liệu thiệp không hợp lệ.' });
  if (!payload.title && !payload.message) {
    return res.status(400).json({ error: 'Thiệp cần ít nhất tiêu đề hoặc lời nhắn.' });
  }

  const id = makeId();
  const manageToken = makeToken();
  const now = Date.now();
  const expiresAt = now + durationMs(req.body?.days);

  // Giờ mở không được vượt quá thời hạn thiệp (nếu không, thiệp hết hạn trước khi mở được).
  if (payload.openAt && payload.openAt > expiresAt) payload.openAt = expiresAt;

  db.prepare(
    `INSERT INTO cards (id, manage_token, payload, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, manageToken, JSON.stringify(payload), now, expiresAt);

  res.json({ id, manageToken, expiresAt });
});

// --- API: lấy thiệp (người nhận xem) ---
app.get('/api/cards/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!row || row.expires_at <= Date.now()) {
    return res.status(404).json({ error: 'Thiệp không tồn tại hoặc đã hết hạn.' });
  }

  const payload = JSON.parse(row.payload);

  // Hẹn giờ mở: nếu chưa tới openAt thì KHÔNG trả nội dung thiệp (khóa thực sự
  // ở phía server, không chỉ ẩn trên client). Chỉ trả mốc thời gian để client đếm ngược.
  if (payload.openAt && payload.openAt > Date.now()) {
    return res.json({
      locked: true,
      openAt: payload.openAt,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    });
  }

  res.json({
    payload,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  });
});

// --- API: ghi nhận một lượt xem ---
app.post('/api/cards/:id/view', (req, res) => {
  const info = db
    .prepare('UPDATE cards SET views = views + 1 WHERE id = ? AND expires_at > ?')
    .run(req.params.id, Date.now());
  if (info.changes === 0) return res.status(404).json({ error: 'Không tìm thấy thiệp.' });
  res.json({ ok: true });
});

// --- API: người nhận để lại lời nhắn ---
app.post('/api/cards/:id/messages', (req, res) => {
  if (rateLimited(req, 'message')) return res.status(429).json({ error: 'Bạn gửi quá nhanh. Thử lại sau một phút.' });
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!row || row.expires_at <= Date.now()) {
    return res.status(404).json({ error: 'Thiệp không tồn tại hoặc đã hết hạn.' });
  }
  const payload = JSON.parse(row.payload);
  if (payload.allowReplies === false) {
    return res.status(403).json({ error: 'Thiệp này không nhận lời nhắn.' });
  }

  const body = clampString(req.body?.body, LIMITS.message).trim();
  const sender = clampString(req.body?.sender, LIMITS.sender).trim();
  if (!body) return res.status(400).json({ error: 'Lời nhắn không được để trống.' });

  db.prepare(
    'INSERT INTO messages (card_id, sender, body, created_at) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, sender || null, body, Date.now());

  res.json({ ok: true });
});

// --- API: quản lý (chủ thiệp, dùng manage token) ---
app.get('/api/manage/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE manage_token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Liên kết quản lý không hợp lệ.' });

  const expired = row.expires_at <= Date.now();
  const messages = db
    .prepare('SELECT sender, body, created_at FROM messages WHERE card_id = ? ORDER BY created_at DESC')
    .all(row.id);

  res.json({
    id: row.id,
    payload: JSON.parse(row.payload),
    views: row.views,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    expired,
    messages,
  });
});

// --- API: chủ thiệp sửa nội dung thiệp (#1) ---
app.put('/api/manage/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE manage_token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Liên kết quản lý không hợp lệ.' });
  if (row.expires_at <= Date.now()) return res.status(410).json({ error: 'Thiệp đã hết hạn.' });

  const payload = sanitizePayload(req.body);
  if (!payload) return res.status(400).json({ error: 'Dữ liệu thiệp không hợp lệ.' });
  if (!payload.title && !payload.message) {
    return res.status(400).json({ error: 'Thiệp cần ít nhất tiêu đề hoặc lời nhắn.' });
  }
  // Giờ mở không được vượt quá hạn hiện tại của thiệp.
  if (payload.openAt && payload.openAt > row.expires_at) payload.openAt = row.expires_at;
  db.prepare('UPDATE cards SET payload = ? WHERE manage_token = ?').run(JSON.stringify(payload), req.params.token);
  res.json({ ok: true });
});

// --- API: gia hạn thời hạn thiệp (#3) ---
app.post('/api/manage/:token/extend', (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE manage_token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Liên kết quản lý không hợp lệ.' });

  const addDays = ALLOWED_DAYS.includes(Number(req.body?.days)) ? Number(req.body.days) : 7;
  // gia hạn TỪ thời điểm hiện tại nếu sắp hết, hoặc cộng thêm vào hạn còn lại;
  // chặn trần ở MAX_DAYS kể từ bây giờ để không kéo dài vô hạn.
  const base = Math.max(row.expires_at, Date.now());
  const newExpiry = Math.min(base + addDays * DAY, Date.now() + MAX_DAYS * DAY);
  db.prepare('UPDATE cards SET expires_at = ? WHERE manage_token = ?').run(newExpiry, req.params.token);
  res.json({ ok: true, expiresAt: newExpiry });
});

// --- API: chủ thiệp xóa thiệp sớm ---
app.delete('/api/manage/:token', (req, res) => {
  const info = db.prepare('DELETE FROM cards WHERE manage_token = ?').run(req.params.token);
  if (info.changes === 0) return res.status(404).json({ error: 'Liên kết quản lý không hợp lệ.' });
  res.json({ ok: true });
});

// --- API: lời chúc công khai cho người nhận xem (#10) ---
// Chỉ trả khi thiệp cho phép lời nhắn; ẩn thông tin nhạy cảm.
app.get('/api/cards/:id/messages', (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!row || row.expires_at <= Date.now()) return res.status(404).json({ error: 'Không tìm thấy thiệp.' });
  const payload = JSON.parse(row.payload);
  if (payload.allowReplies === false || payload.guestbook !== true) {
    return res.json({ guestbook: false, messages: [] });
  }
  const messages = db
    .prepare('SELECT sender, body, created_at FROM messages WHERE card_id = ? ORDER BY created_at DESC LIMIT 200')
    .all(req.params.id);
  res.json({ guestbook: true, messages });
});

// --- API: reaction (#11) ---
app.get('/api/cards/:id/reactions', (req, res) => {
  const row = db.prepare('SELECT expires_at FROM cards WHERE id = ?').get(req.params.id);
  if (!row || row.expires_at <= Date.now()) return res.status(404).json({ error: 'Không tìm thấy thiệp.' });
  const rows = db.prepare('SELECT emoji, COUNT(*) n FROM reactions WHERE card_id = ? GROUP BY emoji').all(req.params.id);
  const counts = {};
  for (const r of rows) counts[r.emoji] = r.n;
  res.json({ counts });
});

app.post('/api/cards/:id/reactions', (req, res) => {
  if (rateLimited(req, 'reaction')) return res.status(429).json({ error: 'Bạn thả reaction quá nhanh. Thử lại sau một phút.' });
  const row = db.prepare('SELECT expires_at FROM cards WHERE id = ?').get(req.params.id);
  if (!row || row.expires_at <= Date.now()) return res.status(404).json({ error: 'Không tìm thấy thiệp.' });
  const emoji = req.body?.emoji;
  if (!REACTION_SET.includes(emoji)) return res.status(400).json({ error: 'Reaction không hợp lệ.' });
  db.prepare('INSERT INTO reactions (card_id, emoji, created_at) VALUES (?, ?, ?)').run(req.params.id, emoji, Date.now());
  const rows = db.prepare('SELECT emoji, COUNT(*) n FROM reactions WHERE card_id = ? GROUP BY emoji').all(req.params.id);
  const counts = {};
  for (const r of rows) counts[r.emoji] = r.n;
  res.json({ ok: true, counts });
});

// --- Trang HTML cho route đẹp ---
app.get('/create', (_req, res) => res.sendFile(join(__dirname, 'public', 'create.html')));
app.get('/c/:id', (_req, res) => res.sendFile(join(__dirname, 'views', 'card.html')));
app.get('/m/:token', (_req, res) => res.sendFile(join(__dirname, 'views', 'manage.html')));

// --- Dọn thiệp hết hạn: lúc khởi động + mỗi giờ ---
purgeExpired();
setInterval(() => {
  const removed = purgeExpired();
  if (removed > 0) console.log(`[cleanup] đã xóa ${removed} thiệp hết hạn`);
}, 60 * 60 * 1000);

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Card Maker chạy tại http://localhost:${PORT} (bind ${HOST}:${PORT})`);
});
