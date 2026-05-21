# HỆ THỐNG PHÂN PHỐI LEAD (DOMATION DATA)

Dự án quản lý, đồng bộ và phân phối khách hàng tiềm năng (lead) từ Google Sheets / Landing Page cho đội ngũ tư vấn viên (Sale / Consultant) qua Email và Zalo Bot.

---

## ⚠️ ĐỌC TRƯỚC KHI THỰC THI (HƯỚNG DẪN DÀNH CHO AI AGENTS & DEVELOPERS)

> [!IMPORTANT]
> Để tiết kiệm Token và tránh các lỗi logic nghiệp vụ, bất kỳ AI Agent hoặc lập trình viên nào khi bắt đầu làm việc với codebase này **BẮT BUỘC** phải tuân thủ hai quy tắc sau:

1. **Đọc [base.md](file:///e:/GIAO_DATA_GOOGLESHEETS/base.md) trước tiên**: Tệp tin [base.md](file:///e:/GIAO_DATA_GOOGLESHEETS/base.md) chứa toàn bộ sơ đồ database schema (tên bảng, cột, khóa ngoại, indexes), sơ đồ luồng nghiệp vụ cốt lõi (thuật toán phân phối xoay vòng Round-Robin, cách tính đền bù, xử lý trùng lặp lead) và danh sách cổng API/Zalo chatbot commands. Việc đọc tệp tin này giúp bạn có cái nhìn toàn cảnh mà không cần quét toàn bộ mã nguồn.
2. **Cập nhật song song [base.md](file:///e:/GIAO_DATA_GOOGLESHEETS/base.md) khi sửa đổi**: Mỗi khi thực hiện thay đổi cấu trúc dữ liệu (như thêm cột, tạo bảng mới trong database di chuyển di động `db_connect.php`), thêm API action mới trong `api.php`, thay đổi logic nghiệp vụ định tuyến/phân phối trong `webhook_logic.php`, hoặc thay đổi cú pháp chatbot trong `zalo_webhook.php`... bạn **PHẢI** cập nhật thông tin đó vào [base.md](file:///e:/GIAO_DATA_GOOGLESHEETS/base.md) ngay lập tức để duy trì tính nhất quán của tài liệu.

---

## CẤU TRÚC PHÁT TRIỂN & CHẠY DỰ ÁN

### 1. Yêu cầu môi trường
*   **Backend**: PHP 8.x + MySQL/MariaDB.
*   **Frontend**: Node.js + NPM (chạy React TypeScript thông qua Vite).

### 2. Thiết lập dự án
*   **Backend**: Cấu hình tệp tin kết nối và biến môi trường tại `/backend/.env` hoặc `/backend/env.php`.
*   **Frontend**:
    *   Cài đặt thư viện: `npm install`
    *   Chạy môi trường phát triển: `npm run dev`
    *   Biên dịch sản phẩm: `npm run build`

Thông tin cấu trúc chi tiết, các tham số API và sơ đồ luồng vui lòng xem tại **[base.md](file:///e:/GIAO_DATA_GOOGLESHEETS/base.md)**.
