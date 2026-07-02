# LUỒNG 2 — CHIA LEAD

> Trạng thái: ✅ Đã review cùng Sếp 06/06/2026
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md`

---

## LỚP 1 — ẢNH CHỤP NHANH

```
Lead vào (từ Luồng 1)
   ↓
ROSTER chiến dịch (GĐKD quản) → lọc ai đủ điều kiện hôm nay:
   roster ✓ → check-in ✓ → nút sẵn sàng ✓ → van chống ôm ✓ → hạn mức ✓
   ↓
XOAY VÒNG CÁ NHÂN: chia 1 sale → 2 phút → nhận / từ chối / hết giờ → người kế tiếp
   ↓                                    (18h-6h: chỉ xoay trong danh sách trực đêm)
Sale nhận → sinh KHTN → sang Luồng 3
   ↓ (không chuyển trạng thái trong thời hạn)
DATABANK (Luồng 5) ← Quản lý cũng có thể đẩy thủ công vào đây cho sale chỉ định
```

- **Vai tham gia:** GĐKD Dự Án (quản roster) · Hệ thống xoay vòng · Sale (nhận/từ chối/tạm vắng/trực đêm) · Quản lý (duyệt xin nhận, điều phối thủ công) · MKT (duyệt Not Lead → ảnh hưởng "lead tính công").
- **Đường đi:** Lead → lọc cổng điều kiện → xoay vòng cá nhân → KHTN. Nhánh đêm 18h-6h, giờ vàng 6h-8h30. Không ai nhận → hàng đợi/databank — lead không bao giờ vô chủ.
- **Đích cuối:** Lead đến tay sale *sẵn sàng* nhanh nhất (đo bằng giây), công bằng kiểm chứng được bằng log, kỷ luật đo bằng dữ liệu thật.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### Đơn vị nhận & điều kiện

| # | Luật | TT |
|---|---|---|
| 2.1 | Đơn vị nhận lead = **cá nhân sale** (không còn team như hệ cũ) | ✅ |
| 2.2 | Roster theo chiến dịch, GĐKD Dự Án quản. Điều kiện đầu vào (test kiến thức...) là rule mềm NGOÀI hệ thống — hệ thống chỉ cần danh sách ai đang trong roster | ✅ |
| 2.3 | 1 sale tham gia nhiều chiến dịch nếu được GĐKD từng dự án cho vào roster | ✅ |
| 2.4 | Điều kiện nhận lead trong ngày = chuỗi cổng: roster → check-in → nút sẵn sàng → van chống ôm → hạn mức. Hệ thống tính 1 trạng thái tổng hợp/sale/ngày + log lý do chặn ở cổng nào | ✅ |

### Xoay vòng

| # | Luật | TT |
|---|---|---|
| 2.5 | Lead chia về 1 sale → **2 phút** không nhận → thu hồi, chuyển sale kế tiếp. Timeout là số config | ✅ |
| 2.6 | Nút **từ chối** chủ động → lead nhảy người kế tiếp ngay, không chờ hết giờ | ✅ |
| 2.7 | Nút **tạm vắng** sale tự bật/tắt: đang bật → vòng xoay bỏ qua, KHÔNG tính bỏ lỡ | ✅ |
| 2.8 | **Van chống ôm**: đang giữ quá X KHTN ở "Chưa Xác Định" → tạm bị bỏ qua đến khi xử lý bớt. X config. Đếm trên *lead tính công* | ✅ |
| 2.9 | **Lead tính công** = lead đã nhận − Not Lead được MKT duyệt. Mọi chỉ số (hạn mức, van chống ôm, TTL1, đánh giá) đếm trên mẫu số này. KHÔNG có cơ chế đền/bù lead | ✅ |
| 2.10 | Giám sát lạm dụng: tỷ lệ Not Lead của từng sale so với trung bình chiến dịch — lệch cao bất thường → tự cảnh báo quản lý | ✅ |
| 2.11 | **Log toàn bộ vòng chia**: mỗi offer (ai, lúc nào), kết quả (nhận/từ chối/timeout/bỏ qua vì cổng nào). Nguồn đo "tính sẵn sàng" | ✅ |

### Check-in & kỷ luật

| # | Luật | TT |
|---|---|---|
| 2.12 | Check-in trong app (bấm nút + ảnh selfie) = nguồn sự thật, là 1 cổng của 2.4. Group Zalo giữ làm nghi thức văn hóa nếu muốn — không còn là dữ liệu vận hành | ✅ |
| 2.13 | Trễ check-in → mặc định không nhận lead. Muốn nhận → nút "Xin nhận lead hôm nay" + lý do → quản lý duyệt → vào danh sách (hiệu lực tới 18h) | ✅ |
| 2.14 | SLA duyệt đề xuất: quá X phút chưa duyệt → nhắc lần 2 / đẩy cấp trên (cấu hình qua Admin Setting) | ✅ |
| 2.15 | **Nghỉ phép được duyệt trước** = trạng thái riêng, không tính là trễ check-in. Báo cáo kỷ luật phân biệt rõ | ✅ |
| 2.16 | Check-in áp dụng cả **thứ 7**. **Chủ nhật** = cơ chế đăng ký tự nguyện như ca đêm (đăng ký cuối tuần) | ✅ |
| 2.17 | Lịch làm việc (ngày áp check-in, khung giờ...) = bảng config, không hardcode | ✅ |

### Ca đêm & giờ vàng

| # | Luật | TT |
|---|---|---|
| 2.18 | **Ca đêm 18h-6h**: sale tự đăng ký trước 18h trong app. Danh sách **tự xóa lúc 6h** — không ai phải reset tay (thay thế quy trình group Zalo + quản lý set 18h hiện tại) | ✅ |
| 2.19 | Lead đêm xoay vòng CHỈ trong danh sách trực, timeout nới (config, ~5 phút). Không ai nhận / danh sách rỗng → **hàng đợi chờ sáng**, giữ thứ tự | ✅ |
| 2.20 | **Giờ vàng 6h-8h30**: hàng đợi đêm bung từ 6h, xoay vòng những ai đã bật sẵn sàng sớm. 8h30 → vào vòng chung | ✅ |
| 2.21 | Lead đêm nhận **tin giữ ấm tự động** ("tư vấn viên liên hệ trước 8h sáng") qua Zalo/SMS | ✅ |
| 2.22 | Ranh giới: lead sinh trước 18h chạy hết vòng ngày, không ai nhận mới rơi sang đêm. Ranh giới 6h tương tự | ✅ |
| 2.23 | Đo từ ngày đầu: % lead đêm + chuyển đổi lead đêm vs ngày → quyết đầu tư trực chuyên trách bằng data | ✅ |

### Databank & điều phối thủ công

| # | Luật | TT |
|---|---|---|
| 2.24 | Databank: đồng hồ bảo mật theo trạng thái (config có hiệu lực theo thời gian) → hết hạn thì Person công khai ra kho 1 lần duy nhất, KHÔNG giật lead của sale gốc. Chi tiết → Luồng 5 | ✅ |
| 2.24b | Lead ở **Chưa Xác Định** 3h không tiến → chia thêm 1 sale chăm song song (trần = 1 lần chia thêm), không thu hồi, không cờ báo cho nhau. Chi tiết → Luồng 5 (luật 5.6-5.8) | ✅ |
| 2.25 | **Điều phối thủ công**: Quản lý chuyển KHTN cho sale chỉ định, dưới dạng databank. Sale mới KHÔNG thấy lịch sử sale cũ. Trạng thái **RESET — không kế thừa** | ✅ |
| 2.26 | CAPI bắn theo mốc cao nhất của **Person** → reset KHTN không gây tín hiệu lùi về Meta. Chi tiết → Luồng 7 | ✅ |
| 2.27 | **Sale rời cuộc chơi** (nghỉ việc/rút roster): KHTN đã đặt cọc → quản lý chỉ định 1 người chịu trách nhiệm chính (kèm share hỗ trợ nếu cần). KHTN chưa giao dịch → ra databank + ghi chú cũ thành **di sản** gắn Person, hiển thị cho người đang/sẽ chăm Person đó | ✅ |

---

## LỚP 3 — VÌ SAO

**Vì sao cá nhân thay team (2.1).** Mô hình cũ "2 người 1 team cùng nhận 1 khách" bị giới hạn — cứng nhắc khi cần người thứ 3, thừa khi 1 người đủ. Chuyển sang: sở hữu cá nhân + quyền mời hỗ trợ linh hoạt (Luồng 4). Sở hữu rõ thì trách nhiệm rõ; hợp tác là lựa chọn, không phải cấu trúc ép sẵn.

**Vì sao van chống ôm (2.8).** [Tư duy hệ thống] Không phạt ai cả — đây là backpressure: cấu trúc tự điều tiết để lead chảy về người còn sức chăm. Sale ôm 10 lead chưa chạm mà vẫn nhận thêm = lead chết hàng loạt; van đóng tạm cho đến khi họ xử lý bớt — hệ tự cân bằng, quản lý không phải canh.

**Vì sao "lead tính công" thay cơ chế đền bù (2.9).** Đền lead = thêm 1 cơ chế, thêm 1 loại tranh cãi ("lead này có đáng đền không"). Cách của Rich Land sạch hơn: Not Lead được duyệt = *chưa từng nhận* — vì có tương tác được đâu. Một định nghĩa, áp mọi chỉ số, kể cả van chống ôm (Sếp chỉ đúng: không trừ Not Lead khỏi mẫu số thì van bất công với người nhận trúng lead rác).

**Vì sao giám sát tỷ lệ Not Lead (2.10).** [Lý thuyết trò chơi] "Lead tính công" mở khe lách: báo Not Lead để xả van + đẹp mẫu số TTL1. Cửa duyệt MKT chặn phần lớn; chỉ số so-với-trung-bình bắt phần còn lại — ai lệch tự lòi. Bonus: tỷ lệ Not Lead theo *ad* = chính là signal `BAD` bắn về Meta — một dữ liệu hai công dụng.

**Vì sao reset không kế thừa khi điều phối thủ công (2.25).** Sếp chốt: sales đã được train tiếp cận kiểu databank; luật "chỉ thấy cái mình tạo" là tuyệt đối khi người cũ còn làm việc. Hệ quả kỹ thuật được xử ở 2.26: tín hiệu Meta đi theo Person nên không bị reset kéo lùi.

**Vì sao "di sản" khi sale nghỉ (2.27).** Luật riêng tư tồn tại để bảo vệ *công sức người đang làm việc* — không phải giấu dữ liệu vì dữ liệu. Người rời đi → không còn ai cần bảo vệ → ghi chú chuyển thành tài sản công ty, người chăm sau đỡ hỏi lại khách từ đầu. Nhất quán với 2.25: chuyển khi sale còn làm → vẫn giấu.

**Vì sao ca đêm tự đăng ký + giờ vàng (2.18-2.20).** Xóa đúng cái toil quản lý set group Zalo mỗi 18h. Giờ vàng tạo phần thưởng *tự nhiên* cho người dậy sớm: lead đêm là lead tươi nhất buổi sáng — ai sẵn sàng sớm được hưởng trước, không cần ép ai dậy. Pain point gốc (lead đêm nguội 6-8 tiếng) được giảm bằng tin giữ ấm tự động (2.21) — hệ thống không ngủ dù người ngủ.

**Vì sao check-in vào app (2.12).** Máy không đọc được ảnh trên group Zalo — check-in muốn tự động mở/đóng cổng nhận lead thì nguồn sự thật phải nằm trong hệ thống. Check-in đo *cam kết buổi sáng*; còn *sẵn sàng thật trong ngày* đo bằng log offer/timeout (2.11) — đặt 2 con số cạnh nhau là thấy ai check-in hình thức. Lưu ý từ Sếp: sale có thể nhận lead trong app nhưng người đi nơi khác — hệ thống chỉ cung cấp dữ liệu hành vi, giám sát thực địa vẫn là việc của quản lý.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | X của van chống ôm = bao nhiêu KHTN "Chưa Xác Định"? | Con số khởi điểm để config — đề xuất lấy từ data thực (phân vị 80 hiện tại) |
| M2 | Timeout đêm chính xác (5 phút?) + có giới hạn số vòng xoay ban đêm không | Config |
| M3 | SLA duyệt đề xuất (2.14) — bao nhiêu phút thì nhắc/đẩy cấp? | ✅ Đã cấu hình động qua Admin Setting |
| M4 | Có cần hạn mức lead/ngày/sale riêng không, hay van chống ôm đã đủ? | Nghiêng về: van đủ, thêm hạn mức = thừa cơ chế |
| M5 | Chủ nhật "đăng ký cuối tuần": khung giờ + timeout giống ngày thường hay giống đêm? | Config lịch (2.17) |
