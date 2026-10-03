# Legart — Kế hoạch sản phẩm & kỹ thuật

> Ứng dụng web (responsive, ưu tiên mobile) biến ảnh thành tranh ghép gạch kiểu "LEGO Art"
> (mosaic từ các nút tròn), cắt thành N mảnh (mặc định 36) để người chơi ghép lại, có bấm giờ,
> ghi lại thành tích để so ai ghép nhanh hơn, câu đố sau khi ghép xong, 3 độ khó, thư viện 20 tranh
> Phục Hưng, đăng nhập để tải ảnh riêng và chia sẻ thành tích lên mạng xã hội.

Trạng thái: **bản kế hoạch v2** — chưa có code. Các quyết định đã chốt ở §0; câu hỏi còn mở ở §13.

---

## 0. Quyết định đã chốt

| # | Quyết định | Ảnh hưởng tới kế hoạch |
|---|---|---|
| 1 | Ứng dụng **web**, code trong repo **`legart`** | Repo riêng, cấu trúc ở §10.2 |
| 2 | **Phi thương mại** (không quảng cáo, không thu phí) | Giữ nguyên cả 20 tranh, ghi nguồn đầy đủ (§7) |
| 3 | **Song ngữ Anh + Việt** ngay từ MVP | i18n cho giao diện, metadata tranh, ảnh chia sẻ và toàn bộ câu hỏi (§8, §10) |
| 4 | **Hai kiểu mảnh**: mảnh vuông **và** mảnh jigsaw có ngàm | Người chơi chọn khi thiết lập ván; hai cơ chế ghép khác nhau (§5.1, §5.2) |
| 5 | **Không có phòng đua trực tiếp** — chỉ ghi lại thành tích | "Ai nhanh hơn" = so thành tích đã ghi: kỷ lục cá nhân, bảng xếp hạng, link thách đấu (§6) |

---

## 1. Diễn giải yêu cầu

| Yêu cầu gốc | Diễn giải trong kế hoạch |
|---|---|
| "Chuyển ảnh thành tranh dạng lego art" | Thu nhỏ ảnh về lưới **nút gạch** (vd 48×48 nút như bộ LEGO Art), ánh xạ mỗi nút về **bảng màu gạch giới hạn** (~24–40 màu), vẽ mỗi nút thành viên gạch tròn có bóng đổ. |
| "Tách thành số mảnh theo yêu cầu, default 36" | Tranh mosaic được cắt thành lưới r×c mảnh (36 = 6×6), dạng **vuông** hoặc **jigsaw có ngàm**. |
| "Thử thách bấm giờ xem ai ghép nhanh hơn" | Mỗi ván được ghi lại (thời gian, số bước, chế độ…). So tài qua kỷ lục cá nhân, bảng xếp hạng và **link thách đấu** (mọi người ghép cùng một bộ xáo trộn rồi so thời gian đã ghi). |
| "Quiz sau khi ghép xong" | Ghép xong → 3 câu hỏi trắc nghiệm về bức tranh; trả lời đúng được cộng điểm thưởng. |
| "Mode dễ / khó / siêu khó" | Khác nhau ở: xoay mảnh, ảnh mờ gợi ý, nam châm hút đúng chỗ, quyền xem ảnh gốc, phản hồi đúng/sai (§5.3). |
| "Option hiện ảnh gốc song song" | Tuỳ chọn hiển thị ảnh gốc cạnh bàn ghép: điện thoại dọc → dải thu gọn phía trên; ngang/tablet → chia đôi màn hình. |
| "Thư viện cố định 20 ảnh Phục Hưng" | Danh sách tuyển chọn tác phẩm thuộc phạm vi công cộng, kèm metadata + bộ câu hỏi song ngữ (§7). |
| "Đăng nhập, tải ảnh riêng, chia sẻ" | Đăng nhập Google/Facebook/email; ảnh riêng tư mặc định; chia sẻ ảnh thành tích qua Web Share API + trang chia sẻ công khai có ảnh xem trước (§9). |

⚠️ **Nhãn hiệu**: "LEGO" là nhãn hiệu đã đăng ký — kể cả khi phi thương mại, không dùng chữ hay logo
"LEGO" trong giao diện, logo, tên miền. Dùng *brick mosaic*, *tranh gạch*; bảng màu chỉ "lấy cảm hứng".
Chân trang ghi: *"Not affiliated with or endorsed by the LEGO Group."*

---

## 2. Phạm vi theo giai đoạn

### MVP (Giai đoạn 1) — chơi không cần đăng nhập
- Giao diện **Anh/Việt** (tự nhận ngôn ngữ trình duyệt, đổi được bất kỳ lúc nào).
- Thư viện 20 tranh Phục Hưng (đã tiền xử lý sẵn).
- Tải ảnh từ máy (xử lý hoàn toàn trên trình duyệt, không upload) — chơi ở chế độ khách.
- Bộ tạo mosaic: chọn độ chi tiết, bật/tắt dithering, xem trước.
- Chọn số mảnh: 9 / 16 / **36** / 64 / 100 / 144 (mobile gợi ý tối đa 100 với mảnh vuông, 64 với jigsaw).
- **Hai kiểu mảnh**: vuông và jigsaw.
- 3 chế độ Dễ / Khó / Siêu khó + tuỳ chọn hiện ảnh gốc.
- Đồng hồ bấm giờ, đếm số bước, số lần xem ảnh gốc, số gợi ý.
- Quiz sau khi ghép (tranh thư viện) + quiz trí nhớ tự sinh (ảnh riêng).
- **Ghi thành tích cục bộ**: lịch sử ván, kỷ lục cá nhân theo cấu hình (IndexedDB).
- Màn hình kết quả + tạo ảnh thành tích + chia sẻ (Web Share API / tải về).
- PWA cơ bản: cài lên màn hình chính, chơi offline tranh thư viện.

### Giai đoạn 2 — tài khoản & so tài
- Đăng nhập (Google, Facebook, email magic link); gộp thành tích chơi khách vào tài khoản.
- Lưu ảnh riêng lên cloud, "Bộ sưu tập của tôi".
- Thành tích lưu trên cloud; trang hồ sơ: tổng số tranh đã ghép, tổng thời gian, kỷ lục, huy hiệu.
- Bảng xếp hạng theo (tranh × số mảnh × kiểu mảnh × chế độ), toàn bộ / tuần.
- **Link thách đấu**: cố định cấu hình + seed, gửi bạn bè, xem bảng thời gian của thử thách.
- Câu hỏi tự viết cho ảnh riêng (người tạo thử thách tự đặt câu đố, nhập 1 hoặc 2 ngôn ngữ).
- Trang chia sẻ công khai `/s/{id}` với ảnh OG.

### Giai đoạn 3 — mở rộng (tuỳ chọn)
- Quiz tự sinh cho ảnh riêng bằng AI thị giác (người dùng phải đồng ý gửi ảnh).
- "Tranh của ngày", chuỗi ngày chơi, thêm huy hiệu.
- Kiểu ngàm "gạch" (ngàm vuông bám theo lưới nút) cho jigsaw.
- Xuất "danh sách gạch" để lắp tranh thật.

---

## 3. Luồng người dùng

```
Trang chủ (EN | VI)
 ├─ Thư viện Phục Hưng ─┐
 ├─ Tải ảnh của tôi ────┤→ (ảnh riêng) Cắt khung 1:1 / 4:5 / 3:4
 └─ Nhập mã thách đấu ──┤
                        ▼
              Thiết lập ván chơi
              • Số mảnh (mặc định 36)       • Kiểu mảnh: Vuông / Jigsaw
              • Chế độ Dễ / Khó / Siêu khó  • Hiện ảnh gốc: Luôn hiện / Nhấn giữ / Tắt
              • Độ chi tiết mosaic          • Xem trước tranh gạch
                        ▼
              Đếm ngược 3-2-1 → Bàn ghép (đồng hồ chạy)
                        ▼
              Hoàn thành → hiệu ứng "lắp gạch" → Quiz (3 câu, mỗi câu 15 giây)
                        ▼
              Kết quả (đã ghi vào thành tích): thời gian, số bước, điểm quiz, tổng điểm,
              kỷ lục mới?, hạng
              [Chia sẻ]  [Thách đấu bạn bè]  [Chơi lại]  [Tranh khác]
```

---

## 4. Bộ tạo tranh gạch (mosaic engine)

Chạy trong **Web Worker** + `OffscreenCanvas` để không đơ giao diện; thuần TypeScript, có unit test.

1. **Đọc & chuẩn hoá ảnh**: `createImageBitmap` (tự xử lý xoay EXIF), giới hạn cạnh dài 2048 px.
2. **Cắt khung** theo tỉ lệ (mặc định 1:1 như LEGO Art; cho phép 4:5, 3:4, 16:9).
3. **Thu nhỏ về lưới nút** W×H (độ chi tiết: 32 / **48** / 64 / 96 nút cạnh dài) bằng lấy trung bình
   vùng trong **không gian RGB tuyến tính** (tránh tối màu do gamma).
4. **Tinh chỉnh tuỳ chọn**: độ tương phản, độ bão hoà, độ sáng (thanh trượt, xem trước ngay).
5. **Lượng tử hoá màu**: chuyển sang CIELAB, chọn màu gần nhất trong bảng màu theo ΔE (CIE76 cho
   nhanh; CIEDE2000 nếu cần chính xác hơn).
6. **Dithering tuỳ chọn** (Floyd–Steinberg trong Lab) — đẹp hơn với chân dung, chuyển màu mượt.
7. **Kết quả lưu dạng mảng chỉ số màu** (`Uint8Array` W×H + id bảng màu). Tranh 48×48 chỉ ~2,3 KB
   → lưu/chia sẻ/đồng bộ cực nhẹ, vẽ lại ở mọi độ phân giải.
8. **Vẽ**: mỗi nút = ô vuông màu nền + hình tròn nổi (gradient sáng trên-trái, bóng dưới-phải).
   Vẽ sẵn 1 "sprite nút" cho mỗi màu rồi `drawImage` hàng loạt → nhanh.
9. **Thống kê gạch**: đếm số nút mỗi màu → "danh sách gạch".

**Bảng màu**: 1 bảng mặc định ~30 màu + vài bảng chủ đề (Đơn sắc, Sepia, Pop art). JSON
`{ id, name: { en, vi }, hex }`.

**Quan hệ nút ↔ mảnh**: lưới mảnh r×c chia hết lưới nút. Tranh vuông: 36 mảnh (6×6) × 8×8 nút = 48×48 nút.
Khi đổi số mảnh, độ chi tiết làm tròn về bội số gần nhất (64 mảnh = 8×8 → 48 nút, mỗi mảnh 6×6 nút;
100 mảnh = 10×10 → 50 nút). Với ảnh không vuông: `c = round(sqrt(N × tỉ_lệ))`, `r = round(N / c)`;
hiển thị số mảnh thực tế.

**Tranh thư viện được tiền xử lý lúc build** (script Node + `sharp`): sinh mảng chỉ số màu, ảnh gốc
WebP nhiều kích cỡ, thumbnail.

---

## 5. Gameplay

### 5.1 Mảnh vuông — cơ chế "ô lưới"
- **Bàn ghép** = lưới ô r×c (ô trống có viền mờ) + **khay mảnh** cuộn ngang ở đáy màn hình.
- Kéo mảnh từ khay vào ô; thả vào ô đã có mảnh → **đổi chỗ**; kéo từ ô ra khay → gỡ mảnh.
- Chạm 1 lần vào mảnh (chế độ có xoay) → xoay 90°.
- Thắng khi mọi ô có đúng mảnh với góc 0°.

### 5.2 Mảnh jigsaw — cơ chế "kéo tự do"
- **Sinh hình ngàm theo seed**: mỗi cạnh trong được gán ngẫu nhiên lồi/lõm, vị trí ngàm lệch 40–60%, kích
  thước dao động nhẹ → không có 2 mảnh giống nhau; cạnh viền phẳng. Mỗi cạnh vẽ bằng chuỗi đường cong
  Bézier (dạng ngàm cổ điển), ngàm nhô ~22% kích thước mảnh.
- **Vẽ mảnh**: cắt tranh gạch bằng `Path2D` (clip), thêm viền sáng/tối tạo độ nổi; mỗi mảnh vẽ sẵn thành
  `ImageBitmap` (có lề 25% cho ngàm). Bắt chạm bằng `isPointInPath` theo đúng hình mảnh.
- **Thao tác**: mảnh nằm rải trên khay/vùng chơi, kéo tự do lên bàn.
  - *Hút vào bàn*: thả gần vị trí đúng (và đúng góc) → mảnh khớp vào khung.
  - *Ghép với mảnh bên cạnh*: hai mảnh kề nhau thả gần đúng vị trí tương đối → dính thành **nhóm**, kéo nhóm
    di chuyển cùng nhau (như ghép jigsaw thật).
- Thắng khi tất cả mảnh nằm đúng vị trí (hoặc với Siêu khó: tất cả gộp thành 1 nhóm đúng góc).
- Mảnh jigsaw cần nhiều không gian hơn → mobile khuyến nghị ≤ 64 mảnh; có nút "gom mảnh" và "trải mảnh".

### 5.3 Chung cho cả hai kiểu
- Pinch-zoom & kéo bàn khi số mảnh lớn; nút "vừa màn hình".
- Rung nhẹ (`navigator.vibrate`) khi mảnh khớp; âm thanh "tách" có thể tắt.
- Xáo trộn (và hình ngàm) **xác định theo seed** (PRNG mulberry32) → cùng seed = cùng ván cho mọi người
  (nền tảng cho thử thách công bằng).
- Lưu tạm ván đang chơi vào IndexedDB → mở lại vẫn chơi tiếp (đồng hồ tạm dừng; app ẩn quá 30 giây trong
  ván xếp hạng thì ván bị đánh dấu "không xếp hạng").

Kích thước mảnh trên điện thoại 360 px: 36 mảnh ≈ 58 px/mảnh, 100 mảnh ≈ 34 px (cần zoom),
144 mảnh ≈ 28 px → chỉ khuyến nghị cho tablet/desktop.

### 5.4 Các chế độ chơi

| | **Dễ** | **Khó** | **Siêu khó** |
|---|---|---|---|
| Xoay mảnh | Không | Có (0/90/180/270°) | Có |
| Ảnh mờ gợi ý trên bàn | Có (độ mờ 25%) | Không | Không |
| Khung/lưới trên bàn | Lưới đầy đủ | Vuông: lưới · Jigsaw: chỉ khung ngoài | Không có khung |
| Hút/khoá đúng chỗ | Mảnh đúng tự khoá, viền xanh ✓ | Tự khoá, không báo hiệu | Vuông: không khoá, chỉ kiểm tra khi đầy bàn · Jigsaw: chỉ ghép mảnh-với-mảnh |
| Thứ tự khay | Mảnh viền lên trước | Ngẫu nhiên | Ngẫu nhiên |
| Ảnh gốc | Luôn hiện / Nhấn giữ / Tắt | Nhấn giữ (+5 giây phạt mỗi lần) / Tắt | Tắt (tuỳ chọn: 1 lần xem 3 giây, +15 giây) |
| Gợi ý "đặt hộ 1 mảnh" | Không giới hạn (+3 giây) | 3 lần (+10 giây) | Không |
| Hệ số điểm | ×1 | ×2 | ×3 |

Jigsaw cộng thêm hệ số ×1,2 vì khó thao tác hơn. Ván dùng "Luôn hiện ảnh gốc" xếp hạng ở bảng riêng (nhãn 👁).

### 5.5 Hiển thị ảnh gốc song song
- **Điện thoại dọc**: dải ảnh gốc thu gọn phía trên bàn ghép (chạm để phóng to/thu nhỏ); "Nhấn giữ" = nút con mắt.
- **Ngang / tablet / desktop**: chia đôi màn hình — trái ảnh tham chiếu, phải bàn ghép.
- Chọn tham chiếu là **ảnh chụp gốc** hay **bản tranh gạch** (bản gạch dễ hơn).

### 5.6 Tính điểm
```
điểm_ghép = max(0, 10 000 − thời_gian_giây × 10) × hệ_số_chế_độ × hệ_số_kiểu_mảnh × (số_mảnh / 36)
điểm_quiz = số_câu_đúng × 500 (+ thưởng tốc độ trả lời tối đa 200/câu)
tổng = điểm_ghép + điểm_quiz
```
Bảng xếp hạng sắp theo **thời gian** (thời gian đã cộng phạt); điểm tổng dùng cho huy hiệu/thống kê.
Các con số là khởi điểm, sẽ cân chỉnh sau khi chơi thử.

---

## 6. Ghi thành tích & so "ai nhanh hơn"

Không có đua trực tiếp; mọi so sánh dựa trên **thành tích đã ghi**.

### 6.1 Một bản ghi thành tích gồm
tranh, số mảnh, kiểu mảnh, chế độ, chính sách xem ảnh gốc, seed, thời gian (gốc + phạt), số bước, số lần xem
ảnh gốc, số gợi ý, điểm quiz, tổng điểm, ngày giờ, trạng thái (`ranked` / `unranked` / `flagged`).

### 6.2 Nơi hiển thị
- **Lịch sử của tôi**: danh sách ván, lọc theo tranh/chế độ; biểu đồ tiến bộ thời gian theo từng cấu hình.
- **Kỷ lục cá nhân**: tốt nhất theo (tranh × số mảnh × kiểu mảnh × chế độ); màn kết quả báo "Kỷ lục mới!".
- **Huy hiệu**: ghép đủ 20 tranh, hoàn thành Siêu khó, quiz 3/3, dưới 60 giây với 36 mảnh…
- **Bảng xếp hạng** (cần đăng nhập): theo cấu hình, toàn bộ / tuần.
- **Link thách đấu**: `https://<domain>/c/AB12CD` (+ mã 6 ký tự). Mọi người chơi đúng cấu hình + seed,
  thành tích của họ hiện trên bảng thời gian của thử thách. Hạn mặc định 7 ngày. Người chưa đăng nhập
  vẫn chơi được bằng biệt danh (ghi là "khách").

### 6.3 Chống gian lận (mức hợp lý, không tuyệt đối)
- Seed và thời điểm bắt đầu do **server cấp** khi mở ván xếp hạng; kết thúc gửi kèm **nhật ký nước đi**.
- Server phát lại nhật ký để xác nhận bàn ghép hoàn chỉnh và thời gian khớp đồng hồ server.
- Loại kết quả bất khả thi (vd < 0,4 giây/mảnh), giới hạn tần suất gửi, đánh dấu nghi vấn.
- Ván chơi offline hoặc của khách: vẫn ghi vào lịch sử cá nhân nhưng không lên bảng xếp hạng chung.

---

## 7. Thư viện 20 tranh Phục Hưng

Tiêu chí: nổi tiếng, đa dạng hoạ sĩ & vùng (Ý + Bắc Âu), màu sắc/bố cục khác nhau, thuộc phạm vi công cộng.
Nguồn ảnh: kho mở của bảo tàng (NGA Washington, Met — CC0) và Wikimedia Commons.

| # | Tác phẩm (EN / VI) | Hoạ sĩ | Năm | Nơi lưu giữ | Độ khó gợi ý |
|---|---|---|---|---|---|
| 1 | Mona Lisa | Leonardo da Vinci | ~1503–1519 | Louvre, Paris | Trung bình |
| 2 | The Last Supper / Bữa tiệc ly | Leonardo da Vinci | 1495–1498 | Santa Maria delle Grazie, Milan | Khó |
| 3 | Lady with an Ermine / Người đàn bà bế chồn | Leonardo da Vinci | ~1489–1491 | Bảo tàng Czartoryski, Kraków | Dễ |
| 4 | Ginevra de' Benci | Leonardo da Vinci | ~1474–1478 | National Gallery of Art, Washington | Dễ |
| 5 | The Birth of Venus / Sự ra đời của thần Vệ Nữ | Sandro Botticelli | ~1484–1486 | Uffizi, Florence | Trung bình |
| 6 | Primavera / Mùa xuân | Sandro Botticelli | ~1480 | Uffizi, Florence | Khó |
| 7 | The Creation of Adam / Sự sáng tạo ra Adam | Michelangelo | ~1508–1512 | Nhà nguyện Sistine, Vatican | Dễ |
| 8 | The School of Athens / Trường học Athens | Raphael | 1509–1511 | Bảo tàng Vatican | Khó |
| 9 | Sistine Madonna / Đức Mẹ Sistine | Raphael | 1512 | Gemäldegalerie Alte Meister, Dresden | Trung bình |
| 10 | Venus of Urbino / Thần Vệ Nữ xứ Urbino | Titian | 1538 | Uffizi, Florence | Trung bình |
| 11 | Bacchus and Ariadne / Bacchus và Ariadne | Titian | 1520–1523 | National Gallery, London | Khó |
| 12 | The Tempest / Cơn giông | Giorgione | ~1506–1508 | Gallerie dell'Accademia, Venice | Trung bình |
| 13 | The Baptism of Christ / Lễ rửa tội của Chúa Kitô | Piero della Francesca | ~1450 | National Gallery, London | Trung bình |
| 14 | The Arnolfini Portrait / Chân dung vợ chồng Arnolfini | Jan van Eyck | 1434 | National Gallery, London | Trung bình |
| 15 | The Garden of Earthly Delights / Khu vườn khoái lạc trần gian | Hieronymus Bosch | ~1490–1510 | Prado, Madrid | Siêu khó |
| 16 | Hunters in the Snow / Những người thợ săn trong tuyết | Pieter Bruegel Cha | 1565 | Kunsthistorisches Museum, Vienna | Khó |
| 17 | The Tower of Babel / Tháp Babel | Pieter Bruegel Cha | 1563 | Kunsthistorisches Museum, Vienna | Khó |
| 18 | The Ambassadors / Hai sứ thần | Hans Holbein Con | 1533 | National Gallery, London | Khó |
| 19 | Self-Portrait (1500) / Chân dung tự hoạ năm 1500 | Albrecht Dürer | 1500 | Alte Pinakothek, Munich | Dễ |
| 20 | Portrait of Baldassare Castiglione / Chân dung Baldassare Castiglione | Raphael | ~1514–1515 | Louvre, Paris | Dễ |

**Bản quyền**: các tác phẩm đã hết bảo hộ. Ý (Codice Urbani) và Vatican hạn chế chủ yếu việc dùng ảnh tác phẩm
cho **mục đích thương mại** — app phi thương mại nên giữ cả 20 tranh. Vẫn cần: trang "Nguồn ảnh" ghi rõ
bảo tàng, nguồn tải, giấy phép từng ảnh; chỉ dùng ảnh có ghi phạm vi công cộng/CC0 trên Wikimedia Commons.
Nếu sau này thương mại hoá, phải xem lại các tranh ở bảo tàng Ý/Vatican (#2, 5, 6, 7, 8, 10, 12).

### Dữ liệu mỗi tranh
```json
{
  "id": "mona-lisa",
  "title": { "en": "Mona Lisa", "vi": "Mona Lisa" },
  "artist": "Leonardo da Vinci",
  "year": "c. 1503–1519",
  "museum": { "en": "Musée du Louvre, Paris", "vi": "Bảo tàng Louvre, Paris" },
  "source": { "url": "...", "license": "Public domain", "credit": "..." },
  "crop": { "aspect": "4:5", "x": 0.0, "y": 0.05, "w": 1.0, "h": 0.8 },
  "suggestedDifficulty": "medium",
  "funFact": { "en": "...", "vi": "..." },
  "quiz": [ /* 6–8 câu, mỗi ván rút ngẫu nhiên 3 */ ]
}
```

---

## 8. Quiz

### 8.1 Định dạng
- Trắc nghiệm 4 đáp án, 15 giây/câu, 3 câu/ván rút ngẫu nhiên từ ngân hàng 6–8 câu/tranh (~140 câu).
- Mọi câu có **cả bản EN và VI**; hiển thị theo ngôn ngữ đang chọn.
- Sau mỗi câu hiện đáp án đúng + 1 câu giải thích ngắn.
- Thể loại: hoạ sĩ, niên đại, nơi lưu giữ, nhân vật/biểu tượng, chất liệu, chuyện thú vị, và **câu hỏi quan sát**
  ("Trong tranh có bao nhiêu nhân vật?", "Vật gì nằm dưới chân hai sứ thần?").

```json
{
  "id": "ambassadors-skull",
  "type": "single_choice",
  "question": {
    "en": "What is the strange distorted shape at the bottom of 'The Ambassadors'?",
    "vi": "Hình méo kỳ lạ ở dưới tranh 'Hai sứ thần' là gì?"
  },
  "options": [
    { "en": "A skull", "vi": "Một chiếc đầu lâu" },
    { "en": "A lute", "vi": "Một cây đàn luýt" },
    { "en": "A carpet", "vi": "Một tấm thảm" },
    { "en": "A globe", "vi": "Một quả địa cầu" }
  ],
  "answer": 0,
  "explain": {
    "en": "The skull is painted in anamorphic perspective and only looks right when viewed from the side.",
    "vi": "Đầu lâu vẽ theo phép phối cảnh méo (anamorphosis), chỉ nhìn đúng khi đứng lệch sang một bên."
  },
  "difficulty": 2
}
```

Ví dụ thêm (sẽ soạn đầy đủ cho cả 20 tranh):
- *Mona Lisa* — Hiện tranh được lưu giữ ở đâu? → Louvre. / Tranh vẽ trên chất liệu gì? → Gỗ dương.
- *Sự sáng tạo ra Adam* — Tranh nằm ở phần nào của nhà nguyện Sistine? → Trần nhà.
- *Những người thợ săn trong tuyết* — Tranh thuộc loạt tranh về chủ đề gì? → Các thời điểm trong năm.

Quy trình nội dung: soạn bản EN → dịch VI → rà soát sự kiện bằng nguồn bảo tàng/Wikipedia → kiểm tra
độ dài chữ trên màn hình 360 px.

### 8.2 Quiz cho ảnh riêng của người dùng
1. **Quiz trí nhớ tự sinh** (MVP, không cần AI): "Màu gạch nào nhiều nhất?", "Mảnh này thuộc góc nào?",
   "Tranh có khoảng bao nhiêu màu?" — sinh từ dữ liệu mosaic, mẫu câu song ngữ.
2. **Câu hỏi do người tạo thử thách tự viết** (Giai đoạn 2).
3. **AI sinh câu hỏi từ ảnh** (Giai đoạn 3, tuỳ chọn, cần người dùng đồng ý).

---

## 9. Tài khoản, ảnh riêng & chia sẻ

### 9.1 Đăng nhập
- Google, Facebook, email magic link.
- Chế độ khách chơi đầy đủ, thành tích lưu trên máy; đăng nhập để lưu ảnh lên cloud, đồng bộ thành tích,
  lên bảng xếp hạng.
- Đăng nhập lần đầu: gộp lịch sử/kỷ lục cục bộ vào tài khoản (đánh dấu "không xếp hạng").

### 9.2 Ảnh riêng
- Xử lý mosaic trên máy; khi lưu lên cloud: ảnh gốc thu về ≤ 2048 px, WebP, **xoá EXIF (vị trí GPS)**.
- Mặc định **riêng tư**; chỉ công khai khi người dùng chủ động chia sẻ/tạo thử thách.
- Giới hạn: tối đa 10 MB/ảnh đầu vào, 50 ảnh/tài khoản.
- Bộ lọc ảnh nhạy cảm trước khi ảnh xuất hiện trên trang chia sẻ công khai; nút báo cáo.
- Người dùng xoá được ảnh và xoá tài khoản (xoá toàn bộ dữ liệu).

### 9.3 Chia sẻ
- **Ảnh thành tích** dựng trên canvas, 1080×1350 (bài đăng) và 1080×1920 (Story/TikTok): tranh gạch, tên tranh,
  thời gian, chế độ, số mảnh, kiểu mảnh, điểm quiz, tên người chơi, link/QR — chữ theo ngôn ngữ đang chọn.
- Điện thoại: `navigator.share({ files: [ảnh], text, url })` → bảng chia sẻ hệ thống
  (Facebook, Messenger, Zalo, Instagram, TikTok…).
- Dự phòng: tải PNG + nút Facebook sharer, X intent, Zalo share, sao chép link.
- **Trang chia sẻ công khai** `/s/{id}`: tranh + thành tích + nút "Thử ghép tranh này". Thẻ Open Graph có
  ảnh OG sinh phía server.

---

## 10. Kiến trúc kỹ thuật

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript**, Tailwind CSS | SSR cho trang chia sẻ/OG, PWA, hệ sinh thái lớn |
| i18n | **next-intl**, route `/en/...` và `/vi/...` | Song ngữ, SEO từng ngôn ngữ, ảnh OG đúng ngôn ngữ |
| Bàn ghép | Canvas 2D (PixiJS nếu > 100 mảnh bị giật) + Pointer Events; `Path2D` cho mảnh jigsaw | Mượt trên mobile, tự kiểm soát kéo/thả/zoom |
| Xử lý ảnh | Web Worker + OffscreenCanvas, thuần TS | Không đơ UI, chạy offline, không cần upload |
| State | Zustand; IndexedDB (Dexie) cho ván đang chơi và thành tích khách | Nhẹ, truy vấn được lịch sử |
| Backend | **Supabase**: Auth, Postgres, Storage, Edge Functions | Đủ nhu cầu, gói miễn phí hợp dự án phi thương mại, RLS bảo vệ dữ liệu |
| Ảnh OG | `@vercel/og` (Satori) | Ảnh xem trước cho link chia sẻ |
| Hosting | Vercel (gói Hobby) + Supabase (gói Free) | Miễn phí cho dự án phi thương mại |
| Tiền xử lý thư viện | Script Node + `sharp` lúc build | Tranh thư viện tải tức thì |
| Kiểm thử | Vitest (engine, ngàm jigsaw, chấm điểm, phát lại nhật ký), Playwright (viewport iPhone/Android, cả 2 ngôn ngữ) | |
| Theo dõi | Sentry (lỗi), Plausible (phân tích ẩn danh) | |

### 10.1 Mô hình dữ liệu (Postgres)
```
profiles        (id, display_name, avatar_url, locale[en|vi], created_at)
artworks        (id, owner_id NULL=thư viện, kind[library|user], title JSONB{en,vi}, artist, year,
                 museum JSONB, source_url, license, image_path, aspect,
                 visibility[private|unlisted|public], created_at)
mosaics         (id, artwork_id, palette_id, width, height, dithering, indices BYTEA, created_at)
quiz_questions  (id, artwork_id, author_id, payload JSONB{question,options,answer,explain theo en/vi},
                 difficulty)
challenges      (id, code, creator_id, mosaic_id, pieces, shape[square|jigsaw], mode, seed,
                 preview_policy, quiz_ids[], expires_at, created_at)
attempts        (id, user_id NULL, guest_name NULL, mosaic_id, challenge_id NULL, pieces, shape, mode,
                 seed, preview_policy, server_started_at, server_finished_at, duration_ms,
                 penalty_ms, moves, peeks, hints, quiz_correct, score, move_log JSONB,
                 status[ranked|unranked|flagged], created_at)
personal_bests  (view: min(duration_ms + penalty_ms) theo user × mosaic × pieces × shape × mode × preview_policy)
badges / user_badges
shares          (id, attempt_id, image_path, locale, created_at)
```
Bảng xếp hạng = view trên `attempts` (status = ranked). Row Level Security: người dùng chỉ đọc/ghi ảnh &
ván của mình; dữ liệu công khai chỉ qua view.

### 10.2 Cấu trúc repo `legart`
```
apps/web/                 Next.js app
  app/[locale]/           /, /library, /play/[id], /c/[code], /s/[id], /me, /me/history, /credits
  messages/en.json, vi.json
packages/mosaic-engine/   resize, Lab, lượng tử hoá, dithering, render nút (có test)
packages/puzzle-core/     seed PRNG, xáo trộn, sinh ngàm jigsaw, luật chế độ, kiểm tra thắng,
                          chấm điểm, phát lại nhật ký
packages/content/         20 tranh: metadata, ngân hàng câu hỏi en/vi, bảng màu, nguồn ảnh
scripts/build-library.ts  tiền xử lý ảnh thư viện
supabase/                 migrations SQL, RLS policies, edge functions (verify-attempt, og-image)
docs/PLAN.md              tài liệu này
```
Monorepo pnpm workspaces. `puzzle-core` dùng chung cho client và edge function xác thực → luật chơi chỉ viết một lần.

---

## 11. Yêu cầu phi chức năng

- **Hiệu năng**: tạo mosaic 48×48 < 300 ms trên điện thoại tầm trung; bàn ghép 60 fps với 100 mảnh vuông /
  64 mảnh jigsaw; LCP < 2,5 giây trên 4G.
- **Responsive**: thiết kế từ 360 px; vùng chạm ≥ 44 px; hỗ trợ dọc/ngang; tôn trọng safe-area.
- **Song ngữ**: không có chuỗi viết cứng trong code; kiểm tra chữ tiếng Việt (dài hơn, có dấu) không tràn khung;
  định dạng số/thời gian theo locale.
- **Khả năng tiếp cận**: tương phản đủ, không chỉ dùng màu báo đúng/sai (thêm ✓), `prefers-reduced-motion`,
  bàn phím trên desktop.
- **Riêng tư**: ảnh khách không rời thiết bị; xoá EXIF; trang chính sách quyền riêng tư & điều khoản (EN/VI);
  tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
- **Offline**: Service Worker lưu cache thư viện → chơi được khi mất mạng; thành tích ghi cục bộ, đồng bộ khi có mạng.

---

## 12. Lộ trình & mốc kiểm tra

| Mốc | Nội dung | Tiêu chí hoàn thành |
|---|---|---|
| M0 – Khung dự án & engine | Monorepo, Next.js + next-intl (EN/VI), CI; `mosaic-engine` + trang thử: tải ảnh → tranh gạch | 20 tranh mẫu trông "ra gạch" đẹp, đạt hiệu năng §11 |
| M1 – Mảnh vuông | `puzzle-core`, ô lưới kéo/thả/đổi chỗ/xoay, 3 chế độ, đồng hồ | Chơi thử 36 mảnh trên iPhone & Android thật thấy mượt |
| M2 – Mảnh jigsaw | Sinh ngàm theo seed, vẽ `Path2D`, kéo tự do, hút vào bàn, ghép nhóm | 36 mảnh jigsaw mượt trên điện thoại; cùng seed ra cùng hình |
| M3 – Nội dung | 20 tranh tiền xử lý, metadata EN/VI, ~140 câu quiz EN/VI, trang nguồn ảnh | Quiz đã được rà soát sự kiện ở cả 2 ngôn ngữ |
| M4 – Hoàn thiện MVP | Quiz, màn kết quả, ghi thành tích cục bộ, lịch sử & kỷ lục, ảnh thành tích, Web Share, PWA | Chia sẻ được lên Facebook/Zalo từ điện thoại; chơi thử với 5–10 người |
| M5 – Tài khoản | Supabase Auth, lưu ảnh riêng, đồng bộ & gộp thành tích | RLS được kiểm thử |
| M6 – So tài | Ván xếp hạng, xác thực nhật ký, bảng xếp hạng, link thách đấu, huy hiệu, trang `/s/{id}` | Không gửi được thời gian giả qua API |

Rủi ro chính: (1) nhãn hiệu LEGO; (2) jigsaw nhiều mảnh chật trên điện thoại; (3) chi phí dịch & rà soát
~140 câu hỏi song ngữ; (4) kiểm duyệt ảnh người dùng trên trang công khai; (5) gian lận bảng xếp hạng —
giảm thiểu bằng xác thực phía server, chấp nhận không tuyệt đối.

---

## 13. Câu hỏi còn mở

1. **Tên miền**: dùng "Legart" làm tên hiển thị? Có tên miền sẵn chưa (tạm dùng `*.vercel.app`)?
2. **Hạ tầng**: đồng ý Supabase (Free) + Vercel (Hobby)?
3. **Quiz AI cho ảnh riêng** (Giai đoạn 3): có muốn làm không?
4. **Bảng xếp hạng cho khách**: chỉ người đăng nhập mới lên bảng (đề xuất), hay khách có biệt danh cũng được?
