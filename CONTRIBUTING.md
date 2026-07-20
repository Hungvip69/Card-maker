# Đóng góp cho Cards Maker

Cảm ơn bạn đã quan tâm! Dự án dùng vanilla JS/CSS, không bundler, nên rào cản rất thấp.

## Thiết lập

```bash
npm install
cp .env.example .env   # điền KLIPY_KEY nếu cần tính năng tìm GIF
npm run dev            # node --watch, tự reload khi sửa
```

Mở http://localhost:3000/create

## Quy ước

- **Code style**: theo `.editorconfig` (2 space, UTF-8, LF). Giữ nguyên phong cách file xung quanh.
- **Ngôn ngữ**: comment và text hướng người dùng bằng tiếng Việt; tên biến/hàm tiếng Anh.
- **Không thêm dependency** nếu vài dòng tự viết là đủ. Dự án cố ý giữ gọn (Express · better-sqlite3 · nanoid).
- **i18n**: chuỗi mới hiển thị cho người dùng phải thêm vào cả 5 ngôn ngữ trong `public/js/i18n.js` (vi/en/zh/ja/ko).

## Quy trình

1. Fork → tạo nhánh từ `main` (`git checkout -b feat/ten-tinh-nang`).
2. Commit gọn, mô tả rõ *cái gì* + *tại sao*.
3. Mở Pull Request về `main`. CI (Node 18/20/22) phải xanh.

## Báo lỗi

Mở issue kèm: bước tái hiện, hành vi mong đợi vs thực tế, trình duyệt/OS.
