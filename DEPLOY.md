# Hướng dẫn tự host Legart

Tài liệu này hướng dẫn tự host **frontend** (ứng dụng Next.js trong Docker) và kết nối với **backend**
(Supabase: đăng nhập, cơ sở dữ liệu Postgres, lưu trữ ảnh). Backend có thể là Supabase Cloud hoặc
Supabase do bạn tự host.

> Tóm tắt nhanh
> ```bash
> git clone <repo> legart && cd legart
> cp .env.example .env              # điền SITE_URL + 3 khoá Supabase
> # chạy supabase/migrations/*.sql trên database Supabase (mục 3)
> docker compose --profile https up -d --build   # có HTTPS tự động qua Caddy
> curl https://<domain>/api/health  # {"ok":true,"backend":true}
> ```

---

## Mục lục

1. [Kiến trúc](#1-kiến-trúc)
2. [Yêu cầu](#2-yêu-cầu)
3. [Backend — phương án A: Supabase Cloud](#3-backend--phương-án-a-supabase-cloud)
4. [Backend — phương án B: tự host Supabase](#4-backend--phương-án-b-tự-host-supabase)
5. [Cấu hình đăng nhập Google, Facebook, email](#5-cấu-hình-đăng-nhập-google-facebook-email)
6. [Frontend — build và chạy bằng Docker](#6-frontend--build-và-chạy-bằng-docker)
7. [Ảnh tranh thư viện](#7-ảnh-tranh-thư-viện)
8. [Kiểm tra sau khi deploy](#8-kiểm-tra-sau-khi-deploy)
9. [Vận hành: cập nhật, sao lưu, dọn dẹp, log](#9-vận-hành-cập-nhật-sao-lưu-dọn-dẹp-log)
10. [Biến môi trường](#10-biến-môi-trường)
11. [Bảo mật](#11-bảo-mật)
12. [Khắc phục sự cố](#12-khắc-phục-sự-cố)
13. [Chạy trên máy để phát triển](#13-chạy-trên-máy-để-phát-triển)

---

## 1. Kiến trúc

```
                ┌──────────────────────────────┐
 Trình duyệt ──►│ Caddy / nginx (HTTPS)         │
 (mobile/PC)    └──────────────┬───────────────┘
      │                        ▼
      │         ┌──────────────────────────────┐   service_role key  ┌───────────────────────────┐
      │         │ legart-web (Docker, Next.js)  │────────────────────►│ Supabase                  │
      │         │ • trang web, API /api/*       │                     │ • Auth (Google/FB/email)  │
      │         │ • xác minh nhật ký nước đi    │                     │ • Postgres (+ RLS)        │
      │         │ • bảng xếp hạng, thử thách    │                     │ • Storage (ảnh)           │
      │         └──────────────────────────────┘                     └───────────────────────────┘
      │                         anon key (đăng nhập, ảnh riêng tư)          ▲
      └─────────────────────────────────────────────────────────────────────┘
```

- **Tạo tranh gạch, cắt mảnh, chơi** chạy hoàn toàn trên trình duyệt.
- **Trình duyệt ↔ Supabase** (anon key): đăng nhập, lưu/đọc ảnh riêng tư, sửa tên hiển thị. Được bảo vệ bằng Row Level Security.
- **Server Next.js ↔ Supabase** (service role key): bắt đầu/kết thúc ván xếp hạng (phát lại nhật ký nước đi để chống gian lận),
  bảng xếp hạng, link thách đấu, trang chia sẻ, xoá tài khoản.
- **Chế độ khách**: nếu không điền biến Supabase, app vẫn chạy đầy đủ phần chơi; thành tích lưu trong trình duyệt,
  các mục Đăng nhập / Xếp hạng / Thách đấu tự ẩn.
- Cấu hình backend được đọc **lúc chạy** (runtime), nên cùng một image Docker có thể trỏ sang backend khác chỉ bằng cách đổi `.env` và khởi động lại.

## 2. Yêu cầu

| Thành phần | Tối thiểu |
|---|---|
| Server frontend | Linux x86_64 hoặc arm64, 1 vCPU, 1 GB RAM (build cần ~2 GB, có thể build ở máy khác) |
| Phần mềm | Docker 24+ và Docker Compose v2 (`docker compose version`) |
| Tên miền | Một bản ghi DNS A/AAAA trỏ về server (vd `legart.example.com`); mở cổng 80 và 443 |
| Backend | Một project Supabase Cloud (gói Free là đủ) **hoặc** server tự host Supabase (≥ 2 vCPU, 4 GB RAM) |
| Mạng lúc build | Truy cập `registry.npmjs.org` và `commons.wikimedia.org` (để tải tranh thư viện) |

Facebook Login và nút chia sẻ của điện thoại (Web Share API) **bắt buộc HTTPS**.

## 3. Backend — phương án A: Supabase Cloud

### 3.1 Tạo project
1. Đăng nhập <https://supabase.com/dashboard> → **New project**. Chọn region gần người dùng (vd *Southeast Asia (Singapore)*).
2. Lưu lại mật khẩu database.

### 3.2 Tạo bảng, chính sách bảo mật, bucket lưu trữ
Chọn **một** trong hai cách:

- **SQL Editor**: mở **SQL Editor → New query**, lần lượt dán và **Run** từng file trong `supabase/migrations/`
  theo thứ tự tên (`20261003000000_init.sql`, rồi `20261005000000_art_style.sql`, …).
- **Supabase CLI** (trên máy có source):
  ```bash
  npx supabase login
  npx supabase link --project-ref <project-ref>     # project-ref nằm trong URL dashboard
  npx supabase db push                              # chạy các file trong supabase/migrations
  ```

Kiểm tra: **Table Editor** có các bảng `profiles`, `user_images`, `attempts`, `challenges`, `shares`;
**Storage** có 2 bucket `user-images` (private) và `public-images` (public).

### 3.3 Lấy khoá
**Project Settings → API** (hoặc **API Keys**):

| Trên dashboard | Biến trong `.env` |
|---|---|
| Project URL (`https://<ref>.supabase.co`) | `SUPABASE_URL` |
| `anon` / publishable key | `SUPABASE_ANON_KEY` |
| `service_role` / secret key | `SUPABASE_SERVICE_ROLE_KEY` |

### 3.4 Cấu hình URL đăng nhập
**Authentication → URL Configuration**:
- **Site URL**: `https://legart.example.com`
- **Redirect URLs**: thêm `https://legart.example.com/**`

Sau đó cấu hình nhà cung cấp đăng nhập ở [mục 5](#5-cấu-hình-đăng-nhập-google-facebook-email).

### 3.5 Lịch dọn dẹp (khuyến nghị)
Các ván đã bắt đầu nhưng không hoàn thành được xoá sau 1 ngày. Bật extension **pg_cron**
(**Database → Extensions**), rồi chạy trong SQL Editor:
```sql
select cron.schedule('legart-cleanup', '17 3 * * *', 'select public.cleanup_stale_attempts()');
```

## 4. Backend — phương án B: tự host Supabase

Supabase cung cấp bộ Docker Compose chính thức. Tóm tắt các bước (chi tiết: <https://supabase.com/docs/guides/self-hosting/docker>):

```bash
git clone --depth 1 https://github.com/supabase/supabase
mkdir supabase-stack && cp -r supabase/docker/* supabase-stack/ && cp supabase/docker/.env.example supabase-stack/.env
cd supabase-stack
```

Sửa `supabase-stack/.env` — **bắt buộc đổi** mọi giá trị mặc định:

| Biến | Giá trị |
|---|---|
| `POSTGRES_PASSWORD` | mật khẩu mạnh |
| `JWT_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự |
| `ANON_KEY`, `SERVICE_ROLE_KEY` | JWT ký bằng `JWT_SECRET` (làm theo mục *Generate API keys* trong tài liệu self-hosting) |
| `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` | tài khoản vào Studio |
| `SITE_URL` | `https://legart.example.com` |
| `ADDITIONAL_REDIRECT_URLS` | `https://legart.example.com/**` |
| `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` | URL công khai của Supabase, vd `https://supabase.example.com` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME` | máy chủ gửi mail (cho link đăng nhập email) |
| `ENABLE_EMAIL_SIGNUP` | `true` |

Khởi động và chạy migration của Legart:
```bash
docker compose pull && docker compose up -d
# chạy migration (Postgres trong stack Supabase)
for f in /path/to/legart/supabase/migrations/*.sql; do
  docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done
```

Đặt Supabase sau HTTPS (cổng Kong mặc định là `8000`), ví dụ với Caddy:
```
supabase.example.com {
	reverse_proxy localhost:8000
}
```

Trong `.env` của Legart:
```
SUPABASE_URL=https://supabase.example.com
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

> Nếu Legart và Supabase chạy chung một server, vẫn dùng URL công khai (HTTPS) cho `SUPABASE_URL`, vì trình duyệt
> cũng truy cập URL này.

Đăng nhập Google/Facebook trên bản tự host được bật bằng biến môi trường của service `auth` (xem [mục 5.4](#54-supabase-tự-host-bật-provider-bằng-biến-môi-trường)).

## 5. Cấu hình đăng nhập Google, Facebook, email

URL callback mà Google/Facebook cần là **URL callback của Supabase**, không phải của Legart:

- Supabase Cloud: `https://<project-ref>.supabase.co/auth/v1/callback`
- Tự host: `https://supabase.example.com/auth/v1/callback`

### 5.1 Google
1. <https://console.cloud.google.com/> → chọn/tạo project → **APIs & Services → OAuth consent screen**: điền tên app, email hỗ trợ, domain `legart.example.com`, scope `email`, `profile`, `openid`.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*:
   - **Authorized JavaScript origins**: `https://legart.example.com`
   - **Authorized redirect URIs**: URL callback Supabase ở trên.
3. Copy **Client ID** và **Client secret** → Supabase **Authentication → Providers → Google** → bật, dán vào, **Save**.

### 5.2 Facebook
1. <https://developers.facebook.com/apps> → **Create app** → loại *Consumer* (hoặc use case *Authenticate and request data from users with Facebook Login*).
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**: URL callback Supabase.
3. **App settings → Basic**: điền Privacy Policy URL `https://legart.example.com/privacy`, App domain; copy **App ID**, **App secret**.
4. Supabase **Authentication → Providers → Facebook** → bật, dán App ID/secret.
5. Chuyển app sang **Live** để người ngoài đăng nhập được.

### 5.3 Email (link đăng nhập)
Bật sẵn trong Supabase (**Providers → Email**). Máy chủ mail mặc định của Supabase Cloud chỉ cho gửi rất ít email mỗi giờ —
khi chạy thật hãy cấu hình SMTP riêng ở **Authentication → Emails → SMTP Settings** (Resend, Amazon SES, Brevo, Gmail Workspace…).
Có thể sửa nội dung email ở **Email Templates** (nên thêm bản tiếng Việt).

### 5.4 Supabase tự host: bật provider bằng biến môi trường
Thêm vào `environment` của service `auth` trong `supabase-stack/docker-compose.yml` (và giá trị tương ứng trong `.env`):
```yaml
GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
GOTRUE_EXTERNAL_FACEBOOK_ENABLED: "true"
GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID: ${FACEBOOK_CLIENT_ID}
GOTRUE_EXTERNAL_FACEBOOK_SECRET: ${FACEBOOK_SECRET}
GOTRUE_EXTERNAL_FACEBOOK_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
```
Rồi `docker compose up -d auth`.

Không muốn dùng Google hoặc Facebook? Cứ để provider đó tắt; nút tương ứng sẽ báo lỗi khi bấm. Có thể xoá nút trong
`src/app/login/page.tsx`.

## 6. Frontend — build và chạy bằng Docker

### 6.1 Chuẩn bị
```bash
git clone <url-repo-legart> legart
cd legart
cp .env.example .env
nano .env        # SITE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DOMAIN
```

### 6.2 Cách 1 — Có HTTPS tự động (Caddy đi kèm)
Dùng khi server chưa có web server nào chiếm cổng 80/443.
```bash
docker compose --profile https up -d --build
```
Caddy tự xin chứng chỉ Let's Encrypt cho `DOMAIN`. Mở `https://DOMAIN`.

### 6.3 Cách 2 — Đã có nginx/Traefik sẵn
```bash
docker compose up -d --build          # app lắng nghe trên cổng WEB_PORT (mặc định 3000)
```
Cấu hình reverse proxy tới `http://127.0.0.1:3000`. Mẫu nginx: `deploy/nginx.conf`. Lưu ý:
- `client_max_body_size 8m;` (ảnh thành tích và ảnh thử thách được gửi lên qua API).
- Chuyển tiếp header `X-Forwarded-For` (dùng cho giới hạn tần suất gọi API).
- Không public cổng 3000 ra Internet: đặt `WEB_PORT=127.0.0.1:3000` trong `.env` nếu cần.

### 6.4 Cách 3 — Chỉ dùng Docker (không Compose)
```bash
docker build -t legart-web .
docker run -d --name legart --restart unless-stopped -p 3000:3000 --env-file .env legart-web
```

### 6.5 Build ở máy khác / CI rồi đẩy lên registry
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t registry.example.com/legart-web:1.0 --push .
# trên server: sửa docker-compose.yml → image: registry.example.com/legart-web:1.0 (bỏ phần build:)
docker compose pull && docker compose up -d
```

### 6.6 Tham số build
| Build arg / secret | Ý nghĩa |
|---|---|
| `FETCH_LIBRARY=1` (mặc định) | Tải 20 tranh thư viện từ Wikimedia Commons trong lúc build |
| `FETCH_LIBRARY=0` | Bỏ qua tải (dùng ảnh có sẵn trong `public/library` hoặc `library-src/`) |
| `--secret id=extra_ca,src=ca.pem` | Thêm chứng chỉ CA khi build sau proxy công ty có kiểm tra TLS |

Ví dụ: `docker compose build --build-arg FETCH_LIBRARY=0`.

## 7. Ảnh tranh thư viện

Ảnh 20 tranh **không nằm trong git**. Chúng được tải lúc build bằng `scripts/fetch-library.mjs`:
- Tải từ Wikimedia Commons theo tên file khai báo trong `src/content/artworks.ts`; nếu tên file đổi, script tự tìm kiếm trên Commons.
- Tạo `public/library/<id>.jpg` (≤ 1600 px) và `<id>.thumb.jpg` (480 px), ghi nguồn vào `public/library/sources.json`.
- Tranh nào không tải được sẽ hiện ô gạch đỏ thay ảnh, và báo lỗi khi bấm chơi.

Cách khác nếu server build không ra được Internet:
1. Trên máy có mạng: `npm ci && npm run library:fetch` → copy thư mục `public/library` sang server trước khi build; **hoặc**
2. Tự đặt ảnh vào `library-src/<id>.jpg` (tên theo `id` trong `artworks.ts`), script sẽ dùng ảnh đó thay vì tải.
3. Hoặc gắn volume: bỏ comment phần `volumes` trong `docker-compose.yml` và đặt ảnh đã xử lý vào `./data/library`.

Kiểm tra: `curl -I https://DOMAIN/library/mona-lisa.jpg` trả về `200`.

## 8. Kiểm tra sau khi deploy

```bash
curl https://DOMAIN/api/health
# {"ok":true,"backend":true}   ← backend=false nghĩa là thiếu 1 trong 3 biến Supabase
docker compose ps                # web: healthy
docker compose logs -f web
```

Danh sách kiểm tra trên điện thoại:
- [ ] Trang chủ, Thư viện hiển thị ảnh; đổi ngôn ngữ EN ↔ VI.
- [ ] Chơi 1 ván 36 mảnh vuông (Dễ) và 1 ván jigsaw → quiz → màn kết quả → **Chia sẻ ảnh** mở bảng chia sẻ của điện thoại.
- [ ] Đăng nhập Google / Facebook / email → quay về trang `Tôi`.
- [ ] Ván khi đã đăng nhập hiện "Hạng #…"; trang **Xếp hạng** có tên.
- [ ] **Tạo link thách đấu** → mở link trong cửa sổ ẩn danh, chơi với biệt danh khách → thời gian hiện trên bảng thử thách.
- [ ] **Tạo link công khai** → dán link vào Facebook/Zalo thấy ảnh xem trước.
- [ ] Tải ảnh riêng, tích "Lưu vào tài khoản" → ảnh xuất hiện ở trang `Tôi` trên thiết bị khác.

## 9. Vận hành: cập nhật, sao lưu, dọn dẹp, log

**Cập nhật phiên bản**
```bash
git pull
docker compose up -d --build        # build image mới rồi thay container, ~1 phút gián đoạn
# nếu có file mới trong supabase/migrations: chạy file đó (SQL Editor / supabase db push / psql)
docker image prune -f
```

**Sao lưu**
- Supabase Cloud: gói Free không có backup tự động dài hạn — định kỳ chạy
  `npx supabase db dump --linked -f backup.sql` hoặc `pg_dump` với connection string ở **Project Settings → Database**.
  Ảnh trong Storage có thể tải bằng `npx supabase storage cp -r ss:///user-images ./backup/user-images --experimental` (cần `supabase link`).
- Tự host: sao lưu volume Postgres (`docker compose exec db pg_dump -U postgres postgres > backup.sql`) và thư mục `volumes/storage`.
- Frontend không lưu trạng thái — chỉ cần giữ `.env`.

**Dọn dẹp**: xem [mục 3.5](#35-lịch-dọn-dẹp-khuyến-nghị) (pg_cron). Bản tự host: thêm cron trên server:
`17 3 * * * docker compose -f /path/supabase-stack/docker-compose.yml exec -T db psql -U postgres -c "select public.cleanup_stale_attempts()"`.

**Log**: `docker compose logs -f web` (Next.js), `docker compose logs -f caddy`.

**Chạy nhiều container**: giới hạn tần suất API đang nằm trong bộ nhớ từng container. Khi chạy nhiều bản sao, đặt
giới hạn tần suất ở reverse proxy (nginx `limit_req`, Cloudflare…).

## 10. Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `SITE_URL` | nên có | URL công khai, vd `https://legart.example.com`. Dùng để tạo link tuyệt đối cho thẻ Open Graph |
| `SUPABASE_URL` | cho backend | URL Supabase (Cloud hoặc tự host) |
| `SUPABASE_ANON_KEY` | cho backend | Khoá anon/publishable — được gửi xuống trình duyệt |
| `SUPABASE_SERVICE_ROLE_KEY` | cho backend | Khoá service role — **chỉ server dùng**, không bao giờ để lộ |
| `PORT` | không | Cổng trong container (mặc định 3000) |
| `WEB_PORT` | không | Cổng trên máy host khi chạy `docker compose` (mặc định 3000) |
| `DOMAIN` | cho profile `https` | Tên miền Caddy xin chứng chỉ |

Thiếu cả 3 biến Supabase → chế độ khách. Có URL + anon nhưng thiếu service role → đăng nhập và ảnh cloud hoạt động,
nhưng xếp hạng, thử thách, chia sẻ công khai bị tắt.

## 11. Bảo mật

- `SUPABASE_SERVICE_ROLE_KEY` bỏ qua mọi chính sách RLS: chỉ đặt trong `.env` trên server, không commit, không đưa vào image
  (Dockerfile không chép `.env`; biến được nạp lúc chạy).
- RLS đã bật cho mọi bảng: trình duyệt chỉ đọc/sửa hồ sơ và ảnh của chính mình; các bảng `attempts`, `challenges`, `shares`
  chỉ được ghi bởi server.
- Ảnh riêng nằm trong bucket private `user-images/<user-id>/…`; ảnh thử thách và thẻ chia sẻ nằm ở bucket public `public-images`.
- Ảnh tải lên được mã hoá lại trên trình duyệt (xoá EXIF/GPS) trước khi lưu.
- Thời gian xếp hạng được server xác minh: seed do server cấp, nhật ký nước đi được phát lại, thời gian đối chiếu với đồng hồ server.
- Nên bật **Leaked password protection**, **CAPTCHA** (Authentication → Attack Protection) nếu bị spam đăng ký.

## 12. Khắc phục sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `/api/health` trả `"backend":false` | Thiếu một trong `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Sửa `.env` rồi `docker compose up -d` |
| Đăng nhập xong bị đưa về `localhost` | Sai **Site URL / Redirect URLs** ở Supabase (mục 3.4) hoặc `SITE_URL`/`ADDITIONAL_REDIRECT_URLS` (tự host) |
| Google báo `redirect_uri_mismatch` | Authorized redirect URI phải là `https://<supabase>/auth/v1/callback` |
| Facebook báo app chưa sẵn sàng | Chuyển app sang chế độ **Live**, điền Privacy Policy URL |
| Không nhận email đăng nhập | Giới hạn mail mặc định của Supabase; cấu hình SMTP riêng (mục 5.3) |
| Tranh thư viện hiện ô gạch đỏ / "chưa tải" | Build không tải được ảnh — xem mục 7 |
| Lỗi `relation "attempts" does not exist` trong log | Chưa chạy migration SQL (mục 3.2) |
| Lỗi tải ảnh lên `new row violates row-level security policy` | Migration chưa tạo policy storage; chạy lại file migration |
| Tạo link chia sẻ báo lỗi 413 | Tăng `client_max_body_size` (nginx) lên ≥ 8 MB |
| Thành tích báo "không xác minh được" | Đồng hồ ván lệch nhiều so với server (máy quá chậm khi tạo mảnh, hoặc ván bị can thiệp). Không ảnh hưởng lịch sử cá nhân |
| Nút "Chia sẻ ảnh" chỉ tải ảnh về | Trình duyệt không hỗ trợ chia sẻ file (thường là desktop) hoặc trang không chạy HTTPS |
| Build Docker lỗi `npm ci` do chứng chỉ | Build sau proxy công ty: thêm `--secret id=extra_ca,src=ca.pem` |

## 13. Chạy trên máy để phát triển

Yêu cầu Node.js 22+ và Docker (cho Supabase local).

```bash
npm ci
npm run library:fetch                  # tải tranh thư viện (một lần)
npx supabase start                     # Supabase local, tự chạy supabase/migrations
npx supabase status -o env             # lấy API_URL, ANON_KEY, SERVICE_ROLE_KEY
cat > .env.local <<EOF
SITE_URL=http://localhost:3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
EOF
npm run dev                            # http://localhost:3000
```

Email đăng nhập ở môi trường local được bắt bởi Mailpit: <http://127.0.0.1:54324>.

Nếu mạng chặn registry `public.ecr.aws` / `ghcr.io` khi `supabase start`, dùng image trên Docker Hub:
`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.

Lệnh hữu ích:
```bash
npm test                 # unit test (engine tranh gạch, luật chơi, phát lại nhật ký)
npm run lint             # kiểm tra TypeScript
npm run i18n:check       # kiểm tra mọi khoá dịch có đủ EN/VI
npm run build && npm start
```
