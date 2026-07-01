# LUỒNG 5 — KHO DATA (DATABANK)

> Trạng thái: ✅ Đã review cùng Sếp 06/06/2026
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md`

---

## LỚP 1 — ẢNH CHỤP NHANH

```
Lead MKT (R3 / R2 / R3_Fb / broadcast) chia chính thức cho sale đầu tiên
   ↓
ĐỒNG HỒ BẢO MẬT chạy theo trạng thái (càng cao càng lâu — Đặt Cọc = vĩnh viễn)
   ↓ (hết hạn mà không tiến tiếp)
PERSON CÔNG KHAI RA KHO — chỉ 1 lần duy nhất. Sale gốc VẪN GIỮ KHTN của mình
   ↓
Sale khác duyệt kho (SĐT/Dự án ẩn-hiện theo config) → nhận → KHTN mới nguồn `databank`
   (không đồng hồ riêng, không ra kho lần 2 — cạnh tranh mở, theo hạn mức)
   ↓
Bất kỳ KHTN nào đạt ĐẶT CỌC → Person rút khỏi kho vĩnh viễn
   (KHTN đang tồn tại của sale khác giữ nguyên)
```

- **Vai tham gia:** Hệ thống (đồng hồ bảo mật, công khai, rút kho) · Sale (duyệt kho, nhận) · Admin (config kho: phân quyền, hạn mức, ẩn/hiện, đóng/mở) · Quản lý (đẩy thủ công vào kho — luật 2.25).
- **Đường đi:** độc quyền có thời hạn → công khai 1 lần → cạnh tranh mở → cọc thì đóng kho.
- **Đích cuối:** không Person nào chết trong tay 1 sale ì; chăm tốt được thưởng bằng độc quyền; data cũ liên tục tái khai thác, đo được tỷ lệ kho → giao dịch.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### Đồng hồ bảo mật & ra kho

| # | Luật | TT |
|---|---|---|
| 5.1 | Cơ chế ra kho CHỈ áp dụng lead nguồn MKT: `R3`, `R2`, `R3_Fb`, `broadcast`. Nguồn `ca_nhan`/`gioi_thieu` không bao giờ vào kho (luật 1.16) | ✅ |
| 5.2 | **Bảo mật = ưu tiên sale nhận đầu tiên**: chuyển trạng thái sớm → giữ quyền không bị cạnh tranh. Thời hạn theo BRD: Chưa XĐ 3h · Quan Tâm +1 ngày · (Thiện chí +3 ngày nếu thêm) · Đồng Ý Gặp +4 ngày · Đã Gặp +5 ngày · Booking +3 tháng · **Đặt Cọc: không bao giờ ra** · Not Lead: vĩnh viễn không vào kho. Lưu dạng bảng config có hiệu lực theo thời gian | ✅ |
| 5.3 | Hết hạn đồng hồ mà không tiến trạng thái → **Person công khai ra kho — chỉ 1 lần duy nhất**. Sale gốc KHÔNG bị giật lead: KHTN của họ giữ nguyên, chỉ mất độc quyền | ✅ |
| 5.4 | KHTN lấy từ kho (nguồn `databank`): KHÔNG có đồng hồ bảo mật riêng, KHÔNG ra kho lần 2. Person tiếp tục nằm trong kho cho sale khác lấy (theo hạn mức) — cạnh tranh mở | ✅ |
| 5.5 | **Cửa đóng kho duy nhất = Đặt Cọc**: bất kỳ KHTN nào của Person đạt Đặt Cọc → Person rút khỏi kho (với chiến dịch đó). KHTN đang tồn tại của các sale khác **giữ nguyên** — chỉ là kho không phát hành thêm. *Ngoại lệ:* bể cọc chưa phát sinh doanh thu → KHTN tụt trạng thái (luật 6.15) → đồng hồ bảo mật của trạng thái mới chạy lại → có thể ra kho lại như thường | ✅ |

### Chia tiếp ở Chưa Xác Định (chống nhận-mà-không-gọi)

| # | Luật | TT |
|---|---|---|
| 5.6 | Lead ở **Chưa Xác Định** 3h không tiến → hệ thống **chia thêm 1 sale** chăm song song (KHÔNG thu hồi của sale 1). **Trần = 1 lần chia thêm** (tối đa 2 người ở giai đoạn này) | ✅ |
| 5.7 | Cả 2 vẫn ì hết khung 5.2 → Person ra kho theo luật chung, không cần cơ chế riêng | ✅ |
| 5.8 | KHÔNG có cờ "người khác đang chăm" — nguyên tắc gốc tuyệt đối: **sale chỉ nhìn thấy những gì họ được nhận và tạo ra**. Ra kho ≠ công khai lịch sử | ✅ |

### Vận hành kho

| # | Luật | TT |
|---|---|---|
| 5.9 | Hạn mức giữ cơ chế cũ, đổi đơn vị team → sale: tối đa 2 sale nhận 1 Person/ngày · 3 lead/giờ/sale · 300/tháng/sale — admin config | ✅ |
| 5.10 | Kho phân theo **chiến dịch**. Admin: phân quyền sale vào kho, đóng/mở kho, hạn mức | ✅ |
| 5.11 | **Ẩn/hiện tùy biến SĐT và DỰ ÁN** khi duyệt kho — admin config theo kho, phục vụ điều hướng. SĐT đầy đủ chỉ hiện sau khi nhận | ✅ |
| 5.12 | Lấy từ kho không thấy lịch sử người cũ — ngoại lệ duy nhất: ghi chú "di sản" của sale đã nghỉ việc (luật 2.27) | ✅ |
| 5.13 | **Đóng — Không Phù Hợp vẫn ra kho** cho sale khác thử lại. Cùng 1 Person bị Đóng — Không Phù Hợp **3 lần cùng 1 lý do** trong 1 chiến dịch → không ra kho nữa, chỉ còn đường broadcast dự án sau | ✅ |

---

## LỚP 3 — VÌ SAO

**Vì sao bảo mật = phần thưởng, không phải luật hành chính (5.2-5.3).** [Lý thuyết trò chơi] Độc quyền có thời hạn là cách trả công cho tốc độ + chất lượng chăm sóc bằng thứ sale quý nhất: không bị cạnh tranh. Đẩy trạng thái nhanh → giữ quyền lâu → động lực tự nhiên. Chăm ẩu → thị trường nội bộ tự mở cửa cạnh tranh — không cần ai phạt ai. Đặt Cọc = phần thưởng tuyệt đối (không bao giờ mất khách về kho).

**Vì sao ra kho chỉ 1 lần, kho-picker không có đồng hồ (5.4).** Nếu người lấy từ kho cũng được độc quyền thì kho thành "vòng chia thứ 2" — Person bị nhốt hết độc quyền này đến độc quyền khác, người thứ 3 không bao giờ có cơ hội. Kho đúng nghĩa là chợ mở: ai tin mình chăm được thì lấy, nhiều người cùng thử, ai cọc trước thắng. Đơn giản hơn cho cả vận hành lẫn code.

**Vì sao ra kho không giật lead của sale gốc (5.3).** Cùng triết lý "chia tiếp thay vì thu hồi": không trừng phạt, chỉ thêm cạnh tranh. Sale gốc vẫn còn cơ hội — nếu họ bứt lên đặt cọc trước thì vẫn thắng (và 5.5 đóng kho cho họ).

**Vì sao chia tiếp chỉ ở Chưa Xác Định, trần 1 (5.6).** Mục đích duy nhất: chống "nhận lead rồi bận không gọi" — lỗ hổng tốc độ ở giờ đầu tiên, nơi lead nguội nhanh nhất. Các trạng thái sau đã có đồng hồ bảo mật xử lý. Trần 1 vì: 2 người gọi 1 khách trong vài giờ đầu là đủ dự phòng; 3-4 người là phá khách. Hết chuỗi → luật kho chung gánh tiếp, không đẻ thêm cơ chế (5.7).

**Vì sao không cờ (5.8).** Sếp giữ nguyên tắc gốc tuyệt đối: chỉ thấy cái mình nhận/tạo. Cờ "có người khác" là một dạng rò rỉ thông tin — biết có đối thủ sẽ đổi hành vi (vội ép khách, hoặc buông sớm). Cạnh tranh "mù" giữ mỗi sale chăm như thể khách là của riêng mình — chất lượng chăm sóc trung thực hơn.

**Vì sao Đóng — Không Phù Hợp ra kho + luật 3-lần-cùng-lý-do (5.13).** Một sale kết luận "không đủ tài chính" có thể sai — cho người khác thử = cơ chế sửa lỗi (chống sale đầu làm ẩu). Nhưng 3 người độc lập cùng 1 kết luận = tín hiệu đủ mạnh, thử nữa là lãng phí + làm phiền khách. Dev lưu ý: đếm theo *cùng lý do* — 2 lần "hết nhu cầu" + 1 lần "không đủ tài chính" chưa kích hoạt.

**Vì sao ẩn/hiện cả Dự Án (5.11).** Núm vặn điều hướng của quản trị: có lúc muốn sale chọn khách theo chân dung thay vì bu vào dự án quen. Để admin vặn, không để dev quyết cứng.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | Hạn mức 5.9: giữ nguyên số cũ (2/ngày, 3/giờ, 300/tháng) khi đổi sang cá nhân hay chỉnh lại? | Config được — không gấp |
| M2 | Booking +3 tháng rồi vẫn ra kho: khách đã booking với sale A mà sale B lấy từ kho chào tiếp — quy tắc ứng xử/kịch bản cho ca nhạy cảm này có cần ghi vào đào tạo không? | Vận hành mềm, ngoài hệ thống |
| M3 | Lead `broadcast` vào thẳng kho chiến dịch hay qua vòng chia chính thức trước? (Luồng 1 M2 còn treo câu "broadcast chia cho ai") | Nối với Luồng 1-M2 |
