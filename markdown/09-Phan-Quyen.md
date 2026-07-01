# PHÂN QUYỀN — VAI × ĐỐI TƯỢNG × HÀNH ĐỘNG

> Trạng thái: 🟡 BẢN NHÁP 06/06/2026 — khung 3 nhóm Sếp đã cho, chờ chốt 2 điểm (xem Lớp 4)
> Tài liệu ngang — áp cho cả 7 luồng. Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md`

---

## LỚP 1 — KHUNG 3 NHÓM CHỨC NĂNG (Sếp chốt 06/06)

| Nhóm | Sứ mệnh | Vai bên trong |
|---|---|---|
| **Marketing** | Cung ứng khách hàng | Ads + Content · IT Hệ thống · Quản trị |
| **Phòng Kinh Doanh** | Cung ứng chuyển đổi | GĐKD · GĐKD Dự Án · Sales |
| **Cung Ứng Sản Phẩm** | Cung ứng hàng + thủ tục | Admin dự án |

Kế toán: ngoài hệ thống — chỉ nhận đầu ra "căn đủ điều kiện tính phí" (luật 6.14).

**Nguyên tắc gốc xuyên suốt (đã chốt từ các luồng):**
1. Sale chỉ nhìn thấy những gì mình được nhận và tạo ra — tuyệt đối, không ngoại lệ sống (ngoại lệ duy nhất: di sản của sale đã nghỉ — luật 2.27).
2. MKT làm chủ toàn bộ trước phễu.
3. Phân quyền đặt ở tầng dữ liệu (Row-Level Security), không nhân bản bảng theo vai như AppSheet cũ.
4. Tách 3 tầng quyền: **THẤY** (read) · **CAN THIỆP NGHIỆP VỤ** (config kinh doanh, duyệt, điều phối) · **CAN THIỆP HỆ THỐNG** (schema, tích hợp, quyền gốc) — đề xuất: tầng hệ thống CHỈ IT (🟡 chờ Sếp).

---

## LỚP 2 — MA TRẬN NHÁP (góc nhìn theo lời Sếp + luật đã chốt từ 7 luồng)

Ký hiệu: 👁 thấy · ✏️ tạo/sửa · ✅ duyệt · ⚙️ config · — không

| Đối tượng | Sales | GĐKD / GĐKD DA | Ads + Content | Admin dự án | Quản trị (Sếp) | IT |
|---|---|---|---|---|---|---|
| Lead (trước phễu) | — | 👁 | 👁 ✏️ (nhập kênh cty, nhập bù) | — | 👁 | 👁 ⚙️ |
| KHTN của mình + ghi chú | 👁 ✏️ | 👁 (team/dự án mình) | 👁 (đọc — phục vụ phân tích) | — | 👁 | 👁 |
| KHTN của sale khác | — (kể cả khi ra kho) | 👁 | 👁 | — | 👁 | 👁 |
| Nhiệt / tag vướng | ✏️ (của mình) | 👁 | 👁 | — | 👁 | 👁 |
| Kho databank | 👁 theo quyền kho (SĐT/dự án ẩn-hiện) | 👁 + điều phối thủ công | 👁 | — | 👁 ⚙️ (đóng/mở, hạn mức) | ⚙️ |
| Roster chiến dịch | 👁 (mình thuộc đâu) | ⚙️ (GĐKD DA quản) | 👁 | — | 👁 ⚙️ | ⚙️ |
| Phiếu cọc | ✏️ (tạo, bước 1+3) | 👁 | 👁 | ✅ (xác nhận, bước 2+4) | 👁 | 👁 |
| Phiếu hợp tác | ✏️ (owner điền) + ✍️ ký | ✅ (GĐKD duyệt) | 👁 | 👁 | 👁 | 👁 |
| Hành trình KH–CĐT + đối chiếu phí | 👁 (căn của mình) + nộp UNC | 👁 | 👁 (tỉ lệ, doanh thu) | ✏️ ⚙️ (toàn quyền sau booking/cọc) | 👁 | 👁 |
| Danh mục sản phẩm (giỏ hàng) | 👁 (để chọn) | 👁 | 👁 | ✏️ ⚙️ | 👁 | ⚙️ |
| Config chiến dịch (decay, bảo mật kho, lịch TT, HĐ môi giới, nhiệt khởi điểm...) | — | ⚙️ (phạm vi dự án mình) | 👁 | ⚙️ (phần thanh toán/giỏ hàng) | ⚙️ | ⚙️ |
| Chi phí ads, CAC/ROAS, doanh thu ghi nhận | — | 👁 | 👁 | — | 👁 | 👁 |
| Duyệt Not Lead | đề xuất | 👁 | ✅ | — | 👁 | 👁 |
| Audit log | — | 👁 | 👁 | — | 👁 | 👁 ⚙️ |
| Tích hợp (CAPI, connector), schema, quyền gốc | — | — | — | — | 🟡 (đề xuất: không) | ⚙️ |

---

## LỚP 3 — VÌ SAO

**Vì sao phân theo nhóm chức năng thay vì chức danh.** Đúng nguyên tắc Sếp đã đặt trong hệ thống công ty: thiết kế theo vai chuẩn, người đeo mũ. 1 người wear nhiều mũ (Sếp = Quản trị + Ads) thì gán nhiều vai — quyền là hợp của các vai.

**Vì sao Ads+Content "gần như thấy hết" nhưng không sửa nghiệp vụ sale.** Họ cần đọc toàn bộ phễu + lịch sử chăm sóc để làm việc cung ứng (đánh giá chất lượng lead, content nào ra khách tốt) — nhưng không có lý do nghiệp vụ nào để sửa KHTN của sale. Đọc rộng, viết hẹp.

**Vì sao đề xuất tách Quản trị khỏi quyền hệ thống (điểm 🟡 lớn nhất).** Quyền hệ thống trong tay người không làm kỹ thuật = rủi ro tai nạn (sửa nhầm config tích hợp → CAPI đứt thầm lặng); và khi sự cố, audit phân định trách nhiệm theo "ai có thể đã đụng" — vòng đó càng hẹp càng tốt. Quản trị giữ trọn: thấy hết + mọi núm vặn kinh doanh + điều phối/duyệt. IT giữ: tua vít phòng máy.

**Vì sao Admin dự án không thấy phễu trước booking.** Đúng góc Sếp cho: nhóm Cung Ứng Sản Phẩm vào việc từ lúc có giao dịch. Trước đó là sân của MKT + PKD — thấy thêm không giúp gì, chỉ tăng diện lộ dữ liệu.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi | Ghi chú |
|---|---|---|
| M1 | **Tách Quản trị khỏi quyền hệ thống** (chỉ IT đụng schema/tích hợp/quyền gốc) — Sếp duyệt không? | Đề xuất của Claude, chờ chốt |
| M2 | **Kênh thông báo chính**: trong app + đẩy Zalo cho loại khẩn, hay tất cả trong app? | Đầu vào cho tài liệu Trung tâm thông báo |
| M3 | GĐKD vs GĐKD Dự Án: khác nhau đúng 1 chữ "phạm vi" (toàn sàn vs dự án mình phụ trách)? | Xác nhận để ma trận chia 2 cột |
| M4 | Giám Đốc Sàn (có trong BRD cũ) — còn vai này không hay gộp vào GĐKD? | Dọn vai cũ |
| M5 | Ads+Content thấy SĐT khách đầy đủ hay che? (đọc phân tích thì không cần số) | Bảo vệ data — đề xuất: che |
