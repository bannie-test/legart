# Legart

Ứng dụng web (ưu tiên điện thoại) cắt tranh và ảnh thành **mảnh ghép jigsaw** (giữ nguyên ảnh gốc, hoặc đổi sang
pixel art / tranh gạch trong cài đặt) để ghép lại trước đồng hồ. Có thư viện 20 kiệt tác Phục Hưng, quiz nghệ thuật song ngữ, 3 độ khó, mảnh vuông hoặc jigsaw, ghi thành tích,
bảng xếp hạng, link thách đấu và chia sẻ lên mạng xã hội.

*A mobile-first web game that turns paintings and photos into brick-mosaic puzzles (square or jigsaw pieces),
with timed play, bilingual EN/VI art quizzes, recorded results, leaderboards, challenge links and social sharing.*

> Not affiliated with or endorsed by the LEGO Group.

## Tính năng

- **Kiểu tranh**: *Ảnh gốc* (mặc định), *Pixel art* (bảng màu 8–64 màu lấy từ chính bức ảnh bằng k-means, ô vuông sắc nét)
  hoặc *Gạch* (bảng màu gạch cố định, nút gạch nổi). Mọi xử lý chạy trên trình duyệt (Web Worker).
- **Số mảnh** 9 / 16 / **36** (mặc định) / 64 / 100 / 144, lưới tự điều chỉnh theo khung ảnh.
- **Hai kiểu mảnh** (mặc định jigsaw, có viền nổi và bóng đổ): vuông (kéo vào ô, thả lên ô khác để đổi chỗ) và jigsaw (ngàm sinh theo seed, kéo tự do, hút vào bàn,
  dính với mảnh bên cạnh thành nhóm, phóng to / thu nhỏ / kéo bàn bằng 2 ngón).
- **3 chế độ**: Dễ, Khó (xoay mảnh, phạt khi xem ảnh gốc), Siêu khó (không lưới, không báo đúng sai, 1 lần xem 3 giây).
- **Ảnh gốc song song** (dải phía trên khi cầm dọc, chia đôi màn hình khi xoay ngang), nhấn giữ để xem, hoặc ẩn.
- **Quiz** sau khi ghép: 100 câu song ngữ cho 20 tranh; quiz trí nhớ tự sinh cho ảnh riêng; người tạo thử thách có thể tự đặt câu hỏi.
- **Thành tích**: lịch sử, kỷ lục cá nhân, 10 huy hiệu (lưu trên máy; chép lên tài khoản khi đăng nhập).
- **Ai nhanh hơn**: bảng xếp hạng theo tranh/số mảnh/kiểu mảnh/chế độ; link thách đấu 7 ngày cùng một bộ xáo trộn.
  Server phát lại nhật ký nước đi và đối chiếu đồng hồ để chống gian lận.
- **Tài khoản** (Google, Facebook, email): lưu ảnh riêng tư lên cloud, tên hiển thị, xoá tài khoản.
- **Chia sẻ**: ảnh thành tích 1080×1350 / 1080×1920 qua bảng chia sẻ của điện thoại; trang chia sẻ công khai có ảnh xem trước (Open Graph).
- **PWA**: cài lên màn hình chính, tranh thư viện chơi được khi offline. Giao diện **English / Tiếng Việt**.
- Không cấu hình backend vẫn chơi đầy đủ ở **chế độ khách**.

## Công nghệ

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · next-intl · Dexie (IndexedDB) · Supabase (Auth, Postgres + RLS, Storage) · Vitest · Docker.

## Cấu trúc

```
src/
  app/                  trang (/, /library, /upload, /setup, /play, /me, /leaderboard, /login, /c/[code], /s/[id], …) và API (/api/*)
  components/           giao diện; components/game/ = bàn ghép, khay mảnh, quiz, kết quả, thẻ chia sẻ
  content/              20 tranh + câu hỏi (artworks.ts), huy hiệu
  lib/mosaic/           tạo tranh gạch (engine, bảng màu, render, worker)
  lib/puzzle/           luật chơi thuần TS dùng chung client/server: xáo trộn theo seed, mảnh vuông, jigsaw, chấm điểm, phát lại nhật ký
  lib/server/           truy cập dữ liệu & kiểm tra đầu vào phía server
messages/               chuỗi giao diện en.json / vi.json (sinh từ scripts/messages.py)
supabase/               config.toml (chạy local) và migrations SQL
scripts/                fetch-library.mjs (tải tranh thư viện), messages.py, check-messages.mjs
deploy/                 Caddyfile, nginx.conf mẫu
docs/PLAN.md            kế hoạch sản phẩm
```

## Bắt đầu nhanh

```bash
npm ci
npm run library:fetch     # tải 20 tranh từ Wikimedia Commons vào public/library
npm run dev               # http://localhost:3000 (chế độ khách)
```

Kết nối backend và deploy bằng Docker: xem **[DEPLOY.md](DEPLOY.md)**.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | chạy dev / build / chạy bản build |
| `npm test` | unit test (tranh gạch, luật chơi, phát lại nhật ký) |
| `npm run lint` | kiểm tra TypeScript |
| `npm run library:fetch` | tải/tạo ảnh tranh thư viện (`--force` để làm lại) |
| `npm run i18n:build` | sinh `messages/*.json` từ `scripts/messages.py` |
| `npm run i18n:check` | kiểm tra mọi khoá dịch có đủ EN/VI |

## Thêm tranh vào thư viện

1. Thêm một mục vào `ARTWORKS` trong `src/content/artworks.ts` (id, tiêu đề EN/VI, hoạ sĩ, năm, bảo tàng, tỉ lệ khung,
   tên file Wikimedia Commons, câu hỏi quiz — đáp án đúng luôn đặt ở vị trí đầu, app tự xáo).
2. `npm run library:fetch` rồi build lại.

## Bản quyền nội dung

Các bức tranh thuộc phạm vi công cộng; ảnh chụp lấy từ Wikimedia Commons (xem trang `/credits`). Dự án phi thương mại.
