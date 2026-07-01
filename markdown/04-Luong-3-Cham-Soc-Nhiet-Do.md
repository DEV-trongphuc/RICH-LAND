# LUỒNG 3 — CHĂM SÓC & NHIỆT ĐỘ KHÁCH

> Trạng thái: ✅ Đã review cùng Sếp 06/06/2026
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md` + sổ tay `BEP-DUN-NUOC-RL-so-tay-v2.md` (hệ thống Richland-AI)
> Đây là lần đầu framework Bếp Đun Nước được số hóa.

---

## LỚP 1 — ẢNH CHỤP NHANH

```
Sale nhận KHTN (từ Luồng 2)
   ↓
GHI CHÚ CẤU TRÚC mỗi lần tương tác: kênh (Nồi) + loại + thời lượng + phản hồi KH
   ↓
Máy ĐỀ XUẤT NHIỆT (công thức sổ tay) → sale CHỐT nhiệt → tag "vướng lớp nào" (1 chạm, tự nguyện)
   ↓                                                          ↓
DECAY: 5 ngày không tương tác chất lượng → rớt 1 mức      TOA TĨNH: gợi ý nguyên liệu đúng sổ tay
   ↓
CẢNH BÁO NGUỘI + DANH SÁCH ĐỎ mỗi sáng (Trạng thái cao + Nhiệt tụt xếp trước)
   ↓
Chuyển TRẠNG THÁI khi đủ bằng chứng (ảnh, UNC...) → state_history → (Luồng 7 bắn CAPI)
```

- **Vai tham gia:** Sale (ghi chú, chốt nhiệt, tag vướng) · Hệ thống (đề xuất nhiệt, decay, cảnh báo, toa tĩnh) · Quản lý (danh sách đỏ, duyệt trạng thái cần duyệt) · MKT (đọc phân bố vướng cấp chiến dịch).
- **Đường đi:** Mỗi tương tác → 1 ghi chú cấu trúc → nhiệt cập nhật → cảnh báo khi nguội → trạng thái tiến khi có bằng chứng thật.
- **Đích cuối:** Mỗi KHTN luôn có nhiệt + lý do vướng còn "tươi"; sale luôn biết việc tiếp theo; quản lý & MKT nhìn thấy bệnh của cả chiến dịch chứ không chỉ từng người.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### Ghi chú & nhiệt

| # | Luật | TT |
|---|---|---|
| 3.1 | Ghi chú chăm sóc **có cấu trúc**: kênh (Nồi Đất=text / Nồi Đồng=call / Nồi Áp Suất=gặp mặt), loại tương tác (thường / chất lượng), thời lượng call, nội dung, phản hồi KH, ô tự do "tài liệu đã gửi" (không bắt buộc) | ✅ |
| 3.2 | Nhiệt 4 mức **Lạnh / Ấm / Nóng / Sôi** — thuộc KHTN, tính theo từng dự án. Person KHÔNG có nhiệt chung | ✅ |
| 3.3 | Nhiệt **hybrid**: máy đề xuất từ log tương tác theo công thức sổ tay (Lạnh = 1 tương tác · Ấm = 3 tương tác + 1 call >5 phút · Nóng = video call/gặp mặt/coi thực tế · Sôi = xuống tiền) → sale là người chốt. Lưu CẢ HAI giá trị: máy đoán + sale chốt | ✅ |
| 3.4 | Quy tắc "nghi ngờ → đo thấp hơn 1 mức" hiển thị ngay trên nút chọn nhiệt | ✅ |
| 3.5 | **Nhiệt khởi điểm theo nguồn** (bảng config): giới thiệu = Ấm sẵn · R3_Fb, R2 = Lạnh · ... | ✅ |
| 3.6 | **Decay**: X ngày không có tương tác chất lượng → nhiệt tự rớt 1 mức + cảnh báo Nguội. X config theo chiến dịch, **mặc định 5 ngày** | ✅ |

### Tag vướng & toa

| # | Luật | TT |
|---|---|---|
| 3.7 | Tag **"Khách đang vướng ở đâu?"** sau mỗi ghi chú: 🧑 chưa tin mình / 🏙️ chưa ưng dự án / 🏠 chưa chọn được căn / ✓ đang xuôi. **1 chạm, KHÔNG bắt buộc** | ✅ |
| 3.8 | **Toa tĩnh** theo tag (text lấy từ sổ tay, không cần AI): vướng sales → Phòng Bếp · vướng dự án → Nước Sôi + Than so sánh · vướng căn → Than chốt cá nhân hóa + Oxy | ✅ |
| 3.9 | Đo adoption tag sau 1 tháng — mục tiêu >60% ghi chú có tag | ✅ |
| 3.10 | Dashboard quản lý/MKT: **phân bố tag vướng theo chiến dịch** (cấp tệp, không chỉ cá nhân) — phát hiện bệnh thông điệp vs bệnh kỹ năng | ✅ |

### Form TTL1 & trạng thái

| # | Luật | TT |
|---|---|---|
| 3.11 | **Form TTL1 5 nhóm** = form cấu trúc riêng, không chôn vào text ghi chú | ✅ |
| 3.12 | Gate sổ tay số hóa: form thiếu ≥2 nhóm → cảnh báo "chưa nên chuyển giai đoạn pha Than" | ✅ |
| 3.13 | Chuyển trạng thái giữ **điều kiện bằng chứng** như BRD (ảnh đồng ý gặp, check-in nơi gặp, UNC...). Bằng chứng gắn vào **sự kiện chuyển trạng thái** (bảng state_history + attachments), không phải cột trong bảng KHTN | ✅ |
| 3.14 | **Danh sách đỏ** mỗi sáng cho sale + quản lý: KHTN xếp theo (Trạng thái cao × Nhiệt tụt) trước tiên | ✅ |
| 3.15 | Thư viện nguyên liệu chuẩn hóa (Nước Sôi/Than/Oxy theo dự án) → **Phase 2+**. Phase 1 chỉ có ô tự do 3.1 — nguyên liệu đang thử nghiệm linh động từng dự án, chưa chuẩn hóa được | ✅ |

---

## LỚP 3 — VÌ SAO

**Vì sao Bếp Đun Nước số hóa được.** Sổ tay v2 đã định nghĩa nhiệt **bằng số đếm được** (3 tương tác + 1 call >5 phút...) thay vì cảm giác. Máy chỉ số hóa được thứ đếm được — phần khó nhất framework đã tự làm xong. Việc của CRM chỉ là: bắt tương tác có cấu trúc (3.1) rồi áp công thức.

**Vì sao nhiệt thuộc KHTN, không thuộc Person (3.2).** Sổ tay ghi rõ: 1 KH có thể Nóng với Orchard nhưng Lạnh với TGC, không kéo nhiệt cũ sang dự án mới. Khớp 100% mô hình Person × Campaign = KHTN — thêm bằng chứng mô hình 3 thực thể đúng.

**Vì sao hybrid máy-đề-xuất + sale-chốt (3.3).** Máy thuần → sai ngữ cảnh (10 thả tim < 1 cuộc gọi 5 phút, nhưng máy non dễ đếm nhầm chiều ngược). Sale thuần → lười cập nhật + lạc quan tếu (sổ tay cảnh báo: sales hay đánh nhiệt CAO hơn thực tế). Hybrid lấy cái hay của cả hai. Lưu cả 2 giá trị vì: lệch nhiều = tín hiệu coaching, và là data để máy học dần — sau này tầng AI có nguyên liệu.

**Vì sao decay (3.6).** [Tư duy hệ thống] Nước nguội tự nhiên khi ngừng đun — nhiệt không tự rớt thì database đầy khách "Nóng" từ 3 tháng trước, cảnh báo mất ý nghĩa. Decay làm nhiệt phản ánh đúng vật lý cảm xúc, và cảnh báo Nguội chính là quy trình "cứu Nguội" của sổ tay được tự động hóa. 5 ngày là trung bình Sếp chốt; chiến dịch nước rút config ngắn hơn.

**Vì sao tag tự nguyện, không bắt buộc (3.7).** Bắt buộc → sale chọn bừa cho xong → data rác mà nhìn như data sạch (tệ hơn không có). Tự nguyện + lợi ích tức thì (bấm tag được toa ngay — app "hiểu nghề") → ai dùng là dùng thật. Đo adoption (3.9) để biết thiết kế có thắng không thay vì đoán.

**Vì sao tag 1 chạm thay vì bắt ghi đủ 3 lớp cảm xúc.** Sổ tay có 3 lớp (với sales / dự án / căn) — đúng về lý thuyết nhưng bắt ghi đủ mỗi lần là nặng tay, sale sẽ bỏ. Tag 1 chạm = phiên bản tối giản đủ dùng cho: toa tĩnh, cảnh báo, insight chiến dịch (3.10), và AI sau này. Ví dụ giá trị cấp chiến dịch: 45% KHTN Ấm của OC vướng "chưa ưng dự án" → bệnh nằm ở thông điệp/giá, không phải kỹ năng sale → việc của MKT. Hiện skill phân tích KHTN phải đào text tự do hàng giờ mới ra kết luận này — có tag thì 1 query.

**Vì sao form TTL1 tách riêng (3.11).** Audit DB xác nhận: form phản hồi lần 1 đang bị chôn dạng văn bản trong ghi chú (`chan_dung` nhét cả bài) → không phân tích được, không gate được. Form cấu trúc + gate (3.12) số hóa đúng quy tắc cứng của sổ tay: "thiếu ≥2 nhóm → không sang B2, phân tích trên data thiếu = đoán mò".

**Vì sao KHÔNG số hóa thư viện nguyên liệu ở Phase 1 (3.15).** Sếp chốt: nguyên liệu đang linh động từng dự án, đang thử nghiệm, biến số nhiều. [Tư duy hệ thống] Số hóa một quy trình chưa chín = đóng băng cuộc thử nghiệm. Giữ ô tự do "tài liệu đã gửi" để data thô tích lũy — khi nguyên liệu chuẩn hóa xong (6 tháng+) đã có sẵn lịch sử để phân tích. Trồng cây trước, hái quả sau.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | Ai được config ngưỡng decay theo chiến dịch — MKT hay GĐKD Dự Án? | Quyền config |
| M2 | Công thức máy đề xuất mức **Nóng** cần sự kiện "đã gặp/coi thực tế" — lấy từ trạng thái (Đã Gặp) hay từ ghi chú kênh Nồi Áp Suất? Cần định nghĩa mapping chính xác | Kỹ thuật, dev cần rule cụ thể |
| M3 | Cảnh báo Nguội: sale thấy ngay — quản lý thấy sau bao lâu (ngay / sau 2 ngày sale không xử lý)? | Tránh quản lý ngợp cảnh báo |
| M4 | Trạng thái "Thiện chí" mới (BRD đề xuất, chưa có trong DB) — chèn vào state machine ở đâu, điều kiện gì, ảnh hưởng công thức nhiệt không? | Cần chốt với bạn hệ thống |
| M5 | Tin giữ ấm tự động + toa tĩnh: nội dung do MKT soạn theo chiến dịch — quy trình cập nhật nội dung này nằm đâu? | Vận hành nội dung |
