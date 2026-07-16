# Workspace-Specific Business Rules

## 1. Bể cọc (Deposit Cancellation before Revenue)
* **Rule**: Nếu khách hàng hủy đặt cọc trước khi phát sinh bất kỳ doanh thu thực tế nào cho công ty, trạng thái của Khách hàng Tiềm năng (KHTN / Person) sẽ bị hạ ("tụt") về mức trước đó (ví dụ: `Booking` hoặc `Đã Gặp`).
* **Consequence**: Đồng hồ bảo mật của lead/contact sẽ được kích hoạt chạy lại bình thường và Person này có thể tự động được giải phóng ra lại Kho data chung (Databank) nếu hết hạn.

## 2. Bể cọc sau khi đã có doanh thu (Deposit Cancellation after Revenue)
* **Rule**: Nếu khách hàng hủy đặt cọc nhưng đã đóng đợt 1 (công ty đã thực thu được một phần phí môi giới/doanh thu), thì Person đó **phải được giữ nguyên** trạng thái Đặt Cọc (vì đã phát sinh dòng tiền thực tế và được xác nhận là Khách hàng thật sự).

## 3. Đổi căn (Unit Switching)
* **Rule**: Khi khách hàng đổi căn hộ/dự án giao dịch:
  1. Đóng deal cũ lại (đánh dấu thất bại hoặc đã đổi).
  2. Tạo một deal mới hoàn toàn.
  3. Gắn liên kết ghi rõ "đổi từ căn A" ở deal mới để giữ trọn vẹn lịch sử phí và vết kiểm toán (audit trail).

## 4. Bắn Capi Forward-only (Conversion API Signals)
* **Rule**: Đối với tín hiệu Conversion API (CAPI) gửi về Meta:
  * Tuyệt đối **không bắn lùi tín hiệu** (không gửi sự kiện hoàn trả hoặc hạ cấp) về Meta khi deal bị bể hoặc tụt trạng thái.
  * Tín hiệu chỉ đi một chiều (Forward-only). Một khi đã gửi tín hiệu "Purchase" (Mua hàng) đi là kết thúc giao dịch CAPI cho lead đó.

## 5. Quy trình Deploy & Git Commit
* **Rule**: Bất cứ khi nào có yêu cầu deploy ("deploy", "deploy đi",...), hệ thống phải thực hiện **song song cả 2 nhiệm vụ**: Chạy lệnh deploy (`npm run deploy`) và tự động Commit/Push code mới nhất lên kho Git (`git add .`, `git commit`, `git push origin main`) để đồng bộ tuyệt đối giữa server và mã nguồn gốc.

