# LUỒNG 10 — TRUNG TÂM ĐIỀU KHIỂN CHATBOT WEBHOOKS (COMMAND CENTER)

> Trạng thái: ✅ Đã duyệt và chốt thiết kế
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md` + `backend/zalo_webhook.php` + `backend/telegram_webhook.php`

---

## LỚP 1 — ẢNH CHỤP NHANH

Luồng xử lý tương tác thời gian thực qua Chatbot, cho phép Admin/Manager ra lệnh hệ thống trực tiếp từ nhóm chat Zalo/Telegram:

```
Nhắn lệnh chat (/report, /duyet 105) ──→ Zalo/Telegram Webhook ──→ Xác thực Người dùng & Quyền
                                                                             │
Phản hồi kết quả chat ◄─────────────── Gửi kết quả ◄──────── Thực thi lệnh ◄─┘
```

* **Vai tham gia:** Admin · Manager · Hệ thống Webhook Chatbot.
* **Đường đi:** Gõ lệnh chat -> Webhook bắt sự kiện -> So khớp mã chat ID với tài khoản hệ thống -> Kiểm tra quyền -> Thực thi nghiệp vụ -> Phản hồi kết quả về nhóm chat.
* **Đích cuối:** Quản lý chiến dịch, phê duyệt nhanh phiếu cọc, xem báo cáo tức thời mà không cần đăng nhập giao diện Web.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### [A] Cơ chế xác thực & Phân quyền chat

| # | Luật | TT |
|---|---|---|
| 14.1 | **Xác thực mã bảo mật Webhook**: Đường dẫn Webhook đăng ký với Zalo/Telegram bắt buộc chứa token bảo mật ngẫu nhiên để chặn các truy cập giả mạo từ bên ngoài. | ✅ |
| 14.2 | **Liên kết tài khoản (Chat ID Mapping)**: Mỗi tài khoản Admin/Manager muốn sử dụng lệnh phải thực hiện liên kết chat ID của Telegram/Zalo OA với trường tương ứng trong bảng `users`. | ✅ |
| 14.3 | **Kiểm soát quyền lệnh (Role Authorization)**: Trước khi thực thi bất kỳ câu lệnh nào, webhook kiểm tra thuộc tính `role` của tài khoản liên kết. Các vai trò không phải `admin`/`manager` sẽ bị từ chối thực thi lệnh nâng cao. | ✅ |

### [B] Tập lệnh điều khiển tiêu chuẩn (Command Console)

| # | Luật | TT |
|---|---|---|
| 14.4 | **Lệnh `/report` (Báo cáo nhanh)**: Trả về thống kê số lượng lead mới, tỷ lệ tiếp nhận, số giao dịch đặt cọc thành công trong ngày của toàn hệ thống hoặc từng chiến dịch cụ thể. | ✅ |
| 14.5 | **Lệnh `/duyet [id]` (Phê duyệt đặt cọc/Check-in)**: Thay đổi nhanh trạng thái phê duyệt của phiếu đặt cọc hoặc lượt điểm danh check-in của Sale từ `pending_approval` sang `approved`. | ✅ |
| 14.6 | **Lệnh `/tuchoi [id] [ly_do]` (Từ chối duyệt)**: Từ chối phiếu đặt cọc hoặc lượt điểm danh check-in, cập nhật trạng thái về `rejected` kèm lý do cụ thể. | ✅ |
| 14.7 | **Lệnh `/sales` (Giám sát hoạt động)**: Danh sách chi tiết danh tính, trạng thái hoạt động (Đang trực, Nghỉ phép, Tạm vắng) của các Sale trong ngày. | ✅ |

### [C] Tối ưu hiệu năng phản hồi

| # | Luật | TT |
|---|---|---|
| 14.8 | **Xử lý bất đồng bộ kết quả**: Đối với các lệnh nặng hoặc cần gọi API ngoài (như gửi Zalo OA), Webhook tiếp nhận lệnh, đẩy yêu cầu vào hàng đợi và trả về tin nhắn xác nhận "Đang xử lý..." trong <1 giây để tránh timeout từ cổng Telegram/Zalo. | ✅ |

---

## LỚP 3 — VÌ SAO

* **Lý do triển khai Command Center qua Chat**: Tăng tốc độ phản hồi của cấp quản lý đối với các sự kiện cần phê duyệt (như duyệt phiếu cọc khi Sale đang ở phòng giao dịch với khách, duyệt check-in cho Sale đi gặp khách sớm). Việc mở ứng dụng chat quen thuộc nhanh hơn nhiều so với việc đăng nhập hệ thống web trên điện thoại di động.
* **Lý do dùng Token bảo mật URL**: Bảo vệ API Webhook khỏi các cuộc tấn công DDoS và quét cổng từ các bên thứ ba.

---

## LỚP 4 — CÒN MỞ

* 🔴 Hỗ trợ phê duyệt hàng loạt bằng cách gửi danh sách ID ngăn cách bởi dấu phẩy (ví dụ: `/duyet 102,103,105`).
* 🟡 Tích hợp trí tuệ nhân tạo (NLP) để hiểu các câu ra lệnh tự nhiên thay vì gõ đúng cú pháp lệnh gạch chéo.
