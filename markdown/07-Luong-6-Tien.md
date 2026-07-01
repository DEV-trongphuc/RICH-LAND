# LUỒNG 6 — TIỀN (CỌC → DOANH THU → PHÍ MÔI GIỚI)

> Trạng thái: ✅ Đã review cùng Sếp 06/06/2026
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md` + Luồng 4 (phiếu hợp tác)

---

## LỚP 1 — ẢNH CHỤP NHANH

4 dòng chảy lồng nhau — mỗi dòng một cặp chủ thể, một nhịp thời gian:

```
[A] KH ↔ CÔNG TY (nhịp giờ/ngày)
    Sale tạo phiếu cọc (+UNC) → Admin xác nhận → phiếu 2 (CCCD/VNeID) → Admin chốt
    └─ Trạng thái ĐẶT CỌC bật ngay bước 1 → bắn CAPI Purchase

[B] KH ↔ CĐT (nhịp tháng/năm — có thể 1-2 năm)
    Hoàn tất cọc → Thỏa Thuận Cọc (ký) → các đợt thanh toán → Ký HĐMB
    └─ theo Quy Trình Thanh Toán config riêng TỪNG dự án
    └─ sale theo sát, thu UNC từng đợt gửi admin
    └─ deal của công ty KẾT THÚC tại mốc ký HĐMB

[C] CĐT ↔ CÔNG TY (nhịp theo mốc Đủ Điều Kiện Tính Phí)
    Mốc ĐĐK (theo HĐ môi giới: % phí, số đợt, mức/đợt — config từng dự án)
    → đối chiếu phí: Đủ Điều Kiện → Đã Gửi Hồ Sơ → Tiền Đã Về

[D] CÔNG TY ↔ SALE (nội bộ)
    Tiền về theo đợt → trả hoa hồng theo tỉ lệ phiếu hợp tác (Luồng 4)
```

- **Vai tham gia:** Sale (tạo phiếu, thu UNC, theo KH tới HĐMB) · Admin (xác nhận phiếu, làm việc CĐT, đối chiếu phí) · GĐKD (duyệt phiếu hợp tác) · Kế toán (nhận đầu ra "căn đủ điều kiện", theo dõi dòng tiền ở hệ riêng — NGOÀI scope CRM).
- **Đường đi:** cọc → hành trình thanh toán KH-CĐT → mốc đủ điều kiện → đối chiếu → tiền về → chia theo phiếu.
- **Đích cuối:** mỗi sáng nhìn được **doanh thu ghi nhận** theo chiến dịch (căn cọc × phí dự kiến) + pipeline phí đang nằm ở trạng thái nào — không căn nào "rơi tự do" giữa các mốc suốt 1-2 năm.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### [A] Phiếu cọc — Sale ↔ Admin

| # | Luật | TT |
|---|---|---|
| 6.1 | Quy trình 4 bước: (1) Sale tạo phiếu cọc: dự án, mã căn, giá gốc, phương thức thanh toán, ảnh UNC → gửi · (2) Admin xác nhận, tạo phiếu 2 · (3) Sale nhập họ tên KH + CCCD 2 mặt + VNeID → submit · (4) Admin tiếp nhận, chuyển giai đoạn CĐT | ✅ |
| 6.2 | Trạng thái **Đặt Cọc bật NGAY bước 1** — đủ điều kiện bắn CAPI `Purchase` (value = tiền cọc). Phiếu hợp tác (Luồng 4) cũng sinh tại bước 1. Xác nhận của admin là lớp kiểm soát sau, không chặn ghi nhận | ✅ |

### [B] Hành trình KH ↔ CĐT

| # | Luật | TT |
|---|---|---|
| 6.3 | Mỗi dự án nạp **Quy Trình Thanh Toán** (bảng config): chuỗi mốc Hoàn tất cọc → Thỏa Thuận Cọc → đợt 1..n → Ký HĐMB. Hai mốc ký gốc: TTC + HĐMB; đợt nhỏ ở giữa chỉ thanh toán, không ký | ✅ |
| 6.4 | Sale theo sát KH tới khi **ký xong HĐMB**. Mỗi lần KH thanh toán → sale thu **UNC** gửi admin → admin xác nhận → mốc được ghi nhận. UNC = nguồn sự thật của mọi mốc | ✅ |
| 6.5 | Hệ thống nhắc việc theo lịch thanh toán dự án: sắp tới đợt của căn nào → nhắc sale + admin | ✅ |
| 6.6 | **Đổi căn**: chỉ được khi đã cọc nhưng CHƯA ký Thỏa Thuận Cọc (cọc căn A → đổi căn B). Sau ký TTC → không đổi căn | ✅ |
| 6.7 | **Bể cọc**: xảy ra trong đoạn Đặt Cọc → Thỏa Thuận Cọc; ảnh hưởng mốc phí theo điều kiện HĐ môi giới. Sau khi ký HĐMB mà KH bể → chuyện KH ↔ CĐT, công ty hết phần theo sát: **deal của công ty đóng tại mốc HĐMB** | ✅ |

### [C] Phí môi giới & đối chiếu

| # | Luật | TT |
|---|---|---|
| 6.8 | **Hợp đồng môi giới** per dự án = bảng config: % phí, trả mấy đợt, mức từng đợt, mỗi đợt gắn mốc **Đủ Điều Kiện Tính Phí** nào (vd: xong TTC → 50%, xong HĐMB → phần còn lại) | ✅ |
| 6.9 | Pipeline đối chiếu per căn per đợt — đúng **3 trạng thái**: **Đủ Điều Kiện** (admin lưu ý — CĐT báo trả phí thì đối chiếu xem căn có trong đợt không) → **Đã Gửi Hồ Sơ** (hoàn tất đối chiếu, chờ tiền) → **Tiền Đã Về** (một phần hoặc toàn bộ). Không micro-track từng email | ✅ |
| 6.10 | Nghiệp vụ đối chiếu (bảng kê → mail CĐT → bộ hồ sơ: hóa đơn + đề nghị thanh toán + bảng kê → chờ chuyển khoản) là việc của Admin ngoài hệ thống — CRM chỉ giữ 3 trạng thái trên | ✅ |

### [D] Nội bộ & ranh giới kế toán

| # | Luật | TT |
|---|---|---|
| 6.11 | Hoa hồng nội bộ trả **theo đợt**: tiền CĐT về bao nhiêu → trả theo tỉ lệ phiếu hợp tác bấy nhiêu. 100% phí của căn chỉ trọn vẹn khi hoàn tất HĐMB | ✅ |
| 6.12 | Chi tiết quy trình chi trả hoa hồng = **nghiệp vụ kế toán, mục riêng — GÁC LẠI chưa bàn** (kế toán đã có hệ thống riêng) | ✅ |
| 6.13 | **Doanh thu trên dashboard = DOANH THU GHI NHẬN** (căn cọc thành công × phí dự kiến theo HĐ môi giới). Dòng tiền thực = hệ kế toán theo dõi riêng | ✅ |
| 6.14 | **Ranh giới CRM ↔ kế toán**: CRM xuất đúng 1 đầu ra — "căn nào đủ điều kiện tính phí (+ đợt nào)". Không ôm hạch toán, không ôm dòng tiền | ✅ |

### Danh mục sản phẩm (giỏ hàng) — bổ sung 06/06

| # | Luật | TT |
|---|---|---|
| 6.18 | Module **Danh mục sản phẩm** per dự án: giỏ hàng + mã căn + giá + CSBH + các PTTT + lịch thanh toán. Phiếu cọc của sale chọn từ danh mục này (mapping tự động, không gõ tay) | ✅ |
| 6.19 | Danh mục **sống**: căn đã bán tự ẩn khỏi lựa chọn, nhập thêm sản phẩm bất kỳ lúc nào. Ai nhập/sửa: Nhóm Cung Ứng Sản Phẩm (Admin dự án) | ✅ |
| 6.20 | **Ca cọc nhanh — căn chưa kịp nhập giỏ**: phiếu cọc cho phép nhập mã căn tự do + tự flag "chưa có trong danh mục" → Admin dự án bổ sung và nối lại sau. KHÔNG chặn sale lúc khách xuống tiền | ✅ |

### Bể cọc (chốt 06/06)

| # | Luật | TT |
|---|---|---|
| 6.15 | **Bể cọc** (đoạn Đặt Cọc → TTC) → KHTN **tụt 1 mức, không áp điều kiện bằng chứng khi tụt**: từng có Booking → về Booking; dự án không có hoạt động booking → về Đã Gặp. Về trạng thái nào → áp rule của trạng thái đó (đồng hồ bảo mật chạy lại → có thể ra kho lại theo Luồng 5) | ✅ |
| 6.16 | **Ngoại lệ**: deal đã phát sinh doanh thu cho công ty (tiền phí về ≥1 đợt — vd KH thanh toán đợt 1 nhưng không tới HĐMB) → **giữ nguyên trạng thái Đặt Cọc**. Định nghĩa gốc: *có doanh thu = là Khách; bể mà chưa có doanh thu = chưa là Khách* | ✅ |
| 6.17 | CAPI: **bắn rồi thì thôi** — không bắn lùi, không bắn lại khi tụt trạng thái. Chi tiết → Luồng 7 | ✅ |

---

## LỚP 3 — VÌ SAO

**Vì sao Đặt Cọc bật ngay bước 1 (6.2).** Nhất quán với luật 4.13: tiền thật về (UNC) thì thực tế kinh doanh được ghi nhận ngay — báo cáo đúng nhịp, CAPI `Purchase` không trễ (tín hiệu giá trị nhất cho Meta học). Admin xác nhận là lớp kiểm soát chất lượng *sau*, không phải cổng chặn *trước* — nguyên tắc xuyên suốt: không để thủ tục nội bộ làm méo bức tranh kinh doanh.

**Vì sao deal đóng tại HĐMB (6.7).** Ranh giới trách nhiệm: sau HĐMB, quan hệ là KH ↔ CĐT — công ty không kiểm soát được. [Tư duy hệ thống] Hệ thống chỉ nên theo dõi cái nó có khả năng tác động; theo cái ngoài tầm = data mãi không cập nhật = tủ kính trưng bày số liệu chết.

**Vì sao UNC là nguồn sự thật (6.4).** Công ty không nhìn thấy dòng tiền KH → CĐT. UNC là bằng chứng khả thi duy nhất, và sale là người gần KH nhất để thu nó — admin xác nhận tạo kiểm soát 2 lớp (sale nộp, admin duyệt), cùng pattern 4 mắt đã dùng toàn hệ thống.

**Vì sao chỉ 3 trạng thái đối chiếu (6.9).** Cám dỗ là số hóa cả chuỗi email qua lại với CĐT — nhưng admin chỉ cần trả lời 3 câu để hành động: căn nào *cần để ý*, căn nào *đang chờ tiền*, căn nào *xong*. Số hóa đúng điểm ra quyết định, không số hóa nghi thức.

**Vì sao tách doanh thu ghi nhận / dòng tiền thực (6.13-6.14).** Hai câu hỏi khác nhau: "kinh doanh có khỏe không?" (doanh thu ghi nhận — nhịp chiến dịch, nằm ở CRM, KR 70-83 tỷ đếm theo đây) và "túi có tiền không?" (dòng tiền — nhịp kế toán, hệ riêng đang chạy). Gộp 2 cái = CRM phải ôm nghiệp vụ kế toán phức tạp mà không giỏi hơn hệ sẵn có. Nối nhau bằng 1 đầu ra sạch (6.14) — mỗi hệ làm giỏi việc của nó.

**Vì sao 2 bảng config mới (6.3 + 6.8).** Quy Trình Thanh Toán và Hợp Đồng Môi Giới khác nhau từng dự án, đổi theo từng lần đàm phán — đúng tiêu chí "thứ hay đổi thì phải là config, không phải code". Cùng họ với config bảo mật kho (5.2) và lịch làm việc (2.17).

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | Admin **từ chối phiếu cọc** (sai mã căn, UNC mờ...) → quy trình sửa thế nào, trạng thái Đặt Cọc có tụt không? Đề xuất: giữ trạng thái, phiếu quay lại sale sửa; chỉ tụt khi xác định không có cọc thật | Chờ chốt |
| ~~M2~~ | ~~Bể cọc~~ → ✅ đã chốt thành luật 6.15-6.17 | Đóng 06/06 |
| M3 | **Đổi căn** (trước TTC): tạo deal mới gắn lịch sử hay sửa deal cũ? Đề xuất: deal mới + link "đổi từ căn A" — giữ audit và lịch sử phí | Chờ chốt |
| M4 | Chi tiết chi trả hoa hồng nội bộ (kỳ trả, tạm ứng, thuế TNCN...) | GÁC — mục riêng với kế toán |
| M5 | Nhắc việc lịch thanh toán (6.5): nhắc trước bao nhiêu ngày, ai nhận | Config |
