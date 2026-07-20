# Cards Maker

[![CI](https://github.com/Hungvip69/Card-maker/actions/workflows/ci.yml/badge.svg)](https://github.com/Hungvip69/Card-maker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)

Tạo thiệp đẹp, chia sẻ qua link riêng, tự hết hạn sau 1/7/30 ngày.

## Tính năng

- Trình tạo thiệp với template, màu, font, hiệu ứng, bố cục, khung
- Sticker emoji, ảnh dán di chuyển được, khối chữ tự do, vẽ tay trên thiệp
- Tìm GIF & sticker online qua KLIPY
- Nhạc nền (YouTube/Spotify), hẹn giờ mở, sổ lưu bút, reaction emoji
- Link quản lý bí mật: xem lượt xem, lời nhắn, gia hạn, sửa, xóa
- Đa ngôn ngữ (vi/en/zh/ja/ko), sáng/tối

## Chạy

Cần Node 18+ (dùng `fetch` toàn cục).

```bash
npm install
KLIPY_KEY=<key> npm start
```

Mở http://localhost:3000/create

## Biến môi trường

Xem `.env.example`. `KLIPY_KEY` lấy free tại https://partner.klipy.com — thiếu key thì tính năng tìm GIF trả 503, phần còn lại vẫn chạy.

## Công nghệ

Express · better-sqlite3 · nanoid · vanilla JS/CSS (không bundler)

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

[MIT](LICENSE) — dùng tự do, chỉ cần giữ lại thông báo bản quyền.
