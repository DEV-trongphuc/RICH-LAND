# BIÊN BẢN NGHIỆM THU RÚT GỌN - HỆ THỐNG CRM RICH LAND

- **Dự án**: Hệ thống CRM & Tự động hóa Phân phối Dữ liệu (RICH LAND CRM)
- **Đơn vị Phát triển (Bên A)**: Lập trình viên Thanh (Developer Thanh)
- **Đơn vị Thụ hưởng (Bên B)**: Công ty Bất động sản RichLand (RichLand Real Estate)
- **Thời gian lập**: Ngày 28 tháng 07 năm 2026

---

## 1. TÓM TẮT TRẠNG THÁI NGHIỆM THU CÁC MODULE

Dưới đây là danh sách các module chính của hệ thống CRM Rich Land cùng trạng thái nghiệm thu rút gọn:

| STT | Tên Module Nghiệp Vụ | Trạng Thái | Mô Tả Các Chức Năng Đã Nghiệm Thu Thành Công (ĐẠT) |
|---|---|---|---|
| **1** | **Tiếp nhận khách hàng mới (Lead Ingestion)** | **ĐẠT (11/11)** | Tiếp nhận tập trung từ Facebook/Google/LP, chống trùng lặp, tự gộp đăng ký trùng SĐT trong ngày, nhập bù khách Marketing, phân biệt khách cá nhân (nguồn riêng). |
| **2** | **Tự động phân chia khách hàng (Auto-Routing)** | **ĐẠT (7/7)** | Phân phối xoay vòng cho nhân sự trực, chế độ trực đêm, giới hạn hạn mức nhận lead, tự thu hồi lead sau 2 phút nếu không nhận, lưu vết lịch sử chia lead. |
| **3** | **Chăm sóc khách hàng & Phân loại (Care & Temperature)** | **ĐẠT (7/7)** | Ghi log tương tác chi tiết, tự động cảnh báo hạ nhiệt độ, bắt buộc nhập đủ 4/5 tiêu chí chất lượng mới được chuyển "Đồng ý gặp", bắt buộc tải ảnh minh chứng khi chuyển "Đã gặp". |
| **4** | **Hợp tác bán hàng & Duyệt phí (Collaboration)** | **ĐẠT (7/7)** | Mời nhân sự hỗ trợ bán chéo, lập phiếu hợp tác chia hoa hồng, khóa dữ liệu sau khi Giám đốc duyệt, tự động treo phiếu quá 24h chưa ký xác nhận. |
| **5** | **Kho dữ liệu chung tái khai thác (Databank)** | **ĐẠT (6/6)** | Tự động thu hồi khách hàng không tương tác đẩy ra Kho chung, ẩn thông tin nhạy cảm (SĐT/Dự án) trên Kho chung, giới hạn hạn mức lấy khách từ Kho chung. |
| **6** | **Quản lý dự án & Danh sách bán (Projects)** | **ĐẠT (4/4)** | Quản lý phân quyền chuyên viên bán theo dự án, chặn tải tài liệu dự án mật cho chuyên viên ngoài danh sách bán, nhận diện dự án từ phễu Marketing. |
| **7** | **Tổ chức đội nhóm & Báo cáo KPI (Teams)** | **ĐẠT (5/5)** | Quản lý sơ đồ phòng ban, quyền giám sát của Trưởng phòng đối với thành viên nhóm, tự động cộng dồn KPI/doanh thu từ nhân viên lên phòng ban và chi nhánh. |
| **8** | **Tiền cọc & Duyệt giao dịch (Deposits & Finance)** | **ĐẠT (7/7)** | Tự động khóa căn trên bảng hàng khi có cọc, duyệt UNC đợt thanh toán, xử lý hoàn cọc/hạ trạng thái khi chưa có doanh thu, giữ trạng thái cọc khi đã có doanh thu thực tế, quy trình đổi căn lưu vết audit trail. |
| **9** | **Tín hiệu phản hồi quảng cáo (Conversion API)** | **CHƯA TEST** | Chờ kết nối thực tế với tài khoản quảng cáo của doanh nghiệp (Meta/Google). Đã lập trình sẵn logic chuyển đổi một chiều (Forward-only) chống gửi lùi tín hiệu. |
| **10** | **Ma trận bảo mật & Phân quyền (Security)** | **ĐẠT (6/6)** | Bảo mật dữ liệu khách hàng chéo giữa các sales (RLS), phân quyền truy cập chi tiết cho Marketing, Admin dự án, Giám đốc kinh doanh và IT, ghi log hệ thống bất biến. |
| **11** | **Vòng đời trạng thái & Phễu chuyển đổi** | **ĐẠT (6/6)** | Quản lý State Machine phễu khách hàng, chặn đóng hồ sơ nhanh khi chưa tương tác, kiểm soát chuyển đổi sang "Đồng ý gặp" theo tiêu chuẩn chất lượng (TTL1). |
| **12** | **Trợ lý ảo hỗ trợ bán hàng AI (AI Assistant)** | **ĐẠT (3/3)** | Tự học tài liệu dự án/pháp lý, trả lời câu hỏi nghiệp vụ và tìm kiếm ngữ nghĩa theo công nghệ RAG/Vector Search. |
| **13** | **Kênh thông báo tự động & Bots (Command Center)** | **ĐẠT PHẦN LỚN** | - **ĐẠT**: Gửi thông báo Telegram Bot, gửi email tự động qua Gmail, chuông thông báo Real-time trên Web, Webhook tiếp nhận tin nhắn từ Zalo/Telegram.<br>- **CHƯA TEST**: Zalo Bot gửi tin nhắn cá nhân và Zalo Group (Chờ tài khoản Zalo OA doanh nghiệp). |

---

## 2. KÝ XÁC NHẬN NGHIỆM THU

### BÊN GIAO (BÊN A)
**Lê Văn Thanh**

*(Ký và ghi rõ họ tên)*

### BÊN NHẬN (BÊN B)
**Đại diện RichLand**

*(Ký và ghi rõ họ tên)*
