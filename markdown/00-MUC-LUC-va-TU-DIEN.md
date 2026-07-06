# CRM RLVN — MỤC LỤC & TỪ ĐIỂN DÙNG CHUNG

> File này là cửa vào của toàn bộ thiết kế. Mở đầu mỗi buổi → đọc file này để nắm toàn cảnh.
> Cập nhật lần cuối: 06/06/2026

---

## CÁCH ĐỌC BỘ TÀI LIỆU NÀY

Mỗi luồng nghiệp vụ = 1 file, bên trong có 4 lớp cố định:

1. **Ảnh chụp nhanh** — sơ đồ + 3 câu (vai / đường đi / đích). Hiểu luồng trong 30 giây.
2. **Luật đã chốt** — bảng rule đánh số, đủ rõ để dev code thẳng. Đây là phần dev tra mỗi ngày.
3. **Vì sao** — mỗi quyết định lớn: phương án đã cân nhắc, lý do chọn. Phần giữ mạch tư duy.
4. **Còn mở** — câu chưa chốt + tình huống biên. Chống việc dev tự chế khi gặp chỗ trống.

> Quy ước trạng thái rule: ✅ đã chốt · 🟡 chốt hướng, chờ chi tiết · 🔴 chưa quyết

---

## TRẠNG THÁI 7 LUỒNG

| # | Luồng | Trạng thái | File |
|---|---|---|---|
| 1 | Lead vào | ✅ Đã review cùng Sếp | `02-Luong-1-Lead-Vao.md` |
| 2 | Chia lead | ✅ Đã review cùng Sếp | `03-Luong-2-Chia-Lead.md` |
| 3 | Chăm sóc & nhiệt độ | ✅ Đã review cùng Sếp | `04-Luong-3-Cham-Soc-Nhiet-Do.md` |
| 4 | Hợp tác & chia hoa hồng | ✅ Đã review cùng Sếp | `05-Luong-4-Hop-Tac-Hoa-Hong.md` |
| 5 | Kho data (Databank) | ✅ Đã review cùng Sếp | `06-Luong-5-Kho-Data.md` |
| 6 | Tiền (cọc → doanh thu → phí môi giới) | ✅ Đã review cùng Sếp (kế toán: gác, mục riêng) | `07-Luong-6-Tien.md` |
| 7 | Dữ liệu ngược (CAPI, báo cáo, AI) | ✅ Đã review cùng Sếp | `08-Luong-7-Du-Lieu-Nguoc.md` |

**Tài liệu ngang (cắt qua mọi luồng):**

| Tài liệu | Trạng thái | File |
|---|---|---|
| Phân quyền (Vai × Đối tượng × Hành động) | 🟡 Nháp — chờ chốt 5 điểm | `09-Phan-Quyen.md` |
| Vòng đời chiến dịch (mở/vận hành/đóng + nạp config) | 🔴 Chưa thảo luận | _(sẽ viết)_ |
| Trung tâm thông báo (sự kiện → người nhận → kênh) | 🔴 Chờ chốt kênh chính | _(sẽ viết)_ |
| Dashboard chi tiết theo vai | 🔴 Buổi riêng sau ERD — đã có đầu bài | _(Luồng 7 — M4)_ |
| Kế hoạch kiểm thử toàn diện | ✅ Đăng ký phê duyệt | `11-ke-hoach-kiem-thu-toan-dien.md` |

**Tài liệu nền (đã có):**
- `01-bao-cao-hien-trang-database.md` — audit 24 bảng MySQL hiện tại
- `10-ERD-v0.1.mermaid` + `10-ERD-v0.1-tu-dien-du-lieu.md` — schema v0.1 (28 bảng nghiệp vụ + 3 hạ tầng), mỗi bảng neo số luật
- BRD gốc (bạn hệ thống viết) — dùng đối chiếu, KHÔNG phải bản gốc để số hóa

---

## TỪ ĐIỂN THỰC THỂ (chốt 06/06 — dùng thống nhất toàn dự án)

| Thuật ngữ | Định nghĩa | Ghi chú |
|---|---|---|
| **Lead** | 1 lần đăng ký / phản hồi từ 1 nguồn (form, broadcast, nhập tay...) | Bản ghi gốc, chỉ thêm không sửa. FB mỗi lần đăng ký = 1 lead; Google gộp theo ngày |
| **Person** | Con người duy nhất, gom theo SĐT | Thực thể hậu trường — sale KHÔNG nhìn thấy trực tiếp. Giữ lịch sử xuyên chiến dịch |
| **KHTN** | Person đang được 1 sale tiếp nhận - chăm sóc trong 1 chiến dịch | = Person × Team/Sale × Campaign. 1 Person → N KHTN |
| **Khách** | Person đã **phát sinh doanh thu thực cho công ty** (tiền phí về ít nhất 1 đợt) — không đơn thuần "đã đặt cọc". Bể hợp đồng mà chưa phát sinh doanh thu → chưa là Khách | Chốt 06/06 |

**Quan hệ:** `Lead → (nối theo SĐT) → Person → (sinh ra) → KHTN`

---

## TỪ ĐIỂN NGUỒN LEAD

| Mã | Nguồn | Tự động thu? | Tính TTL1? |
|---|---|---|---|
| `R3_Fb` | Facebook Ads — lead form | ✅ (90%) | ✅ |
| `R3` | Google: leadform/LP, + chủ động (web, hotline) | ✅ một phần | ✅ |
| `R2` | Tool quét số 3G/4G (KH truy cập web) | ✅ | ✅ |
| `messenger` | Meta Messenger | ❌ MKT nhập tay | ✅ |
| `zalo_oa` | Zalo OA chat | ❌ MKT nhập tay | ✅ |
| `broadcast` | KH cũ phản hồi đợt broadcast dự án mới | ❌ qua tool ngoài | (xét riêng) |
| `databank` | Lead cũ trong kho, sale tự khai thác lại | — | ❌ (đánh giá riêng) |
| `gioi_thieu` | KH (gốc MKT) giới thiệu người quen — **thuộc dòng MKT** | ❌ sale nhập + bắt buộc ghi người giới thiệu | ❌ |
| `ca_nhan` | Nguồn khách riêng của sale (kể cả khi khách cá nhân giới thiệu thêm người) | ❌ sale nhập | ❌ |

**Luật kế thừa dòng nguồn (chốt 06/06):** Người được giới thiệu kế thừa dòng nguồn của người giới thiệu. A gốc MKT → B là `gioi_thieu` (dòng MKT, doanh thu tính cho MKT). A là khách cá nhân → B vẫn là `ca_nhan`. Lead `gioi_thieu` bắt buộc trỏ về Person của người giới thiệu → attribution trace về campaign gốc.

**Nguyên tắc vàng:** MKT chịu trách nhiệm toàn bộ TRƯỚC phễu (mọi kênh Fanpage/Messenger/Zalo OA của công ty). Sales chỉ chăm sóc & chuyển đổi, KHÔNG can thiệp khi lead chưa vào phễu. Ngoại lệ: nguồn `ca_nhan` là khách riêng của sale.

---

## TRẠNG THÁI KHTN (state machine) — ✅ chốt 06/06

**Nguyên tắc:** trạng thái là thuộc tính của KHTN → bẩm sinh động theo chiến dịch (1 Person có thể "Đã Gặp" ở OC và "Quan Tâm" ở TGC cùng lúc). Giá trị thật của chiến dịch tính từ Quan Tâm trở lên.

**Phễu chốt:**

`Chưa Xác Định → Quan Tâm → Đồng Ý Gặp → Đã Gặp → Booking → Đặt Cọc`

**2 cửa thoát — sale chỉ thấy 1 nút "Loại khỏi phễu" + chọn lý do (1 chạm, bắt buộc). Hệ thống tự phân loại theo lý do, sale không cần học khái niệm:**

| Lý do sale chọn | Hệ thống route thành | Xử lý |
|---|---|---|
| Số ảo / không liên lạc được / không phải người thật | **Not Lead** | Khóa khách → MKT duyệt → loại vĩnh viễn + bắn `BAD` về Meta |
| Không đủ tài chính / hết nhu cầu / đã mua dự án khác | **Đóng — không phù hợp** (thay "Chăm Sóc Dài Hạn" cũ) | Hiệu lực ngay, không cần duyệt. KHTN → tab đã đóng. **Person gắn tag lý do** → tệp broadcast dự án sau |

- Rào chống lách: **chưa có tương tác ghi nhận nào → không được chọn nhóm lý do Đóng — Không Phù Hợp** (chưa nói chuyện sao biết hết nhu cầu) — lead chưa chạm chỉ có đường Not Lead
- Giám sát khe xả van: tỷ lệ Đóng — Không Phù Hợp per sale so trung bình chiến dịch (cùng công thức giám sát Not Lead)
- Nguồn `ca_nhan`/`gioi_thieu` được tạo KHTN với trạng thái khởi tạo cao (nhảy thẳng Booking/Đặt Cọc khi nhập lúc giao dịch)
- BRD đề xuất thêm "Thiện chí" — chưa chốt vị trí. State machine phải cấu hình được, không hardcode.

---

## 4 NHIỆT KHÁCH (Bếp Đun Nước — trục độc lập với trạng thái)

`Lạnh · Ấm · Nóng · Sôi` — tính **theo từng dự án**, dao động được, tự rớt khi ngừng tương tác.

> Trạng thái = vị trí trên hành trình (chỉ tiến qua điểm chạm thật). Nhiệt = cảm xúc (lên xuống tự do). Hai trục riêng. Cảnh báo đỏ = Trạng thái cao + Nhiệt tụt.
