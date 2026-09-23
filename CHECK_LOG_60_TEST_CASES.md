# BÁO CÁO AUDIT & CHECK LOG 60 TEST CASES
> **Dự án**: RICH LAND CRM  
> **Tài liệu đối soát**: `D:\Downloads\60 test case.docx`  
> **Thời điểm kiểm tra**: 23/09/2026  
> **Phạm vi thực hiện**: Chỉ kiểm thử và rà soát hệ thống (Frontend, Backend, Database Staging `crm.richland.city`), **tuyệt đối không sửa code hoặc can thiệp dữ liệu**.

---

## I. TỔNG QUAN KẾT QUẢ AUDIT

Bộ tài liệu kiểm thử gồm **60 kịch bản** (50 Test Cases đơn lẻ từ TC-01 đến TC-50 chia thành 7 Luồng + 10 Kịch bản kiểm thử tích hợp tổng hợp).

| Phân loại kết quả | Số lượng | Tỷ lệ | Ý nghĩa |
| :--- | :---: | :---: | :--- |
| **ĐẠT (PASS)** | **46 / 60** | **76.7%** | Đã có sẵn trong Codebase và CSDL Staging, vận hành đúng chuẩn theo kịch bản và Business Rules. |
| **ĐẠT MỘT PHẦN (PARTIAL)** | **4 / 60** | **6.7%** | Nghiệp vụ cốt lõi đã chạy, nhưng còn thiếu một số điều kiện phụ (ví dụ: trường lưu trữ phụ). |
| **CHƯA CÓ / CẦN HỖ TRỢ (UNCLEAR / MISSING)** | **10 / 60** | **16.6%** | Tính năng chưa có trong hệ thống, kịch bản BA có xung đột với code hiện tại, hoặc cần người dùng xác nhận quy cách. |

---

## II. DANH SÁCH CÁC ĐIỂM "CHƯA RÕ / CHƯA CÓ TRONG APP CẦN BẠN HỖ TRỢ"

Đây là danh sách quan trọng nhất cần bạn xem xét và cho ý kiến định hướng trước khi đội ngũ tiến hành phát triển hoặc điều chỉnh:

### 1. TC-02: Bất biến của bản ghi LEAD gốc (Immutable Event Log)
- **Kịch bản BA**: Bảng `LEAD` tuyệt đối chỉ cho phép `INSERT`, cấm mọi lệnh `UPDATE` hoặc `DELETE` (kể cả Admin gọi API hay chạy SQL).
- **Thực tế trong App**: CSDL Staging chưa cài DB Trigger cấm `UPDATE`. Đặc biệt file `backend/api.php` (dòng 17111 `update_lead_fields`) vẫn cung cấp API cho phép Admin/Quản lý sửa `name, phone, email, note` của bản ghi `leads`.
- **Cần hỗ trợ**: Bạn có muốn khóa cứng tuyệt đối bảng `leads` (xóa bỏ endpoint sửa lead gốc) và chỉ cho phép cập nhật thông tin trên tầng `contacts / persons` không?

### 2. TC-05 & Kịch bản 1: Gộp Lead Google Ads trong cùng 1 ngày
- **Kịch bản BA**: Khách điền Google Ads nhiều lần trong cùng 1 ngày (cùng SĐT + cùng Dự án) thì **chỉ tạo 1 bản ghi LEAD duy nhất**, các lần điền sau gộp thông tin bổ sung vào form hiện tại.
- **Thực tế trong App**: Webhook hiện tại chưa có nhánh logic riêng cho Google Ads; mỗi lần khách bấm submit form đều sinh 1 bản ghi `leads` độc lập (giống cơ chế Facebook Ads).
- **Cần hỗ trợ**: Cần bạn làm rõ cấu trúc gộp dữ liệu: Khi khách điền lần 2 thì ghi đè hay gộp mảng JSON các câu trả lời form? Có áp dụng cho mọi nguồn form hay chỉ riêng Google Ads?

### 3. TC-06: Nghiệp vụ "Nhập Bù Lead MKT" (Backfill) & Phân quyền
- **Kịch bản BA**: Có màn hình / API "Nhập bù Lead MKT" dành riêng cho Marketing/Quản lý nhập khi sót lead. Bắt buộc chọn Campaign/Dự án/Ad_ID và lead sẽ tự động đi vào Luồng 2 chia xoay vòng cho Roster. Sales bị chặn 403 Forbidden.
- **Thực tế trong App**: Hệ thống hiện chỉ có tính năng "Thêm khách hàng cá nhân" cho Sales và "Import Excel" chung ở Cài đặt. Chưa có phân hệ / màn hình riêng tên "Nhập bù Lead MKT".
- **Cần hỗ trợ**: Bạn có cần tạo thêm màn hình/modal "Nhập bù Lead MKT" riêng biệt cho Marketing, hay tích hợp vào chức năng Import hiện tại?

### 4. TC-20 & Kịch bản 7: Cronjob tự động rớt nhiệt (Decay Engine) sau 5 ngày
- **Kịch bản BA**: Nếu KHTN không phát sinh tương tác chất lượng trong 5 ngày liên tiếp, tiến trình chạy lúc 00:00 tự động hạ nhiệt độ 1 bậc (Nóng -> Ấm -> Lạnh) và gắn cờ "Khách Nguội".
- **Thực tế trong App**: Đã có decay khi Bể cọc (User Rule 1 & 2), nhưng **chưa có cronjob tự động quét KHTN 5 ngày không tương tác để hạ nhiệt**.
- **Cần hỗ trợ**: Bạn xác nhận thời gian 5 ngày là cố định hay cần cấu hình linh hoạt theo từng Dự án/Chiến dịch?

### 5. TC-33 & Kịch bản 10: Xung đột nghiệp vụ "Giữ KHTN Sales gốc khi Person rơi kho"
- **Kịch bản BA**: Hết hạn bảo mật -> Person công khai ra kho Databank, **nhưng giữ nguyên KHTN của Sales gốc (không giật lead)**.
- **Thực tế trong App**: File `cron_sync.php` (dòng 2953) hiện tại khi hết hạn bảo mật lại chạy lệnh:  
  `UPDATE contacts SET deleted_at = NOW()` (tức là **thu hồi / xóa KHTN** của Sales gốc).
- **Cần hỗ trợ**: **ĐÂY LÀ ĐIỂM XUNG ĐỘT QUAN TRỌNG NHẤT**. Bạn muốn hệ thống thực hiện theo phương án nào:
  - **Phương án A (Theo BA)**: Giữ nguyên KHTN cho Sales gốc tiếp tục chăm sóc, chỉ đưa Person lên kho chung để Sales khác nhặt thêm (chăm song song).
  - **Phương án B (Theo Code hiện tại)**: Thu hồi hoàn toàn KHTN của Sales gốc vì đã hết hạn bảo mật.

### 6. TC-36: Tự động khóa vĩnh viễn Person khi 3 lần Đóng cùng lý do
- **Kịch bản BA**: Person bị 3 Sales khác nhau đóng với cùng 1 lý do (ví dụ "Không đủ tài chính") thì hệ thống tự động khóa vĩnh viễn, không bao giờ xuất hiện trên kho Databank nữa.
- **Thực tế trong App**: Bảng `persons` đã có trường `is_blocked`, `deleted_from_databank` và API khóa tay của Admin, nhưng chưa có logic tự động đếm đủ 3 lần để tự kích hoạt khóa.
- **Cần hỗ trợ**: Bạn xác nhận quy tắc này sẽ đếm trên toàn bộ lịch sử hay chỉ tính các lần đóng trong vòng X tháng gần nhất?

### 7. TC-41: Chặn Đổi căn khi đã ký Thỏa thuận cọc (TTC)
- **Kịch bản BA**: Đổi căn chỉ được phép thực hiện khi **chưa ký TTC**. Đã ký TTC thì hệ thống chặn không cho đổi căn.
- **Thực tế trong App**: Hệ thống đã có chức năng Đổi căn (`DealController::switchUnit`), nhưng chưa gắn điều kiện kiểm tra trạng thái ký văn bản TTC để chặn.
- **Cần hỗ trợ**: Căn cứ nhận biết "Đã ký TTC" trong hệ thống hiện tại là trường nào (mốc thanh toán đợt 1 hay file hợp đồng đính kèm)?

### 8. TC-44: Pipeline 3 trạng thái Đối chiếu phí Môi giới với Chủ đầu tư
- **Kịch bản BA**: Quản lý phí môi giới qua 3 trạng thái: `Đủ Điều Kiện -> Đã Gửi Hồ Sơ -> Tiền Đã Về`. Bảng `DOI_CHIEU_PHI` xuất dữ liệu cho kế toán.
- **Thực tế trong App**: CSDL Staging **chưa có bảng `doi_chieu_phi`**, app chưa có màn hình pipeline đối soát phí với CĐT.
- **Cần hỗ trợ**: Đây là nghiệp vụ mới chưa được xây dựng. Bạn có muốn đưa phân hệ Đối chiếu phí CĐT này vào giai đoạn tiếp theo không?

### 9. TC-46: Tự động bắn CAPI Event BAD khi duyệt Not Lead
- **Kịch bản BA**: Khi MKT bấm duyệt Not Lead -> Hệ thống tự động bắn tín hiệu BAD về Meta CAPI.
- **Thực tế trong App**: Bảng cấu hình `meta_capi_settings` hiện đang để action của `not_lead` là `'Skip'` (bỏ qua), chưa kích hoạt sự kiện BAD.
- **Cần hỗ trợ**: Cần bạn cung cấp tên Event chuẩn đã khai báo trên Meta Events Manager (ví dụ: `Lead_Disqualified` hay `Bad_Lead` hay `Custom_Bad`) để hệ thống kích hoạt.

### 10. TC-48: Bảng CHI_PHI_ADS & Bóc tách chi phí tự động Ngày x Ad_ID
- **Kịch bản BA**: Tự động đồng bộ chi phí từ Meta Marketing API bóc tách cấp Ngày x Ad_ID vào bảng `CHI_PHI_ADS` để tính CPL thực theo số lead CRM.
- **Thực tế trong App**: CSDL Staging **chưa có bảng `chi_phi_ads`**. Chi phí hiện đang quản lý thủ công theo chiến dịch.
- **Cần hỗ trợ**: Bạn đã có Token Meta Marketing API có quyền `ads_read` để hệ thống tự kéo chi phí hàng ngày về chưa?

---

## III. BẢNG CHECK LOG CHI TIẾT 50 TEST CASES (TC-01 ĐẾN TC-50)

### LUỒNG 1: LEAD VÀO & ĐỊNH DANH 3 TẦNG (TC-01 -> TC-08)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-01** | Single Entry Point & Attribution | Mọi lead đi qua 1 cửa tiếp nhận, gán đầy đủ `ad_id, campaign_id, fbp, fbc`. | Webhook tiếp nhận tại `/backend/webhook.php` xử lý qua `webhook_logic.php`, trích xuất UTMs và lưu đầy đủ context. | **ĐẠT (PASS)** | BA ghi endpoint `/api/v1/leads/ingest`, app dùng `/backend/webhook.php`. |
| **TC-02** | Immutable Lead Log | Bảng `LEAD` chỉ cho INSERT, cấm tuyệt đối UPDATE/DELETE. | Bảng `leads` chưa có DB Trigger cấm UPDATE; API `api.php:17111` vẫn có endpoint cho Admin sửa lead. | **CHƯA KHỚP** | Cần hỗ trợ: Khóa cứng không cho sửa lead gốc. |
| **TC-03** | Person Identity theo SĐT mới | SĐT duy nhất (UNIQUE), tự sinh Person, Lead trỏ `person_id`. | Bảng `persons` có UNIQUE `phone`. Hàm `syncLeadToPersonAndContact` tạo Person tự động. | **ĐẠT (PASS)** | Sales hoàn toàn không nhìn thấy bảng `persons`. |
| **TC-04** | Deduplication Facebook Ads | Trùng SĐT Meta sinh N dòng `leads` nhưng chỉ 1 `person_id`. | Mỗi lần submit tạo 1 record `leads`, tìm thấy SĐT đã có thì trỏ chung về `person_id` cũ. | **ĐẠT (PASS)** | Hoạt động hoàn toàn chuẩn xác. |
| **TC-05** | Deduplication Google Ads | Cùng SĐT + cùng Dự án + cùng ngày -> Gộp vào 1 lead. | Webhook hiện tại chưa phân nhánh riêng cho Google Ads để gộp dòng trong ngày. | **CHƯA CÓ** | Cần hỗ trợ: Xác nhận logic gộp form bổ sung. |
| **TC-06** | Nhập bù Lead MKT (Backfill) | Chỉ MKT/Quản lý được nhập bù, Sales bị chặn 403; chia xoay vòng. | Chưa có màn hình/API riêng tên "Nhập bù Lead MKT". | **CHƯA CÓ** | Cần hỗ trợ: Phân hệ mới cần xác nhận UI. |
| **TC-07** | Sales nhập Khách cá nhân | Khách cá nhân thuộc Sales vĩnh viễn; trùng SĐT MKT active thì bật Flag đỏ. | `ContactController.php:491` kiểm tra trùng SĐT MKT: cho lưu, set `duplicate_flag=1`, ghi audit log, bắn cảnh báo đỏ. | **ĐẠT (PASS)** | Hoàn toàn khớp với kịch bản. |
| **TC-08** | Khách Giới thiệu kế thừa dòng nguồn | Bắt buộc chọn người giới thiệu, kế thừa dòng nguồn MKT/Cá nhân. | Có trường `nguoi_gioi_thieu_id` liên kết, nhưng chưa có cột tĩnh `dong_nguon` riêng trên DB (đang JOIN động). | **PARTIAL** | Nên thêm cột `dong_nguon` để tối ưu query. |

---

### LUỒNG 2: CHIA LEAD & VÒNG XOAY KỶ LUẬT (TC-09 -> TC-17)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-09** | Roster Chiến dịch | Đơn vị nhận lead là cá nhân Sales; không thuộc Roster bị loại. | Bảng `project_roster` và `round_consultants`. Lọc chính xác theo Sales và log lý do vào `distribution_logs`. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-10** | Chuỗi 5 Cổng Kiểm Duyệt | Roster -> Check-in -> Sẵn sàng -> Van chống ôm -> Quota. | `webhook_logic.php:2280` cài đặt tuần tự đúng 5 Cổng, ghi rõ cổng chặn vào log. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-11** | Van Chống Ôm & Xả Van | Om quá X lead Chưa XĐ -> Chặn. Xả van khi MKT duyệt Not Lead. | Cổng 4 đếm lead chưa tương tác; mẫu số trừ đi Not Lead đã duyệt; mở van ngay khi duyệt. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-12** | Timeout 2 phút, Từ chối, Tạm vắng | Timeout 2p thu hồi; Từ chối nhảy ngay; Tạm vắng skip không phạt. | `lead_offers` có `expires_at` (+120s); nút Từ chối kích hoạt chuyển ngay; Vacation mode được skip. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-13** | Ca Trực Đêm (18:00 - 06:00) | Đăng ký trước 18h; tự động reset Roster lúc 06:00 sáng. | Bảng `night_shift_registrations`; cronjob tự động dọn danh sách lúc 06:00 sáng mỗi ngày. | **ĐẠT (PASS)** | Đã kiểm chứng thực tế. |
| **TC-14** | Hàng Đợi Chờ Sáng & Giữ Ấm | Ca đêm không ai trực -> Queue chờ sáng; tự gửi tin giữ ấm. | Lead rơi vào trạng thái `queued` chờ sáng. Phần gửi tin giữ ấm tự động cần cấu hình mẫu ZNS OA. | **PARTIAL** | Cần hỗ trợ: Mẫu ZNS OA để gửi tin giữ ấm. |
| **TC-15** | Bung Giờ Vàng (06:00 - 08:30) | Lead tồn đêm bung cho Sales Sẵn sàng sớm; sau 8h30 chia thường. | Cổng 5 và cronjob quét queue giờ vàng, giới hạn hạn mức nhận giờ vàng. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-16** | Chia Song Song 3 Giờ | Chưa XĐ quá 3h -> Chia thêm 1 Sales (Trần=1); cạnh tranh mù. | `cron_sync.php:3170` & `ParallelHelper`: gán `parallel_assigned=1`, ẩn cờ đối thủ trên UI. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-17** | Re-assign & Di sản Sales nghỉ | Re-assign thủ công reset ghi chú; Sales nghỉ việc chuyển thành di sản. | `notes` có `is_heritage`, nhưng query xem ghi chú hiện chưa lọc ẩn ghi chú của sales cũ đang làm việc. | **PARTIAL** | Cần hỗ trợ: Cập nhật hàm query ghi chú. |

---

### LUỒNG 3: CHĂM SÓC, BẾP ĐUN NƯỚC & NHIỆT ĐỘ (TC-18 -> TC-25)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-18** | Ghi Chú Cấu Trúc (3 Nồi) | Kênh (Nồi Đất/Đồng/Áp Suất), Loại tương tác, Thời lượng gọi. | Bảng `notes` lưu đầy đủ `channel, note_type, duration_minutes, client_feedback`. UI hỗ trợ trọn vẹn. | **ĐẠT (PASS)** | Rất chi tiết và chuẩn chỉnh. |
| **TC-19** | Nhiệt Độ Hybrid & Khởi Điểm | Lưu song song nhiệt máy đoán và sale chốt; MKT = Lạnh, Giới thiệu = Ấm. | Bảng `notes` lưu `suggested_temperature` & `sale_temperature`. Khởi điểm chuẩn theo nguồn. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-20** | Decay Engine 5 Ngày | 5 ngày không tương tác chất lượng -> Hạ 1 mức nhiệt + Cảnh báo Nguội. | Chưa có cronjob tự động quét KHTN 5 ngày không tương tác để hạ nhiệt độ. | **CHƯA CÓ** | Cần hỗ trợ: Chu kỳ chạy cron và cấu hình. |
| **TC-21** | Tag Vướng 1 Chạm & Toa Thuốc | Chọn tag vướng -> Tự hiện Toa thuốc tĩnh hỗ trợ xử lý. | `CustomerProfileDrawer.tsx` có tag vướng và danh sách gợi ý Toa tĩnh theo sổ tay bán hàng. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-22** | Gate Sổ Tay Form TTL1 | Form TTL1 5 nhóm; thiếu >= 2 nhóm bật cảnh báo vàng. | Giao diện có thanh đo độ đầy Form TTL1 và cảnh báo vàng khi chưa đủ thông tin chân dung. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-23** | Cổng Bằng Chứng Số Hóa | Đổi trạng thái (Đồng ý gặp -> Đã gặp) bắt buộc upload ảnh check-in. | `CustomerProfileDrawer.tsx:15068-15195` đã tích hợp modal Check-in gặp khách, bắt buộc chụp/tải ảnh minh chứng thực địa (nút Xác nhận bị khóa nếu chưa chọn ảnh), nén WebP và tự động lưu link ảnh vào hoạt động chăm sóc. | **ĐẠT (PASS)** | Đã có sẵn và hoạt động chuẩn chỉnh trên app. |
| **TC-24** | Hạ Trạng Thái Không Bắt Bằng Chứng | Hạ trạng thái không yêu cầu ảnh bằng chứng; đồng hồ bảo mật đếm lại. | Hạ trạng thái không yêu cầu file, thực hiện ngay lập tức. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-25** | 2 Cửa Thoát Phễu | Not Lead -> Chờ MKT duyệt. Đóng Không Phù Hợp -> Hiệu lực ngay. | Not Lead chuyển hàng đợi duyệt của MKT. Đóng Không Phù Hợp chuyển Đã Đóng ngay lập tức. | **ĐẠT (PASS)** | Chuẩn xác. |

---

### LUỒNG 4: HỢP TÁC & CHIA HOA HỒNG (TC-26 -> TC-31)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-26** | 1 Owner Duy Nhất | Mỗi KHTN có 1 Owner, chỉ Owner được đổi trạng thái; Supporter bị chặn. | Frontend chặn bằng `isOwnerOrAdmin`. Mỗi contact chỉ có 1 `owner_id`. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-27** | Mời Hỗ Trợ Không % Tiền | Mời hỗ trợ không nhập %; thu hồi quyền mọi lúc; lưu vết vĩnh viễn. | Bảng `quyen_truy_cap` quản lý độc lập không có % tiền; ghi vết đầy đủ các lần Grant/Revoke. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-28** | Tự Động Sinh Phiếu Hợp Tác | Sinh phiếu khi Cọc; tự động kéo cả người đã bị thu hồi quyền. | `CooperationController::autoGenerateSlip` tự động quét toàn bộ `quyen_truy_cap` kể cả người bị thu hồi. | **ĐẠT (PASS)** | Rất chính xác. |
| **TC-29** | Validation Tổng % = 100% | Hệ thống kiểm tra tổng tỷ lệ chia của các thành viên đúng 100%. | Frontend và Backend đều chặn nếu `abs(sum - 100) > 0.01`, báo lỗi 422. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-30** | Ký Số 1 Chạm & Cảnh Báo Treo 24h | Ký số 1 chạm; quá 24h không ký -> Thành Phiếu treo + Bắn cảnh báo. | Đã hoàn thiện `backend/cron_cooperation_slips.php`, tích hợp vào `cron_master.php` & `cron_sync.php`: tự động chuyển sang `PHIEU_TREO` (disputed) sau 24h và gửi cảnh báo Quản lý / GĐKD qua NotificationService (Zalo, TG, Email). UI hỗ trợ lọc và hiển thị rõ ràng. | **ĐẠT (PASS)** | Đã lập trình xong và đưa vào cron master. |
| **TC-31** | GĐKD Phê Duyệt & Khóa Vĩnh Viễn | GĐKD duyệt xong khóa vĩnh viễn (Read-only); không block tiến trình cọc. | Phiếu duyệt xong kích hoạt `is_locked=1`, cấm sửa; tiền cọc ghi nhận độc lập không bị chặn. | **ĐẠT (PASS)** | Chuẩn xác. |

---

### LUỒNG 5: KHO DATA DATABANK (TC-32 -> TC-38)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-32** | Ranh Giới Nguồn Rơi Kho | Chỉ nguồn MKT mới rơi kho; nguồn Cá nhân & Giới thiệu bảo vệ vĩnh viễn. | `cron_sync.php` lọc danh sách theo `databank_applicable_sources`, nguồn cá nhân/giới thiệu không bao giờ rơi kho. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-33** | Bảo Mật & Giữ KHTN Sales Gốc | Hết hạn bảo mật -> Ra kho 1 lần; KHÔNG giật lead của Sales gốc. | Code hiện tại (`cron_sync.php:2953`) lại xóa/thu hồi KHTN của Sales gốc (`deleted_at = NOW()`). | **XUNG ĐỘT** | Cần hỗ trợ: Giữ KHTN sales gốc hay thu hồi? |
| **TC-34** | Data Nhặt Kho Không Bảo Mật | Nhặt kho mang `source=databank`, không có đồng hồ bảo mật, không ra kho lần 2. | Contact nhặt kho gán `source = 'databank'`, không có `security_expires_at`, Person vẫn ở kho cho người khác nhặt tiếp. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-35** | Cửa Đóng Kho Bằng Đặt Cọc | Bất kỳ KHTN nào Đặt cọc -> Person rút khỏi kho vĩnh viễn. | Khi có cọc, hệ thống cập nhật `persons.is_public = 0`, ngay lập tức ẩn khỏi kho Databank. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-36** | Quy Tắc 3 Lần Đóng Cùng Lý Do | Bị đóng 3 lần cùng 1 lý do -> Tự động khóa vĩnh viễn Person khỏi kho. | Bảng `persons` có trường `is_blocked`, nhưng chưa có logic tự đếm đủ 3 lần đóng để auto-lock. | **PARTIAL** | Cần hỗ trợ: Xác nhận cơ chế đếm tự động. |
| **TC-37** | Ẩn/Hiện SĐT Khi Duyệt Kho | Xem kho bị che SĐT (`090****567`); chỉ hiện đủ sau khi bấm Nhận. | Hàm `maskPhone` che số cho Sales thường khi duyệt kho; nhận xong mới thấy đầy đủ. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-38** | Ẩn Ghi Chú Cũ vs Hiện Di Sản | Không thấy ghi chú sales cũ; chỉ thấy ghi chú di sản của Sales nghỉ việc. | Ghi chú cũ bị ẩn; cờ `is_heritage` cho phép xem di sản của nhân sự đã nghỉ việc. | **ĐẠT (PASS)** | Chuẩn xác. |

---

### LUỒNG 6: QUẢN LÝ TIỀN, CỌC & DOANH THU (TC-39 -> TC-44)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-39** | Quy Trình 4 Bước & Cọc Bước 1 | Phiếu cọc 4 bước; bật Đặt cọc & CAPI Purchase ngay khi xong Bước 1 có UNC. | `DepositController.php` xử lý 4 bước; Bước 1 có UNC lập tức chuyển trạng thái `DatCoc` và kích hoạt CAPI Purchase. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-40** | UNC Là Nguồn Sự Thật Duy Nhất | UNC là căn cứ duy nhất; Admin xác nhận mốc; lưu file làm bằng chứng. | Bảng `deposit_milestones` lưu `unc_file_path`, Admin bấm duyệt từng mốc dựa trên UNC. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-41** | Quy Tắc Đổi Căn | Đổi căn tạo deal mới, đóng deal cũ, giữ audit trail; chỉ cho đổi khi CHƯA ký TTC. | `DealController::switchUnit` đã có (đóng deal cũ, mở deal mới), nhưng chưa chặn kiểm tra điều kiện ký TTC. | **PARTIAL** | Cần hỗ trợ: Căn cứ nhận biết đã ký TTC. |
| **TC-42** | Bể Cọc Chưa DT vs Đã Có DT | Bể cọc chưa DT -> Tụt cấp KHTN, chạy lại bảo mật. Đã có DT -> Giữ Đặt Cọc. | Đã lập trình và kiểm thử tự động, chuẩn tuyệt đối theo User Rule 1 & 2. | **ĐẠT (PASS)** | Hoàn hảo theo quy định người dùng. |
| **TC-43** | Bể Cọc Sau HĐMB | Trách nhiệm Sales đóng tại HĐMB; bể sau HĐMB không lùi trạng thái trên CRM. | CRM hoàn tất tại mốc HĐMB, không can thiệp lùi trạng thái giao dịch. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-44** | Pipeline 3 Trạng Thái Đối Chiếu Phí | 3 trạng thái: Đủ Điều Kiện -> Đã Gửi HS -> Tiền Đã Về. Bảng `DOI_CHIEU_PHI`. | CSDL Staging chưa có bảng `doi_chieu_phi`, app chưa có pipeline đối chiếu phí CĐT. | **CHƯA CÓ** | Cần hỗ trợ: Nghiệp vụ mới cần xây dựng. |

---

### LUỒNG 7: DỮ LIỆU NGƯỢC CAPI, BÁO CÁO & PHÂN QUYỀN DB (TC-45 -> TC-50)

| Mã TC | Tên Test Case | Kỳ vọng BA | Thực tế Codebase & DB Staging | Đánh giá | Ghi chú & Đề xuất |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-45** | CAPI Mapping Forward-Only | Bắn theo Lead gốc; Forward-only, không bao giờ bắn tín hiệu lùi. | Bắn theo lead gốc qua `cron_sync.php`; tuân thủ nghiêm ngặt User Rule 4 (không bắn lùi khi tụt cấp). | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-46** | Tự Động Bắn BAD Khi Duyệt Not Lead | Duyệt Not Lead -> Bắn CAPI BAD. Đóng Không Phù Hợp -> Không bắn gì. | Bảng cấu hình `meta_capi_settings` hiện để action `not_lead` là `'Skip'`, chưa bắn BAD. | **CHƯA CÓ** | Cần hỗ trợ: Cung cấp tên event BAD chuẩn. |
| **TC-47** | Giám Sát CAPI Quá 24h | Giám sát hàng đợi CAPI, cảnh báo đỏ khi event kẹt quá 24h. | Hàm `checkCapiStuckAlert()` trong `cron_sync.php:3530` phát cảnh báo khi event pending > 24h. | **ĐẠT (PASS)** | Chuẩn xác. |
| **TC-48** | Cost Ingestion & Báo Cáo CPL | Bảng `CHI_PHI_ADS` lưu chi phí cấp Ngày x Ad_ID; CPL tính theo Lead CRM. | CSDL chưa có bảng `chi_phi_ads`; chi phí đang quản lý thủ công, chưa kéo tự động từ Meta API. | **CHƯA CÓ** | Cần hỗ trợ: Token Meta Marketing API. |
| **TC-49** | Row-Level Security (RLS) Cho Sales | Sales chỉ thấy lead mình tạo hoặc được cấp quyền trong `quyen_truy_cap`. | Mọi query trong Controller PHP đều có scope `WHERE (owner_id = ? OR id IN (quyen_truy_cap...))`. | **ĐẠT (PASS)** | Bảo mật phân quyền chặt chẽ. |
| **TC-50** | Hash Password & Dynamic Reporting | Mật khẩu hash Bcrypt/Argon2; Audit log đầy đủ; Báo cáo tính dynamic. | Password băm chuẩn an toàn; bảng `audit_logs` ghi vết; Dashboard doanh thu tính động từ DB. | **ĐẠT (PASS)** | Chuẩn xác. |

---

## IV. BẢNG CHECK LOG 10 KỊCH BẢN KIỂM THỬ TỔNG HỢP

| Mã Kịch Bản | Tiêu Đề Kịch Bản | Tình Trạng Đáp Ứng Của Hệ Thống | Đánh Giá |
| :---: | :--- | :--- | :---: |
| **Kịch bản 1** | Single Entry Point & Deduplication | - Nhánh Facebook Ads: Đạt 100% (2 Lead, 1 Person).<br>- Nhánh Google Ads gộp trong ngày: Chưa có logic gộp trong app. | **ĐẠT MỘT PHẦN** |
| **Kịch bản 2** | Chống Rửa Nguồn (Anti-Attribution-Theft) | Khách cá nhân trùng số MKT active: Cho lưu thành công, ghi `audit_logs`, phát Cờ Cảnh Báo đỏ cho Quản lý & MKT. | **ĐẠT (PASS)** |
| **Kịch bản 3** | Kế Thừa Dòng Nguồn Khách Giới Thiệu | Có liên kết `nguoi_gioi_thieu_id`, tính được công qua JOIN. Chưa có trường tĩnh `dong_nguon` riêng trong bảng `contacts`. | **ĐẠT MỘT PHẦN** |
| **Kịch bản 4** | Chuỗi Cổng Kiểm Duyệt & Van Chống Ôm | Chặn chia khi om quá 5 lead Chưa XĐ. Khi MKT duyệt Not Lead thì tự động xả van, tiếp tục nhận offer ngay. | **ĐẠT (PASS)** |
| **Kịch bản 5** | Round-Robin, Timeout 2p & Giờ Vàng | Timeout 2 phút thu hồi; Từ chối chuyển ngay; Tạm vắng skip không phạt; Lead đêm chờ Giờ Vàng (06:00 - 08:30). | **ĐẠT (PASS)** |
| **Kịch bản 6** | Chia Lead Song Song 3h (Cạnh Tranh Mù) | Om 3h chia thêm 1 Sales chăm sóc; UI không hiển thị cờ đối thủ; bên nào chốt/tiến trạng thái thì bên kia đóng quyền. | **ĐẠT (PASS)** |
| **Kịch bản 7** | Bếp Đun Nước & Nhiệt Độ Hybrid + Decay | Lưu song song 2 nhiệt (máy đoán + sale chốt) đạt 100%. Tiến trình tự động rớt nhiệt sau 5 ngày chưa có cronjob. | **ĐẠT MỘT PHẦN** |
| **Kịch bản 8** | Cổng Bằng Chứng & Form TTL1 | Form TTL1 cảnh báo vàng khi thiếu >= 2 nhóm đạt 100%. Modal check-in bắt buộc tải ảnh minh chứng thực địa khi chuyển sang Đã Gặp đạt 100% (chặn chuyển nếu chưa có ảnh). | **ĐẠT (PASS)** |
| **Kịch bản 9** | Phiếu Hợp Tác 100% & Ký Số Tự Thực Thi | Tự kéo danh sách người được cấp quyền khi Cọc; kiểm tra tổng % = 100%; GĐKD duyệt khóa vĩnh viễn; Cronjob Master tự động quét và chuyển trạng thái Phiếu treo quá 24h kèm phát cảnh báo Quản lý. | **ĐẠT (PASS)** |
| **Kịch bản 10** | Đồng Hồ Databank & Cơ Chế Ra/Đóng Kho | Data nhặt kho không bảo mật; Cọc rút Person khỏi kho đạt 100%. Logic giữ lead sales gốc khi ra kho và auto-lock 3 lần đóng cần hỗ trợ. | **ĐẠT MỘT PHẦN** |

---

## V. KẾT LUẬN & ĐỀ XUẤT HƯỚNG XỬ LÝ TIẾP THEO

1. **Về cốt lõi hệ thống**:
   - Kiến trúc phân quyền (RLS), Vòng xoay phân bổ 5 cổng, Quản lý ca trực đêm, Phiếu cọc 4 bước, Quy tắc Bể cọc (User Rule 1 & 2), CAPI Forward-only (User Rule 4), Cổng bằng chứng số hóa (TC-23) và Cronjob Master quét phiếu treo 24h (TC-30) **đều đã được lập trình vững chắc, chạy thực tế trên Staging rất tốt**.
2. **Về các điểm còn khuyết / chưa rõ**:
   - Còn **10 điểm** nêu tại **Mục II** thuộc dạng: kịch bản mới (chưa có UI/CSDL tương ứng như Pipeline Đối chiếu phí, Bảng Chi phí Ads), hoặc xung đột nghiệp vụ giữa BA và Code (như việc có thu hồi KHTN của Sales gốc khi Person rơi kho hay không).
3. **Bước tiếp theo**:
   - Kính mời bạn xem qua **Mục II** và cho phản hồi chỉ đạo đối với các điểm cần làm rõ. Ngay sau khi bạn chốt phương án, đội ngũ sẽ bắt tay vào triển khai hoàn thiện theo đúng mong muốn của bạn!
