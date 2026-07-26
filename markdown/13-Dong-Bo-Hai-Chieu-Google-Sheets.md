# LUỒNG 9 — ĐỒNG BỘ HAI CHIỀU GOOGLE SHEETS & WEBHOOKS

> Trạng thái: ✅ Đã duyệt và chốt thiết kế
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md` + `backend/cron_sync.php`

---

## LỚP 1 — ẢNH CHỤP NHANH

Luồng tiếp nhận lead tức thời và đồng bộ hai chiều dữ liệu giữa hệ thống CRM và Google Sheets của đối tác:

```
Webhook (Landing Page/Ads) ──→ CRM CSDL ──→ Phân chia lead ──→ Ghi nhận Google Sheets
                                                                       ▲
                                                                       │ (Đồng bộ 2 chiều)
Google Sheets Thay đổi ──────→ Cron Sync ─→ Đối soát Hash ─────────────┘
```

* **Vai tham gia:** Hệ thống Webhook (nhận dữ liệu) · Cron Job Sync (quét định kỳ) · MKT (cấu hình liên kết bảng tính).
* **Đường đi:** Lead đổ về -> Ghi nhận database -> Đồng bộ lên Google Sheets. Ngược lại: Admin sửa trên Sheets -> Cron phát hiện qua đối soát row hash -> Cập nhật ngược về CRM.
* **Đích cuối:** Đồng bộ tuyệt đối dữ liệu trạng thái lead, ghi chú giữa CRM và Google Sheets với cơ chế chống lặp vô hạn.

---

## LỚP 2 — LUẬT ĐẠ CHỐT

### [A] Cơ chế thu nạp lead & Webhooks

| # | Luật | TT |
|---|---|---|
| 13.1 | **Cổng tiếp nhận Webhook**: Webhook nhận dữ liệu POST, tự động bóc tách thông tin liên hệ (SĐT, Email, Họ tên) và lưu vết gốc vào bảng `leads`. | ✅ |
| 13.2 | **Chuẩn hóa thông tin liên hệ**: Mọi số điện thoại đổ về bắt buộc đi qua hàm `normalizePhone` để xóa ký tự đặc biệt, chuẩn hóa đầu số quốc gia quốc tế về dạng chuẩn lưu trữ. Nếu có nhiều SĐT/email viết liền, hệ thống dùng Regex tách nhỏ để đối soát trùng lặp. | ✅ |

### [B] Thuật toán đồng bộ hai chiều Google Sheets

| # | Luật | TT |
|---|---|---|
| 13.3 | **Khóa an toàn chống chạy đè (Mutex Lock)**: Script `cron_sync.php` sử dụng file khóa vật lý tạm (`cron_sync.lock`) kèm cờ `LOCK_EX \| LOCK_NB` để đảm bảo tại một thời điểm chỉ có duy nhất một tiến trình đồng bộ được chạy, tránh xung đột ghi đè dữ liệu. | ✅ |
| 13.4 | **Tự phục hồi tiến trình treo (Auto-recovery)**: Khi bắt đầu chạy, hệ thống tự động quét và giải phóng (thiết lập về `idle`) các kết nối bảng tính bị kẹt ở trạng thái `syncing` quá 10 phút do lỗi server đột ngột ở phiên chạy trước. | ✅ |
| 13.5 | **Đối soát Row Hash chống lặp**: Để tránh vòng lặp đồng bộ vô hạn (CRM cập nhật Sheets -> Sheets lại cập nhật CRM), hệ thống tính toán mã băm SHA256 cho dữ liệu mỗi hàng và lưu vào bảng `sheet_sync_records`. Hệ thống chỉ thực hiện cập nhật nếu row hash thực tế khác với hash đã lưu. | ✅ |
| 13.6 | **Hạ cấp liên kết lỗi (De-escalate)**: Các kết nối Google Sheets bị lỗi kết nối liên tục (mất quyền chia sẻ, sai ID bảng tính) quá ngưỡng quy định sẽ tự động bị chuyển sang trạng thái ngưng hoạt động (`is_active = 0`) và gửi cảnh báo về hệ thống. | ✅ |

---

## LỚP 3 — VÌ SAO

* **Lý do dùng Row Hash thay vì kiểm tra mốc thời gian**: Google Sheets không hỗ trợ mốc thời gian chỉnh sửa (Last Modified) chi tiết đến từng ô/từng dòng một cách tin cậy thông qua cURL thô. Cơ chế tính toán băm SHA256 trên nội dung dòng là giải pháp tối ưu và chính xác nhất để phát hiện thay đổi.
* **Lý do dùng Mutex Lock bằng file**: Đảm bảo an toàn tuyệt đối cho luồng dữ liệu tài chính/lead, ngăn chặn tình trạng race condition khi cron được kích hoạt quá dày hoặc bị kích hoạt trùng bởi cả CLI và Web.

---

## LỚP 4 — CÒN MỞ

* 🔴 Hỗ trợ tự động tạo sheet mới từ CRM template khi tạo kết nối mới.
* 🟡 Cơ chế rollback dữ liệu trên Google Sheets khi có xung đột nghiêm trọng được phát hiện.
