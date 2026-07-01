# LUỒNG 1 — LEAD VÀO

> Trạng thái: ✅ Đã review cùng Sếp 06/06/2026
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md`

---

## LỚP 1 — ẢNH CHỤP NHANH

**Sơ đồ:** 5 nguồn → 1 cửa tiếp nhận duy nhất → tạo Lead (bản ghi gốc) → nối vào Person (theo SĐT) → bàn giao Luồng 2.

```
Meta form (tự động 90%) ─┐
Google LP (tự động)      ─┤
Web quét số (tự động)    ─┼─→ CỬA TIẾP NHẬN ─→ tạo LEAD ─→ nối PERSON ─→ Luồng 2
Messenger/Zalo (tay-MKT) ─┤      (gắn nguồn,      (gốc,      (theo SĐT,
Sale tự nhập (tay)       ─┘    campaign, dự án)  chỉ thêm)  1 người 1 hồ sơ)
```

- **Vai tham gia:** Connector tự động (chỉ hệ thống ghi) · MKT (nhập kênh công ty + nhập bù) · Sale (chỉ nhập khách cá nhân của mình) · Máy đối soát (job tự động).
- **Đường đi:** Mọi nguồn — không có ngoại lệ — đi qua đúng 1 cửa tiếp nhận. Không nguồn nào đổ thẳng vào CRM.
- **Đích cuối:** Trong vài giây, mọi lead thành 1 Lead có nguồn + attribution đầy đủ, nối đúng 1 Person, sẵn sàng cho Luồng 2. Và **không lead nào mất mà không ai biết**.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

| # | Luật | TT |
|---|---|---|
| 1.1 | Mọi nguồn lead đi qua 1 cửa tiếp nhận duy nhất. Cấm đường tắt đổ thẳng vào CRM | ✅ |
| 1.2 | Cửa tiếp nhận gắn cho mỗi lead: nguồn, campaign, dự án, thông tin ad (ad_id...) trước khi lưu | ✅ |
| 1.3 | Lead = bản ghi gốc, chỉ thêm không sửa (immutable). Mọi thay đổi về sau nằm ở Person/KHTN | ✅ |
| 1.4 | Sau khi tạo Lead → nối vào Person theo SĐT. Trùng SĐT → không tạo Person mới, chỉ nối thêm | ✅ |
| 1.5 | FB: mỗi lần đăng ký = 1 Lead mới (dù trùng số). Google: cùng SĐT + cùng dự án trong ngày = 1 Lead, ghi nhận thêm form đã điền | ✅ |
| 1.6 | **Nhập bù** (lead MKT bị hệ thống sót): chỉ MKT + Quản lý có quyền. Phải gắn đúng campaign/dự án. Đi qua Luồng 2 chia như lead thường | ✅ |
| 1.7 | **Khách cá nhân**: chỉ sale nhập, là nguồn riêng của sale. KHÔNG qua chia lead — sale tự own. Không tính TTL1 | ✅ |
| 1.8 | Lead Messenger + Zalo OA: **MKT nhập hết** (kênh công ty do MKT quản). Sale không đụng | ✅ |
| 1.9 | Nhập tay (khách cá nhân) trùng SĐT với lead MKT đang active trong X ngày → **cho nhập nhưng flag cho Quản lý + MKT**, không chặn | ✅ |
| 1.10 | **Máy đối soát**: job mỗi sáng so số leadform Meta/Google API báo vs số Lead trong CRM hôm trước. Lệch → cảnh báo + danh sách thiếu | ✅ |
| 1.11 | Broadcast: KH cũ phản hồi → tạo Lead nguồn `broadcast` + gắn campaign mới + broadcast_id → qua cửa → nối Person cũ → sinh KHTN mới | ✅ |
| 1.12 | Bảng đợt broadcast lưu: tệp đã chọn (rule), thông điệp, kênh, **danh sách đã gửi** (để đo response rate). Tool bắn ngoài nhưng danh sách phải đổ về CRM | ✅ |
| 1.13 | Loại trừ khỏi tệp broadcast: Not Lead vĩnh viễn · người đã opt-out · KH đang có KHTN active ở campaign khác | 🟡 |
| 1.14 | **Giới thiệu kế thừa dòng nguồn**: A gốc MKT giới thiệu B → B = `gioi_thieu` (dòng MKT). A là khách cá nhân → B = `ca_nhan`. Lead `gioi_thieu` bắt buộc ghi người giới thiệu (trỏ Person của A) → attribution trace về campaign gốc của A | ✅ |
| 1.15 | Khách được giới thiệu (B): sale tự nhập (giống khách cá nhân + trường "người giới thiệu" chọn Person gốc). Về thẳng sale đó, không qua xoay vòng | ✅ |
| 1.16 | Nguồn `ca_nhan` + `gioi_thieu`: KHÔNG áp cơ chế databank — mặc định của sale đó vĩnh viễn | ✅ |
| 1.17 | Khách cá nhân / giới thiệu: **nhập bất kỳ lúc nào** — kể cả mới gặp ngoài, để sale dùng CRM làm sổ ghi nhớ cá nhân (góp ý dev 06/06: phục vụ sale → tăng adoption + công ty thấy pipeline ẩn). Mốc giao dịch chỉ là yêu cầu tối thiểu: trước khi tạo phiếu cọc, khách phải có trong hệ. Hệ thống vẫn cho phép tạo KHTN trạng thái khởi tạo cao (nhập muộn nhảy thẳng Booking/Đặt Cọc). Lưới chống rửa nguồn 1.9 áp dụng mọi thời điểm nhập | ✅ |

---

## LỚP 3 — VÌ SAO

**Vì sao 1 cửa duy nhất (1.1).** Mỗi nguồn đổ thẳng = mỗi nơi một định dạng, một cách gắn attribution → số liệu không bao giờ khớp. Một cửa = một chỗ duy nhất chuẩn hóa, gắn nguồn, dedup. Sau này cắm connector mới (Messenger tự động...) chỉ là thêm 1 đường vào cửa, không đụng schema.

**Vì sao tách "nhập bù" và "khách cá nhân" (1.6 vs 1.7).** Đây là 2 chức năng khác nhau bị gộp tên "nhập thủ công". Nhập bù = lead MKT hệ thống sót → phải gắn campaign để attribution không thủng + qua chia lead. Khách cá nhân = nguồn riêng sale, không thuộc MKT, không tính công MKT, sale own luôn. Khác quyền, khác đường đi, khác cách tính. Gộp 1 nút = loạn số liệu.

**Vì sao flag khách cá nhân trùng số (1.9).** [Lý thuyết trò chơi] Nút "khách cá nhân" mở cửa cho chiêu *rửa nguồn*: sale nhận lead ads → nhập lại thành "khách cá nhân" để né luật chia chác/thu hồi hoặc đẹp số TTL1. Không cần nghi ngờ ai — có khe hở thì sớm muộn có người lách. Vì mọi nguồn qua 1 cửa, hệ thống tự đối chiếu kho Person → trùng thì flag. Một dòng code, đỡ vạn cuộc cãi.

**Vì sao có máy đối soát (1.10).** Nhập bù chỉ là *vá* — nghĩa là đã có người phát hiện miss. Nhưng ai phát hiện, bằng cách nào? Hên xui. Đối soát tự động = *chữa*: máy chỉ ra chính xác lead nào thiếu mỗi sáng. Bằng chứng cần cơ chế này: từng phát hiện Meta đếm 143 leads, CRM chỉ 104 (lệch 37%).

**Vì sao broadcast = Lead mới + Person cũ + KHTN mới (1.11).** Đây là lý do tách 3 thực thể từ đầu. Tính theo SĐT thì "không phải lead mới" — đúng, nên Person giữ nguyên (không nhân bản người, giữ lịch sử xuyên dự án). Nhưng đây là cơ hội kinh doanh mới ở campaign mới → cần Lead mới (đo CAC kênh broadcast) + KHTN mới (sale chăm, không thấy ghi chú dự án cũ). [Tư duy hệ thống] Đây là lúc kho data chuyển từ chi phí lưu trữ thành tài sản sinh lời: mỗi chiến dịch làm giàu kho Person → kho Person nuôi chiến dịch sau rẻ hơn lead lạnh nhiều lần → lợi thế cộng dồn, đối thủ không sao chép (mua được ads, không mua được 2 năm lịch sử chăm sóc).

**Vì sao MKT giữ toàn bộ trước phễu (1.6-1.8).** Sếp chốt: MKT chịu trách nhiệm cung cấp lead theo chiến dịch/dự án cho PKD; Sales chỉ chăm sóc & chuyển đổi. Sales không tham gia Fanpage/Messenger/Zalo OA của công ty. Ranh giới này làm phân quyền sạch: ai tạo lead = ai chịu trách nhiệm chất lượng đầu vào.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | Luật loại trừ tệp broadcast (1.13) — chốt danh sách cuối: còn nhóm nào nữa ngoài 3 nhóm đã nêu? | Liên quan tuân thủ chống spam + policy ZNS Zalo |
| M2 | KHTN mới từ broadcast chia cho ai? Sale từng chăm Person ở dự án cũ (có quan hệ) hay team đang phụ trách dự án mới? | Lệch nhau về cả công bằng lẫn tỷ lệ chuyển đổi — **chưa chốt** |
| M3 | Khách cá nhân trùng số được flag — sau khi flag, Quản lý có quyền làm gì? (gỡ về MKT / cho qua / khóa) | Cần định nghĩa hành động sau flag |
| M4 | Messenger/Zalo OA: Phase 1 nhập tay. Khi nào nâng lên webhook tự động? | Phase 2+ — cửa đã thiết kế sẵn để cắm |
