# BÁO CÁO HIỆN TRẠNG DATABASE — AppsheetRLVN

> Audit ngày 05/06/2026 — dữ liệu sống, lead mới nhất vào lúc 12:34 trưa nay.
> Phạm vi: MySQL `AppsheetRLVN` — 22 bảng + 2 view, ~67.000 dòng dữ liệu.
> Mục đích: bản đồ hiện trạng để quyết định **giữ — tối ưu — phát triển** khi thiết kế schema mới.

---

## 1. TỔNG QUAN

| Chỉ số | Giá trị |
|---|---|
| Khoảng thời gian dữ liệu | 26/08/2024 → nay (live) |
| Tổng LEADS | 8.729 (8.428 SĐT khác nhau → ~300 SĐT trùng) |
| Tổng KHTN (instance chăm sóc) | 9.362 |
| Tổng ghi chú chăm sóc (LS_CSKH) | 30.771 |
| Giao dịch (LS_GIAODICH) | 76 |
| Foreign Key thật trong DB | **0** (toàn bộ quan hệ là "ngầm" qua text) |
| Index phụ | 19 |

**Nguồn lead thực tế:** FbAds/R3_Fb: 7.405 (85%) · GAds/R2: 1.068 · GAds/R3: 253 · SEO: 2 · ZaloAds: 1

---

## 2. BẢN ĐỒ 24 BẢNG — NHÓM THEO CHỨC NĂNG

### Nhóm lõi nghiệp vụ (trái tim hệ thống)
| Bảng | Dòng | Vai trò | Ghi chú |
|---|---|---|---|
| `LEADS` | 8.729 | 1 dòng = 1 lần đăng ký | 36 cột, có sẵn `ad_id`, `campaign`, `ad_name`, `client_context` → attribution đã có nền |
| `KHTN` | 9.362 | 1 dòng = 1 Khách × 1 Team × 1 Campaign | 37 cột — bảng "béo" nhất, chứa cả state, evidence, timestamps |
| `LS_CSKH` | 30.771 | Ghi chú chăm sóc 2 chiều | Có `phanhoi_kh`, `trangthai_kh` (mầm của nhiệt độ KH) |
| `LS_GIAODICH` | 76 | Giao dịch Booking/Cọc | `id` không có PRIMARY KEY |
| `LEADS_KHOCHUNG` | 12.865 | Kho data chung (KHODATA) | Chỉ 5 cột — bảng "con trỏ" vào LEADS |
| `DUYET_NOTLEAD` | 1.333 | Quy trình duyệt Not Lead | |

### Nhóm cấu hình & danh mục
| Bảng | Dòng | Ghi chú |
|---|---|---|
| `TRANG_THAI` | 8 | 8 trạng thái (BRD mới đề xuất 9 — thêm "Thiện chí") |
| `CAMPAIGN` | 4 | Chiến dịch nội bộ |
| `DU_AN` | 37 | Có `name_n8n`, `domain_name` → đã tích hợp pipeline |
| `TEAM` | 34 | Chứa state máy chia lead: `stt_R3`, `stt_R2` (con trỏ xoay vòng), hạn mức, `rich_coint` |
| `NHAN_VIEN` | 54 | ⚠️ Có cột `password` lưu **plaintext** |
| `LICH`, `LOC` | 27/72 | Lịch + bộ lọc chia lead |

### Nhóm phụ trợ / nghi vấn rác
| Bảng | Dòng | Đánh giá |
|---|---|---|
| `Term_TACVUKHAC` | 13.230 | Chỉ có 2 cột `id, dele` — 13K dòng gần như chắc chắn là rác kỹ thuật AppSheet |
| `BOTCALL` | 101 | Tích hợp bot gọi — thử nghiệm |
| `CHANDUNG_KHACHHANG` | 2 | Có cấu trúc tốt (nhu_cau, rao_can, canh_tranh...) nhưng gần như không dùng |
| `MENU`, `DASHBOARD`, `TAI_LIEU`, `THONG_TIN_CTY` | <50 | Cấu hình UI AppSheet — không mang sang hệ mới |
| `KHTN_GDSAN`, `LEADS_GDSAN` | view | View lọc theo role Giám Đốc Sàn — cách AppSheet "giả lập" Row-Level Security |

---

## 3. QUAN HỆ NGẦM GIỮA CÁC BẢNG (thực tế đang chạy)

```
CAMPAIGN (1) ──< DU_AN (n)
LEADS (1) ──< KHTN (n)            qua KHTN.lead_id = LEADS.id
KHTN (1) ──< LS_CSKH (n)          ⚠️ nhưng 24% ghi chú nối qua lead_id, KHÔNG có khtn_id
KHTN (1) ──< LS_GIAODICH (n)
TEAM (1) ──< NHAN_VIEN (n)        qua NHAN_VIEN.team_id
TEAM (1) ──< KHTN (n)             qua KHTN.team_id
LEADS (1) ──< LEADS_KHOCHUNG (n)  lead được public ra kho
```

**Phân bố multi-team trên 1 lead** (xác nhận mô hình 1 Lead → N KHTN đang chạy thật):
- 4.902 lead có 1 team chăm · 1.259 lead 2 team · 426 lead 3 team · ... · 3 lead 9 team
- 113 KHTN có `lead_id = NULL` (tạo tay, không gắn nguồn)

**Format ID:** tự sinh dạng text có prefix — `KHTN...`, `TM...` (team), `NV...` (nhân viên), `DA...` (dự án), `CAMP...`, `LSCSKH...`. Riêng `LEADS.id` trộn 2 loại: ID leadgen Facebook (số 16 chữ số) và ID nội bộ prefix `R2...`. ⚠️ Phát hiện 2 format sinh ID khác nhau cùng tồn tại trong KHTN (`KHTN6060514...` vs `KHTN2606051...`) — 2 trình sinh ID khác nhau đang chạy song song.

---

## 4. CÁCH HỆ THỐNG "LÁCH" ĐỂ CHẠY ĐƯỢC TRÊN APPSHEET

Đây là phần giá trị nhất để hiểu — mỗi chỗ "lách" là 1 yêu cầu nghiệp vụ thật mà schema mới phải giải quyết đàng hoàng:

| # | Cách lách hiện tại | Nghiệp vụ thật đằng sau | Schema mới nên làm |
|---|---|---|---|
| 1 | Lịch sử trạng thái nén thành 6 cột thời gian trong KHTN (`quantam_time`, `dongygap_time`, `dagap_time`, `booking_time`, `datcoc_time`, `csdh_time`) | Cần biết KHTN chuyển trạng thái lúc nào để tính bảo mật + đo funnel | Bảng `state_history` riêng (event log) — không giới hạn số lần chuyển, không mất lịch sử khi quay lui |
| 2 | Bằng chứng (ảnh UNC, check-in) là 3 cột trong KHTN | Chống khai khống khi chuyển trạng thái | Bảng `attachments` đa hình, gắn vào sự kiện chuyển trạng thái |
| 3 | Con trỏ xoay vòng chia lead nằm trong TEAM (`stt_R3`, `stt_R2`) | Round-robin công bằng giữa các team | Bảng `routing_queue` + log offer/accept/reject riêng — hiện tại KHÔNG có log từ chối/bỏ lỡ |
| 4 | Số liệu tháng lưu thành chuỗi text `"R3: 6 \| R2: 1"` trong TEAM | Đếm lead đã nhận theo loại trong tháng để check hạn mức | Đếm trực tiếp từ data thật (query/materialized view) — không lưu số liệu tổng hợp thành text |
| 5 | 2 view `*_GDSAN` nhân bản theo role | Phân quyền Giám Đốc Sàn | Row-Level Security thật ở tầng DB |
| 6 | `trangthai_kh` ("Hứng thú"...) trong LS_CSKH, dùng rải rác | Sales đã có nhu cầu ghi nhiệt độ cảm xúc của khách | Trường chuẩn hóa trong note + nguồn tín hiệu cho Lead Scoring |
| 7 | Form phản hồi KH lần 1 nhúng thành text tự do trong `noi_dung` | Thu thập chân dung KH có cấu trúc | Bảng/JSON field riêng cho form phản hồi — đừng chôn data có cấu trúc vào text |
| 8 | `CHANDUNG_KHACHHANG` thiết kế tốt nhưng chỉ 2 dòng | Ý định lưu chân dung KH có cấu trúc — chưa vận hành được | Giữ thiết kế, gắn vào Person (không gắn lead), làm bắt buộc theo trạng thái |

---

## 5. VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU (đo thật)

| # | Vấn đề | Con số | Hệ quả |
|---|---|---|---|
| 1 | Không có Foreign Key nào | 0 FK / 22 bảng | DB không tự bảo vệ được tính toàn vẹn — mọi ràng buộc phụ thuộc app |
| 2 | Ghi chú không gắn KHTN | 7.461/30.771 (24%) chỉ có `lead_id` | Không tách được ghi chú của team nào → phân quyền note theo team bị hổng |
| 3 | KHTN mồ côi | 122 KHTN có `lead_id` không tồn tại trong LEADS | Mất attribution các khách này |
| 4 | Chuyển trạng thái thiếu timestamp | 262 KHTN ≥ "Quan Tâm" nhưng `quantam_time` NULL | Funnel timing sai, bảo mật KHODATA tính sai |
| 5 | SĐT trùng giữa các lead | ~300 SĐT | Đúng thiết kế (1 người nhiều lần đăng ký) nhưng không có Person để gom |
| 6 | Password plaintext | 54 tài khoản, độ dài 7-24 ký tự | Rủi ro bảo mật nghiêm trọng — hệ mới phải hash (bcrypt/argon2) |
| 7 | `trang_thai` lưu dạng text số ("2", "5") | toàn bộ KHTN, LEADS | Phải ép kiểu khi query, dễ lỗi so sánh |
| 8 | Bảng rác | `Term_TACVUKHAC` 13K dòng | Xác nhận bỏ khi migrate |

---

## 6. ĐỐI CHIẾU BRD ↔ DATABASE THẬT

| Điểm trong BRD | Trong DB thật | Kết luận |
|---|---|---|
| 9 trạng thái (có "Thiện chí") | Chỉ có 8 (chưa có Thiện chí) | BRD đang mô tả tương lai — cần state machine cấu hình được |
| Lead Google gộp theo ngày | `kenh='GAds'` có cả R2 (1.068) lẫn R3 (253) | ✅ Đã giải: R2 có `loai_lead="Quét số ĐT"` đúng định nghĩa tool quét số — cột `kenh` bị pipeline gắn nhãn sai "GAds" cho lead ngoài Facebook. Schema mới: trường phân loại phải là enum có ràng buộc |
| Cơ chế 5 phút nhận/từ chối | Không có bảng log offer/reject — chỉ có con trỏ xoay vòng | Lịch sử "team nào bỏ lỡ bao nhiêu lần" (BRD muốn đo) hiện KHÔNG đo được |
| Bảo mật KHODATA theo trạng thái | `LEADS_KHOCHUNG` chỉ ghi lead vào kho — logic thời gian nằm trong app | Đưa thành bảng config + scheduled job |
| Audit log toàn hệ thống | Không có bảng audit nào | Phải xây mới từ đầu |
| Check-in 8h30 | Không thấy bảng check-in (có thể nằm ngoài DB này) | Cần hỏi bạn hệ thống |

---

## 7. KẾT LUẬN — INPUT CHO THIẾT KẾ SCHEMA MỚI

**Giữ (logic nghiệp vụ đã được tôi luyện):** mô hình 1 Lead → N KHTN (đang chạy thật, 47% lead có ≥2 team chăm trong lịch sử); evidence-gated state transitions; quy trình duyệt Not Lead; KHODATA; xoay vòng chia lead.

**Tối ưu (đúng ý tưởng, sai cấu trúc):** state history → event log; routing → queue + log đầy đủ; phân quyền view → RLS; form phản hồi → structured data; số liệu tổng hợp → tính từ data thật; ID → 1 trình sinh duy nhất.

**Phát triển mới (chưa có):** thực thể PERSON (identity resolution); Lead Scoring (đã có mầm `trangthai_kh`); bảng audit; cost ingestion từ Meta/Google; spec CAPI nội bộ (thay pipeline Google Sheet); metric chất lượng nhập liệu.

**Taxonomy nguồn lead (chuẩn — từ skill sale-danh-gia-team):**
- Nguồn MKT (tính TTL1): `R3_Fb` = Facebook Ads · `R3` = Google + chủ động (leadform, Zalo, web, hotline) · `R2` = tool quét số 3G/4G
- Nguồn khác: `databank` (pool data cũ, sale tự khai thác) · `giới thiệu` · `cá nhân` · `broadcast`
- ⚠️ Thời hạn rơi Databank trong skill (6h/1ng/2ng/3ng) ≠ BRD (3h/+1/+3/+4/+5ng) — 2 snapshot của rule hay đổi → schema mới cần bảng config có hiệu lực theo thời gian + lưu lịch sử thay đổi rule

**3 việc cần làm tiếp:**
1. Hỏi bạn hệ thống: check-in lưu ở đâu? Logic bảo mật KHODATA code ở đâu (n8n hay AppSheet)?
2. Em vẽ ERD schema mới v0.1 trên nền từ điển ĐĂNG KÝ / KHÁCH / KHTN đã thống nhất
3. Sếp chốt phạm vi visibility ghi chú trong team (cả team / cặp buddy / cá nhân)
