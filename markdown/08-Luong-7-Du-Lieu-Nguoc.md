# LUỒNG 7 — DỮ LIỆU NGƯỢC (CAPI · BÁO CÁO · AI)

> Trạng thái: ✅ Sếp duyệt 06/06/2026 (gồm 7.5 Đóng — Không Phù Hợp không bắn Meta · 7.2 bắn theo Person · 7.13 số CRM là chuẩn)
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md` + `META-CAPI-MAPPING.md` (hệ thống Richland-AI)

---

## LỚP 1 — ẢNH CHỤP NHANH

Luồng duy nhất chảy NGƯỢC: dữ liệu sinh ra từ 6 luồng trước quay lại nuôi 3 nơi:

```
                       ┌─→ [A] META (CAPI): trạng thái → event → thuật toán học
DATA 6 luồng trước ────┼─→ [B] CON NGƯỜI: dashboard theo vai (sale/quản lý/GĐKD/MKT)
                       └─→ [C] AI: đọc data sạch → gợi ý (Phase 2)
```

- **Vai tham gia:** Hệ thống (bắn event, dựng báo cáo) · MKT (giám sát match quality, config mapping) · các vai đọc dashboard · AI (Phase 2).
- **Đường đi:** mỗi sự kiện nghiệp vụ (lead vào, đổi trạng thái, cọc, Not Lead...) → tự động tỏa về 3 nhánh — không ai phải "làm báo cáo" thủ công.
- **Đích cuối:** vòng kín chạy thật — chất lượng chăm sóc hôm nay quyết định chất lượng lead ngày mai; mỗi vai mở app thấy đúng con số của vai mình trong <10 giây.

---

## LỚP 2 — LUẬT ĐỀ XUẤT (nháp)

### [A] CAPI — CRM → Meta

| # | Luật | TT |
|---|---|---|
| 7.1 | **Kế thừa dataset + mapping đang chạy** (Nhà Sang SG RLVN, dataset 1215510833908739): `CompleteRegistration` (lead mới) · `CONVERTED` (Quan Tâm) · `Schedule` (Đồng Ý Gặp + Đã Gặp) · `Purchase` (Booking value=tiền giữ chỗ; Đặt Cọc value=tiền cọc) · `BAD` (Not Lead). **Không đổi tên event** — đổi là reset learning của Meta | ✅ |
| 7.2 | **Bắn theo LEAD, chỉ tiến (forward-only)** *(chốt cùng dev 06/06)*: event bắn theo **lead gốc của KHTN** nơi sự kiện xảy ra; **khóa so khớp chính = `lead_id` do Meta cấp** (leadform); hash SĐT/email gửi kèm trong user_data để tăng match quality; nguồn không có lead_id Meta (R2, broadcast, nhập tay) match bằng hash. Person thuần nội bộ để đo lường — không tham gia matching. Mỗi mốc bắn 1 lần/lead, tụt trạng thái không bắn lùi (luật 6.17). `Purchase` (có value) bắn 1 lần theo lead gốc của KHTN chốt deal — tránh trùng doanh thu | ✅ |
| 7.3 | **Bắn thẳng từ CRM** — bỏ Google Sheet trung gian (bớt điểm gãy). `action_source=system_generated`, hash SĐT/email SHA256, kèm `lead_id` cho Conversion Leads matching | ✅ |
| 7.4 | **Vá nợ cũ ngay khi go-live**: `BAD` bắn đều tự động khi MKT duyệt Not Lead (hiện đang bắn không đều — mất signal âm); bỏ event `Qualified_Lead` (trùng vai với CONVERTED) | ✅ |
| 7.5 | **Đóng — Không Phù Hợp: KHÔNG bắn gì** — không phải `BAD`. Người thật nhưng chưa hợp dự án là tệp tốt cho dự án khác; dán nhãn xấu = dạy Meta né nhầm tệp tiềm năng = tự đầu độc targeting | ✅ |
| 7.6 | **Giám sát pipeline bắn event**: hàng đợi + tự bắn lại khi Meta lỗi; cảnh báo khi 1 loại event >24h không gửi được (chống "stale" từng bị: BAD im 9 ngày không ai biết); theo dõi Match Quality | ✅ |
| 7.7 | *(Chốt cùng dev 06/06)*: `client_context` = hộp nhận diện **theo nguồn, thuộc LEAD** (lưu lúc tiếp nhận): lead FB chứa fbp/fbc khi có; lead Google chứa thông tin nhận diện từ landing page. CAPI đọc từ LEAD khi bắn. Phase 3 Google Enhanced Conversions: nguyên liệu đã được tích trữ sẵn — việc còn lại là connector Data Manager API + xác minh độ phủ gclid trong data thật | ✅ |
| 7.8 | Mapping trạng thái ↔ event = **bảng config** — state machine đổi (thêm Thiện chí...) thì sửa config, không sửa code | ✅ |

### [B] Báo cáo — CRM → con người

| # | Luật | TT |
|---|---|---|
| 7.9 | Mỗi vai 1 màn hình chính: **Sale** (phễu cá nhân, danh sách đỏ, nhắc việc, hoa hồng dự kiến) · **Quản lý** (team, hàng đợi duyệt, cảnh báo nguội/Not Lead bất thường, chất lượng nhập liệu) · **GĐKD** (phễu chiến dịch, doanh thu ghi nhận, so sánh sale, phiếu hợp tác chờ duyệt) · **MKT/Sếp** (CAC–ROAS theo campaign, phân bố tag vướng, chất lượng nguồn lead, sức khỏe CAPI) | ✅ |
| 7.10 | **Cost ingestion**: kéo chi phí ads Meta theo **ngày × ad** — level thấp nhất *(sửa theo dev 06/06)*; campaign/adset là roll-up. Join với `LEAD.ad_id` → CPL/CAC tới từng ad/creative, drill-down không cần mở Ads Manager. Google thêm sau | ✅ |
| 7.11 | Mọi con số trên báo cáo **tính từ data gốc** (state_history, lead tính công, log chia...) — cấm lưu số tổng hợp thành text/cột tĩnh (bài học `leadnhan_month = "R3: 6 \| R2: 1"` của hệ cũ) | ✅ |
| 7.12 | **Chỉ số chất lượng nhập liệu** hiển thị cho quản lý: note coverage, độ trễ cập nhật trạng thái, % ghi chú có tag — van điều khiển của cả vòng lặp dữ liệu | ✅ |
| 7.13 | Số CRM là chuẩn khi đếm lead/CPL — số Meta API chỉ tham khảo (Meta đếm cả modeled conversions, từng lệch 37%) — rule đã có trong hệ skill, nay thành luật hệ thống | ✅ |

### [C] AI — Phase 2, Phase 1 chỉ chừa cửa

| # | Luật | TT |
|---|---|---|
| 7.14 | Phase 1 KHÔNG build tính năng AI — chỉ đảm bảo 2 điều kiện cho Phase 2: schema sạch + API đọc chuẩn (MCP server kế thừa `mysql-appsheet-rlvn`) | ✅ |
| 7.15 | AI đọc data qua quyền riêng **tôn trọng RLS**: AI phục vụ sale nào chỉ thấy data sale đó được thấy. Không có "AI nhìn tất" cho người dùng cuối | ✅ |
| 7.16 | Ứng viên AI Phase 2 (đã có nền skill): gợi ý checklist theo KHTN (BRD P2) · dự đoán nhiệt từ log (so với nhiệt sale chốt — data 3.3 đã lưu cả hai) · next-best-action · phân tích tag vướng cấp chiến dịch tự động | ✅ |

---

## LỚP 3 — VÌ SAO (nháp)

**Vì sao bắn theo Person, forward-only (7.2).** Mô hình mới cho phép nhiều KHTN/Person (chia tiếp, kho, broadcast) — nếu bắn theo KHTN, Meta nhận 2-3 tín hiệu trùng cho 1 con người → học méo. Person là đơn vị Meta match (hash SĐT) nên cũng là đơn vị bắn. Forward-only khớp luật 6.17 Sếp chốt: "bắn rồi thì thôi" — Meta không có khái niệm hoàn tác, bắn lùi chỉ gây nhiễu.

**Vì sao Đóng — Không Phù Hợp không bắn BAD (7.5).** `BAD` dạy Meta: "đừng tìm người giống này nữa". Đúng cho Not Lead (số ảo, rác). Nhưng người "thật, đủ tiền dự án khác, chỉ không hợp dự án này" lại chính là chân dung ta *muốn* Meta tìm tiếp — cho campaign khác. Dán BAD cho họ = tự thu hẹp tệp tốt. Đây là chỗ phân loại 2 cửa thoát (state machine 06/06) trả giá trị trực tiếp cho ads.

**Vì sao bỏ Google Sheet trung gian (7.3) + giám sát stale (7.6).** Lịch sử thật: BAD từng im 9 ngày, Qualified_Lead im 13 ngày — không ai biết cho đến khi mở Events Manager xem tay. Mỗi khâu trung gian là 1 điểm gãy thầm lặng; CRM mới bắn thẳng + tự cảnh báo khi mạch đứt.

**Vì sao cấm số tổng hợp tĩnh (7.11).** Hệ cũ lưu `leadnhan_month` thành chuỗi text — số liệu và data gốc lệch nhau là chuyện thời gian. Báo cáo phải là *hàm* của data gốc: gốc đúng thì báo cáo đúng, không có trạng thái thứ hai để lệch.

**Vì sao AI chỉ chừa cửa ở Phase 1 (7.14).** Cùng triết lý "không số hóa thứ chưa chín" (3.15): AI hữu ích khi data nền sạch và adoption thật — build AI trên data rác = gợi ý rác với chi phí cao. Phase 1 lo cái móng (schema + API); meta-skills hiện có (khtn-insight, sales-coach...) chính là bản thử nghiệm sống của các tính năng này.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | 7.5 — Sếp xác nhận: Đóng — Không Phù Hợp không bắn gì về Meta? | Chờ phản biện |
| M2 | Nếu thêm trạng thái "Thiện chí": bắn event gì (đề xuất: không bắn — giữ funnel Meta 4 mốc gọn) | Nối câu Thiện chí còn treo |
| M3 | Ngưỡng cảnh báo stale (24h? 48h?) + ai nhận cảnh báo (MKT? Thành IT?) | Config |
| M4 | Danh sách chi tiết từng dashboard (7.9) — buổi riêng sau ERD. **Đầu bài Sếp đã cho (06/06):** Sale = phễu cá nhân, lọc theo dự án/khung thời gian, doanh thu + số căn cọc + % so mục tiêu, gợi ý nút thắt trong phễu (nguồn: tag vướng + nhiệt). Quản lý điều hành = hiệu quả phễu + chi phí + doanh thu, phân theo chiến dịch/dự án | Buổi riêng |
| M5 | Cost ingestion Google Ads (Phase 3) — phụ thuộc pipeline Google → MySQL trong backlog | Roadmap |
