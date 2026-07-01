# LUỒNG 4 — HỢP TÁC & CHIA HOA HỒNG

> Trạng thái: ✅ Đã review cùng Sếp 06/06/2026
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md`

---

## LỚP 1 — ẢNH CHỤP NHANH

```
Owner chăm KHTN ──→ bấm "MỜI HỖ TRỢ" ──→ người được mời thấy KHTN
   │                  (ghi vào bảng           (đọc ghi chú cũ + ghi mới
   │                   quyền truy cập)         dưới tên mình)
   │                       ↕ thu hồi bất kỳ lúc nào — lịch sử lưu vĩnh viễn
   ↓
Chuyển ĐẶT CỌC + tạo phiếu giao dịch
   ↓
PHIẾU HỢP TÁC tự sinh từ bảng quyền truy cập (gồm cả người đã bị thu hồi)
   ↓
Owner điền % (tổng = 100%) → TỪNG NGƯỜI bấm xác nhận → GĐKD duyệt
   ↓
PHIẾU KHÓA vĩnh viễn → hoa hồng tính tự động → dashboard từng người
```

- **Vai tham gia:** Owner (chủ deal — duy nhất chuyển trạng thái) · Người hỗ trợ (được mời) · GĐKD (duyệt phiếu) · Quản lý (nhận cảnh báo phiếu treo, phân xử) · Hệ thống (sinh phiếu, thông báo, khóa).
- **Đường đi:** Mời → cùng chăm → đặt cọc → phiếu tự sinh → ký từng người → duyệt → khóa → tiền.
- **Đích cuối:** Không deal hợp tác nào phải cãi nhau về chia chác — thỏa thuận thành chữ ký số, trọng tài gần như thất nghiệp. Phụ phẩm quý: lịch sử mời lộ ra ai là "chuyên gia cứu khách" thật của sàn.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### Sở hữu & mời hỗ trợ

| # | Luật | TT |
|---|---|---|
| 4.1 | Mỗi KHTN có đúng **1 owner**. CHỈ owner được chuyển trạng thái — người hỗ trợ tác nghiệp qua ghi chú | ✅ |
| 4.2 | Owner mời hỗ trợ cho 1 hoặc nhiều người. Người được mời: đọc toàn bộ ghi chú của KHTN này + ghi chú mới dưới tên mình | ✅ |
| 4.3 | Lúc mời **KHÔNG đề cập % hoa hồng** — phần hợp tác chỉ xuất hiện khi tạo phiếu giao dịch Đặt Cọc | ✅ |
| 4.4 | Owner thu hồi quyền bất kỳ lúc nào. Mọi lượt mời/thu hồi lưu vĩnh viễn trong bảng quyền truy cập | ✅ |

### Phiếu hợp tác

| # | Luật | TT |
|---|---|---|
| 4.5 | Phiếu sinh ra khi tạo phiếu giao dịch Đặt Cọc. Danh sách người tự kéo từ bảng quyền truy cập — **gồm cả người đã bị thu hồi giữa chừng** (họ từng góp công). Không nhập tay danh sách | ✅ |
| 4.6 | Owner điền % từng người theo thỏa thuận nhóm (khung thỏa thuận đã có ngoài hệ thống). Hệ thống chỉ kiểm tra: **tổng = 100%** | ✅ |
| 4.7 | % tính trên **doanh thu hoa hồng của căn đó trả về sales — sau khi trừ phần sàn** | ✅ |
| 4.8 | Từng người trong phiếu bấm **xác nhận** (1 chạm). Đủ chữ ký → chuyển GĐKD | ✅ |
| 4.9 | Không phản hồi quá **24h** → phiếu treo + thông báo quản lý. KHÔNG tự phân xử | ✅ |
| 4.10 | Có người **từ chối** → phiếu treo → quản lý/GĐKD phân xử (có sẵn lịch sử ai-làm-gì trên KHTN làm bằng chứng) | ✅ |
| 4.11 | **GĐKD duyệt cuối** — kể cả khi owner và người hỗ trợ thuộc 2 quản lý khác nhau (một vai duyệt, hết tranh chấp thẩm quyền) | ✅ |
| 4.12 | Duyệt xong → **phiếu khóa vĩnh viễn**. Muốn sửa → phiếu điều chỉnh mới + duyệt lại. Không ai sửa trực tiếp được, kể cả admin | ✅ |
| 4.13 | Phiếu **không chặn trạng thái Đặt Cọc** — tiền về (UNC) thì ghi nhận trạng thái ngay. Phiếu chỉ chặn việc **tính hoa hồng** | ✅ |
| 4.14 | Người trong phiếu **nghỉ việc** trước khi tính hoa hồng → phần đó **tính cho owner** (xử mềm ngoài hệ thống theo thỏa thuận) | ✅ |
| 4.15 | Sau duyệt: hoa hồng dự kiến hiển thị trên dashboard cá nhân của từng người trong phiếu | ✅ |

---

## LỚP 3 — VÌ SAO

**Vì sao sở hữu cá nhân + mời linh hoạt thay buddy cố định.** Mô hình cũ "2 người 1 team cùng nhận khách" cứng: thừa khi 1 người đủ, thiếu khi cần người thứ 3 đúng chuyên môn. Sở hữu rõ (1 owner) + hợp tác theo nhu cầu (mời ai cũng được, mấy người cũng được) = trách nhiệm không pha loãng mà vẫn linh hoạt.

**Vì sao chỉ owner chuyển trạng thái (4.1).** Trạng thái là cam kết trách nhiệm của chủ deal (kèm bằng chứng, kèm hệ quả CAPI/báo cáo). Hai người cùng quyền chuyển = không ai chịu trách nhiệm cuối. Người hỗ trợ giỏi vẫn tỏa sáng qua ghi chú + chữ ký trong phiếu.

**Vì sao phiếu tự sinh từ bảng quyền truy cập (4.5).** Không bắt ai nhớ ai kể: mọi người từng chạm deal đều hiện ra, kể cả người bị thu hồi giữa chừng — để không "quên" người đã giúp đoạn giữa. Dữ liệu vận hành (lượt mời) tái dùng làm dữ liệu tài chính (danh sách chia) — một nguồn sự thật.

**Vì sao từng người tự ký (4.8).** [Lý thuyết trò chơi] Chữ ký từng người biến thỏa thuận thành **tự thực thi (self-enforcing)**: không ai ký cái mình không đồng ý → phiếu đủ chữ ký = hết thứ để cãi → trọng tài (GĐKD) gần như chỉ đóng dấu. Cơ chế tốt là cơ chế khiến trọng tài thất nghiệp. Kèm **tách vai (Separation of Duties)**: người điền (owner) ≠ người xác nhận (từng thành viên) ≠ người duyệt (GĐKD) — không ai vừa đá bóng vừa thổi còi.

**Vì sao KHÔNG đề xuất % lúc mời (4.3) — phương án đã cân nhắc và bác.** Em (Claude) từng đề xuất cho ghi % dự kiến ngay lúc mời để chống hold-up (giúp xong mới mặc cả → người hỗ trợ yếu thế). Sếp bác với lý do: lúc mời phải nhẹ — đưa chuyện tiền vào sớm tạo rào cản tâm lý cho chính hành vi mời; và công ty đã có khung thỏa thuận bên ngoài hệ thống. Rủi ro hold-up được giảm bằng cách khác: phiếu tự liệt kê đủ mọi người từng tham gia (không ai bị quên) + chữ ký từng người (không ai bị ép ký) + GĐKD phân xử khi từ chối.

**Vì sao không chặn trạng thái Đặt Cọc (4.13).** Tiền thật đã về thì thực tế kinh doanh phải được ghi nhận ngay: báo cáo tuần đúng, CAPI bắn `Purchase` không trễ (tín hiệu quý nhất cho Meta). Một người chậm ký không được phép làm cả deal "tàng hình".

**Vì sao nghỉ việc → tính cho owner (4.14).** Đơn giản và đoán trước được: hệ thống không giữ "nợ treo" với người đã rời đi (pháp lý + vận hành đều rối). Trường hợp đặc biệt xử mềm bằng thỏa thuận ngoài hệ thống — đúng triết lý chung: hệ thống giữ luật cứng đơn giản, con người giữ ngoại lệ.

**Vì sao 24h treo + thông báo, không tự phân xử (4.9).** Tự động phân xử = máy quyết chuyện tiền của người — vượt vai. Máy chỉ làm 2 việc nó giỏi: đếm giờ và gọi đúng người có thẩm quyền.

---

## LỚP 4 — CÒN MỞ

| # | Câu hỏi / tình huống biên | Ghi chú |
|---|---|---|
| M1 | Quản lý có quyền thu hồi lượt share thay owner không (khi 2 sale mâu thuẫn giữa chừng)? | Chưa chốt — hiện chỉ owner thu hồi |
| M2 | Phiếu điều chỉnh sau khóa: ai được khởi tạo (owner? GĐKD?), có cần đủ chữ ký lại không? | Quy trình chi tiết chưa định |
| M3 | Người được mời có cần thuộc roster chiến dịch đó không, hay sale bất kỳ trong sàn? | Ảnh hưởng phạm vi nhìn dữ liệu chiến dịch |
| M4 | Có ràng buộc % tối thiểu cho owner không (tránh trường hợp bị áp lực nhường gần hết)? | Nghiêng về: không — tôn trọng thỏa thuận, đã có GĐKD duyệt |
