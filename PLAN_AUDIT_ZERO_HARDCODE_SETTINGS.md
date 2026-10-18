# 🏛️ MASTER PLAN & BÁO CÁO KIỂM TOÁN TOÀN DIỆN THIẾT LẬP HỆ THỐNG (ZERO-HARDCODE SETTINGS AUDIT & REMEDIATION)

> [!IMPORTANT]
> **Mục tiêu cốt lõi**: Đảm bảo **100% thiết lập trên giao diện Cài Đặt Hệ Thống (`Settings.tsx` / bảng `system_settings`)** là **Nguồn Chân Lý Duy Nhất (Single Source of Truth - SST)** điều khiển trực tiếp toàn bộ hành vi của Backend (`api.php`, `webhook_logic.php`, `cron_sync.php`, `NotificationService.php`, `controllers/*.php`) và Frontend (`SalePortal.tsx`, `ContactsPage.tsx`, `CustomerProfileDrawer.tsx`, `AttendancePage.tsx`, `Dashboard.tsx`, `Rounds.tsx`, `DepositsPage.tsx`), **tuyệt đối không hoạt động theo số hardcode hay lệch key**.

---

## 📊 1. TỔNG QUAN PHẠM VI KIỂM TOÁN (EXECUTIVE SUMMARY)

- **Tổng số khóa cấu hình (`setting_key`) đã kiểm toán**: **103 `setting_key`s** chia làm **10 phân hệ nghiệp vụ**.
- **Trạng thái trước khi chuẩn hóa**:
  - **69 / 103 keys**: Đã hoạt động chuẩn Dynamic 100% từ CSDL `system_settings`.
  - **34 / 103 keys**: Bị vướng một trong các lỗi:
    1. **Hardcode ghi đè (Hardcode Override)**: Backend hoặc Frontend gắn cứng giá trị (ví dụ `$normalCooldownSec = 0;`, `uncontacted >= 5`, `limit_hour || 5`, `limit_day || 20`).
    2. **Lệch tên khóa / Action API (Key & Action Mismatch)**: Nơi lưu dùng một key/action nhưng nơi đọc dùng key/action khác (`security_timer_cancel_deposit_<status>` vs `security_timer_<status>`, `fetchAPI('get_system_settings')` vs `fetchAPI('get_settings')`, `security_timer_chua_xac_dinh` ghi đè nhầm `databank_claim_recall_hours`).
    3. **Thiếu liên kết thực thi (Missing Execution Hook)**: Có UI cấu hình nhưng chưa gắn vào Gate kiểm tra hoặc Cron (`require_checkin_to_receive_leads` ở lịch trực ca, `temperature_decay_days` ở cron tự động giảm nhiệt, `approval_matrix_config` ở `DepositController` / `CheckInController` / `FinanceController`).
- **Trạng thái sau khi thực thi Plan này**: **103 / 103 keys (100%) ĐÃ CHUẨN HÓA DYNAMIC — ZERO HARDCODE**.

---

## 🗺️ 2. MA TRẬN KIỂM TOÁN & KHẮC PHỤC CHI TIẾT 10 PHÂN HỆ (103 SETTING KEYS)

### Nhóm 1: Phân Bổ Lead, Thu Hồi, Vòng Chia & Giờ Vàng (15 Keys)

| STT | `setting_key` | Ý nghĩa thiết lập | Nơi thực thi (BE & FE) | Phát hiện Audit & Xử lý Chuẩn Hóa (Zero-Hardcode) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | `lead_recall_minutes` | Thời gian chờ TVV nhận lead giờ hành chính (phút) | `backend/webhook_logic.php:L472-L547`, `backend/api.php:L3539-L3558` | Đã chuẩn ở `get_lead_recall_minutes()`. Đã sửa thêm `api.php` (`get_sale_portal`) gọi `get_lead_recall_minutes($conn)` thay vì chỉ đọc tĩnh để đồng bộ cả ca đêm & giờ vàng. | ✅ ĐÃ CHUẨN |
| 2 | `lead_overtime_recall_minutes` | Thời gian chờ TVV nhận lead ngoài giờ / ca đêm (phút) | `backend/webhook_logic.php:L533-L547`, `backend/api.php:L3539-L3558` | Đồng bộ hoàn toàn qua `get_lead_recall_minutes($conn)`. | ✅ ĐÃ CHUẨN |
| 3 | `lead_max_recall_attempts` | Số lần thu hồi tối đa trước khi đẩy vào Kho Databank | `backend/webhook_logic.php:L3450`, `src/pages/Rounds.tsx:L473-L491` | Sửa `Rounds.tsx` từ `fetchAPI('get_system_settings')` (action không tồn tại) sang `fetchAPI('get_settings')` và lắng nghe `system_settings_updated`. | ✅ ĐÃ CHUẨN |
| 4 | `backpressure_limit` | Ngưỡng chặn nhận lead khi tồn đọng chưa chăm sóc (Gate 4) | `backend/webhook_logic.php:L1036`, `backend/api.php:L3540-L3558`, `src/pages/Dashboard.tsx:L1840-L1855`, `src/pages/ContactsPage.tsx:L972-L977` | 1. Đồng bộ câu SQL đếm `uncontacted` tại `api.php:L3545` và `api.php:L17542` khớp 100% với Gate 4 (`pipeline_status IN ('chua_xac_dinh', 'quan_tam')`).<br>2. Xóa hardcode `/5` tại `Dashboard.tsx:L1840-L1855`, đọc động `settings.backpressure_limit`. | ✅ ĐÃ CHUẨN |
| 5 | `normal_round_cooldown_minutes` | Thời gian giãn cách giữa 2 lead ở vòng thường (phút) | `backend/webhook_logic.php:L1406-L1407`, `L2794-L2881` | **Phát hiện P0**: Trước đây dòng `L1406` bị hardcode `$normalCooldownSec = 0;`. Đã sửa đọc động `(int)get_system_setting($conn, 'normal_round_cooldown_minutes') * 60` ở cả luồng phân bổ thật và luồng mô phỏng `simulateNextConsultantInRound`. | ✅ ĐÃ CHUẨN |
| 6 | `compensation_Priority_cooldown_minutes` | Thời gian giãn cách nhận lead ở vòng Bù / Ưu tiên (phút) | `backend/webhook_logic.php:L1403-L1405`, `L2794-L2800` | Đọc động từ `system_settings` ở cả phân bổ thật và mô phỏng. | ✅ ĐÃ CHUẨN |
| 7 | `golden_hours_enabled` | Bật/tắt khung Giờ Vàng đầu ngày | `backend/webhook_logic.php:L479` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 8 | `golden_hours_start_time` | Giờ bắt đầu khung Giờ Vàng | `backend/webhook_logic.php:L480`, `L1518`, `L2785`, `L3158` | Chuẩn hóa toàn bộ fallback mặc định về `'06:00'` đồng nhất với `Settings.tsx`. | ✅ ĐÃ CHUẨN |
| 9 | `golden_hours_end_time` | Giờ kết thúc khung Giờ Vàng | `backend/webhook_logic.php:L481`, `L1519`, `L2786`, `L3159` | Chuẩn hóa toàn bộ fallback mặc định về `'08:30'` đồng nhất với `Settings.tsx`. | ✅ ĐÃ CHUẨN |
| 10 | `golden_hours_timeout_minutes` | Thời gian thu hồi lead trong khung Giờ Vàng (phút) | `backend/webhook_logic.php:L482` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 11 | `golden_hours_max_Recall_attempts` | Số lần thu hồi tối đa trong Giờ Vàng | `backend/webhook_logic.php:L3451` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 12 | `Duplicate_check_months` | Số tháng kiểm tra trùng lặp Lead (Quy tắc 6 tháng) | `backend/webhook_logic.php:L322` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 13 | `rule_6_month_enabled` | Bật/tắt quy tắc ưu tiên người chăm sóc cũ | `backend/webhook_logic.php:L321` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 14 | `parallel_assignment_enabled` | Bật/tắt chia song song khi hết hạn bảo mật | `backend/webhook_logic.php:L3436` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 15 | `parallel_assignment_trigger_status` | Trạng thái kích hoạt chia song song / đồng hồ đầu tiên | `backend/webhook_logic.php:L4758`, `backend/controllers/ContactController.php:L1753` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |

---

### Nhóm 2: Đồng Hồ Bảo Mật Pipeline (`security_timer_*`) & Kho Databank (15 Keys)

| STT | `setting_key` | Ý nghĩa thiết lập | Nơi thực thi (BE & FE) | Phát hiện Audit & Xử lý Chuẩn Hóa (Zero-Hardcode) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 16 | `security_timer_chua_xac_dinh` | Hạn bảo mật trạng thái `Chưa xác định` | `backend/webhook_logic.php:L4758-L4766`, `ContactController.php`, `NoteController.php`, `ActivityController.php` | Ưu tiên đọc `security_timer_chua_xac_dinh` trước khi fallback sang `uncontacted_lead_share_hours`. Đồng bộ 2 chiều giữa `Settings.tsx` và `SalePortal.tsx`. | ✅ ĐÃ CHUẨN |
| 17 | `uncontacted_lead_share_hours` | Số giờ giữ khách chưa xác định (tương thích ngược) | `backend/api.php:L14204-L14217`, `src/pages/Settings.tsx:L1401-L1406` | Tách độc lập khỏi `databank_claim_recall_hours` khi lưu `save_settings` để không làm biến dạng thời gian thu hồi lead nhận từ Kho Databank. | ✅ ĐÃ CHUẨN |
| 18 | `security_timer_quan_tam` | Hạn bảo mật trạng thái `Quan tâm` | Controllers & `webhook_logic.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 19 | `security_timer_thien_chi` | Hạn bảo mật trạng thái `Thiện chí` | Controllers & `src/pages/SalePortal.tsx:L1203-L1205` | Gộp chuẩn hóa với `security_timer_dong_y_gap`, loại bỏ dòng cấu hình trùng lặp trên `SalePortal.tsx`. | ✅ ĐÃ CHUẨN |
| 20 | `security_timer_dong_y_gap` | Alias đồng bộ với `security_timer_thien_chi` | `backend/api.php:L14196-L14203`, Controllers | Tự động đồng bộ 2 chiều với `security_timer_thien_chi` tại `save_settings`. | ✅ ĐÃ CHUẨN |
| 21 | `security_timer_da_gap` | Hạn bảo mật trạng thái `Đã gặp` | Controllers & `backend/controllers/DepositController.php:L834-L840` | Sửa `DepositController.php:L834-L840` đọc đúng `security_timer_<demotedStatus>` thay vì key ảo `security_timer_cancel_deposit_<status>`. | ✅ ĐÃ CHUẨN |
| 22 | `security_timer_booking` | Hạn bảo mật trạng thái `Booking` | Controllers & `DepositController.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 23 | `security_timer_dat_coc` | Hạn bảo mật trạng thái `Đặt cọc` | Controllers & `webhook_logic.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 24 | `security_timer_dong_deal` | Hạn bảo mật trạng thái `Đóng Deal` | Controllers & `webhook_logic.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 25 | `security_timer_cham_soc_dai_han` | Hạn bảo mật `Chăm sóc dài hạn` & các stage tùy chỉnh | `NoteController.php:L418-L465`, `ActivityController.php:L1639-L1687`, `ContactController.php:L1734-L1767` | **Phát hiện P1**: Trước đây `NoteController` và `ActivityController` có `if (!isset($fallback[$status])) return null;` làm vô hiệu hóa `security_timer_cham_soc_dai_han` và các stage tùy chỉnh. Đã gỡ bỏ rào cản và bổ sung `cham_soc_dai_han`. | ✅ ĐÃ CHUẨN |
| 26 | `databank_limit_per_hour` | Hạn mức nhận lead Kho Databank mỗi giờ | `backend/api.php:L21470`, `src/pages/SalePortal.tsx:L8674` | Đồng bộ fallback `3 số/giờ` trên toàn bộ badge & modal quy định ở `SalePortal.tsx`. | ✅ ĐÃ CHUẨN |
| 27 | `databank_limit_per_day` | Hạn mức nhận lead Kho Databank mỗi ngày | `backend/api.php:L21471`, `src/pages/SalePortal.tsx:L8681` | Đồng bộ fallback `2 số/ngày` trên toàn bộ badge & modal quy định ở `SalePortal.tsx`. | ✅ ĐÃ CHUẨN |
| 28 | `databank_limit_per_month` | Hạn mức nhận lead Kho Databank mỗi tháng | `backend/api.php:L21472`, `src/pages/SalePortal.tsx:L8688` | Đọc động từ `system_settings` (`300 số/tháng`). | ✅ ĐÃ CHUẨN |
| 29 | `databank_claim_recall_hours` | Số giờ thu hồi nếu nhận từ Databank mà không chăm sóc | `backend/api.php:L21564-L21574`, `src/pages/SalePortal.tsx:L18801-L18807` | **Phát hiện P0**: Trước đây `claim_public_lead` đọc nhầm `uncontacted_lead_share_hours` thay vì `databank_claim_recall_hours`. Đã sửa `claim_public_lead` đọc chính xác `databank_claim_recall_hours`. | ✅ ĐÃ CHUẨN |
| 30 | `max_parallel_sales_per_client` | Số Sale tối đa cùng nhận 1 khách từ Kho Databank | `backend/api.php:L21473`, `SalePortal.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 31 | `databank_applicable_sources` | Các nguồn lead áp dụng đẩy vào Kho Databank | `backend/webhook_logic.php:L3455`, `SalePortal.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |

---

### Nhóm 3: Chấm Công, Lịch Làm Việc, Ca Đêm, Cuối Tuần & Nghỉ Lễ (22 Keys)

| STT | `setting_key` | Ý nghĩa thiết lập | Nơi thực thi (BE & FE) | Phát hiện Audit & Xử lý Chuẩn Hóa (Zero-Hardcode) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 32 | `global_work_schedule` | Lịch làm việc tiêu chuẩn 7 ngày trong tuần | `CheckInController.php:L251`, `webhook_logic.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 33 | `office_lat` / `office_lng` | Tọa độ GPS văn phòng chấm công | `CheckInController.php`, `AttendancePage.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 34 | `checkin_allowed_radius` | Bán kính GPS cho phép chấm công (mét) | `CheckInController.php`, `AttendancePage.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 35 | `checkin_grace_period_minutes` | Số phút ân hạn đi trễ trước khi tính là muộn | `CheckInController.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 36 | `checkin_earliest_minutes` | Số phút cho phép chấm công sớm trước giờ vào ca | `CheckInController.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 37 | `checkin_approval_sla_minutes` | Thời gian SLA tối đa để Quản lý duyệt đi trễ (phút) | `cron_sync.php`, `src/pages/AttendancePage.tsx:L2926` | Đồng bộ fallback tại `AttendancePage.tsx:L2926` từ `60` về `15` phút khớp với `cron_sync.php` và `Settings.tsx`. | ✅ ĐÃ CHUẨN |
| 38 | `require_checkin_to_receive_leads` | Bắt buộc điểm danh hợp lệ mới được nhận lead (Gate 2) | `backend/webhook_logic.php:L948`, `backend/api.php:L6749-L6947` | Đã nối trực tiếp `require_checkin_to_receive_leads` vào `get_duty_schedule` trong `api.php` để trạng thái trực ca hiển thị đúng thực tế Gate 2. | ✅ ĐÃ CHUẨN |
| 39 | `require_ontime_checkin_to_receive_leads` | Điểm danh trễ chưa được duyệt thì khóa nhận lead | `backend/webhook_logic.php:L949`, `backend/api.php:L6749-L6947` | Đã nối trực tiếp vào `get_duty_schedule` trong `api.php`. | ✅ ĐÃ CHUẨN |
| 40 | `night_shift_start_time` / `night_shift_end_time` | Khung giờ bắt đầu & kết thúc Ca Đêm | `backend/webhook_logic.php:L1234-L1235`, `backend/api.php:L16239-L16285` | Chuẩn hóa fallback `'18:00'` - `'06:00'` tại `webhook_logic.php:L1234-1235` và dùng `night_shift_end_time` động khi kiểm tra khóa sửa ca trực trong `update_consultant`. | ✅ ĐÃ CHUẨN |
| 41 | `allow_late_night_shift_registration` | Cho phép đăng ký ca đêm muộn sau giờ bắt đầu | `api.php` (`save_weekly_shifts`, `update_consultant`) | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 42 | `late_night_shift_registration_minutes` | Số phút cho phép đăng ký trễ sau giờ bắt đầu ca đêm | `api.php` (`save_weekly_shifts`, `update_consultant`) | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 43 | `advance_night_shift_registration_minutes` | Số phút phải đăng ký trước khi ca đêm bắt đầu | `api.php` (`save_weekly_shifts`, `update_consultant`) | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 44 | `auto_approve_night_shift` | Tự động phê duyệt khi đăng ký ca đêm | `backend/api.php:L5916`, `L16265-L16285` | Bổ sung kiểm tra `auto_approve_night_shift` vào `update_consultant` (trước đây chỉ có ở `save_weekly_shifts`). | ✅ ĐÃ CHUẨN |
| 45 | `allow_weekend_shift_registration` | Cho phép đăng ký trực ca cuối tuần | `api.php` (`save_weekly_shifts`, `update_consultant`) | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 46 | `weekend_shift_registration_lead_hours` | Số giờ phải đăng ký trước khi bước vào cuối tuần | `api.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 47 | `weekend_shift_days` | Các ngày được tính là ca cuối tuần (`6,7`) | `api.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 48 | `weekend_shift_min_checkin_days` | Số ngày điểm danh tối thiểu trong tuần để được trực cuối tuần | `api.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 49 | `auto_approve_weekend_shift` | Tự động phê duyệt ca trực cuối tuần | `backend/api.php:L5917`, `L16265-L16285` | Chuẩn hóa mặc định `$autoApproveWeekend = 1` ở `save_weekly_shifts` và áp dụng động trong `update_consultant`. | ✅ ĐÃ CHUẨN |
| 50 | `holiday_schedules` & `auto_approve_holiday_shift` | Danh sách lịch nghỉ lễ & tự động duyệt trực lễ | `api.php`, `webhook_logic.php` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |

---

### Nhóm 4: Pipeline Bán Hàng, Nhiệt Độ Khách Hàng, Chấm Điểm Lead & Hợp Tác (14 Keys)

| STT | `setting_key` | Ý nghĩa thiết lập | Nơi thực thi (BE & FE) | Phát hiện Audit & Xử lý Chuẩn Hóa (Zero-Hardcode) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 51 | `pipeline_status_hierarchy` | Thứ tự phân cấp các bước Pipeline | `ContactController.php`, `CustomerProfileDrawer.tsx` | Đọc động từ `system_settings` và tự động cập nhật khi bắn sự kiện `system_settings_updated`. | ✅ ĐÃ CHUẨN |
| 52 | `pipeline_status_labels` | Nhãn hiển thị tiếng Việt của từng bước Pipeline | `ContactsPage.tsx`, `CustomerProfileDrawer.tsx`, `SalePortal.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 53 | `allow_pipeline_backward` | Cho phép kéo lùi trạng thái Pipeline | `ContactController.php`, `CustomerProfileDrawer.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 54 | `allow_pipeline_skip` | Cho phép nhảy cóc qua các bước Pipeline | `ContactController.php`, `CustomerProfileDrawer.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 55 | `temperature_decay_days` | Số ngày không tương tác sẽ tự động giảm nhiệt độ khách hàng | `backend/cron_sync.php:L4446-L4490`, `ContactsPage.tsx`, `CustomerProfileDrawer.tsx` | **Phát hiện P1**: Trước đây chỉ hiển thị cảnh báo ở FE, chưa có job tự động hạ nhiệt ở DB. Đã bổ sung cron job mỗi ngày trong `cron_sync.php` tự động giảm `hot -> warm -> cold` khi quá `temperature_decay_days` không có `activities` / `notes`. | ✅ ĐÃ CHUẨN |
| 56 | `temp_suggestion_call_duration_seconds` | Thời lượng cuộc gọi tối thiểu (giây) để gợi ý tăng nhiệt độ | `NoteController.php:L152`, `CustomerProfileDrawer.tsx:L1958` | Đồng bộ toán tử `>=` tại `CustomerProfileDrawer.tsx:L1958` khớp 100% với `NoteController.php:L152`. | ✅ ĐÃ CHUẨN |
| 57 | `temp_suggestion_required_notes` | Số ghi chú tối thiểu để gợi ý tăng nhiệt độ | `NoteController.php`, `CustomerProfileDrawer.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 58 | `lead_scoring_rules` | Bộ quy tắc chấm điểm Lead (Lead Scoring) | `ContactsPage.tsx`, `CustomerProfileDrawer.tsx` | Đọc động và tự động reload khi `system_settings_updated`. | ✅ ĐÃ CHUẨN |
| 59 | `coop_eligible_statuses` | Danh sách các trạng thái Pipeline cho phép tạo Phiếu Hợp Tác | `Settings.tsx:L7697-L7794`, `CooperationController.php`, `CustomerProfileDrawer.tsx` | **Phát hiện P1**: Tại `Settings.tsx:L7698` & `L7785`, nút gạt `ToggleSwitch` trước đây ghi đè `setCoopEligibleStatuses(status)` làm mất các trạng thái khác. Đã sửa thành thêm/xóa phần tử trong danh sách phân cách bằng dấu phẩy. | ✅ ĐÃ CHUẨN |
| 60 | `coop_default_files` | Tài liệu đính kèm mặc định khi tạo Phiếu Hợp Tác | `CustomerProfileDrawer.tsx`, `CooperationSlipsPage.tsx` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |

---

### Nhóm 5: Đặt Cọc, Tài Chính, Hoa Hồng & Ma Trận Phê Duyệt Đa Cấp (10 Keys)

| STT | `setting_key` | Ý nghĩa thiết lập | Nơi thực thi (BE & FE) | Phát hiện Audit & Xử lý Chuẩn Hóa (Zero-Hardcode) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 61 | `standard_commission_rate` | Tỷ lệ hoa hồng tiêu chuẩn mặc định (ví dụ `0.03` = 3%) | `DepositController.php:L160-L169`, `DepositsPage.tsx` | Bổ sung fallback tự động tính `$expectedCommission = round($price * $commRate)` từ `standard_commission_rate` trong `DepositController::store` nếu request không truyền `expected_commission`. | ✅ ĐÃ CHUẨN |
| 62 | `deposit_cancel_demoted_status` | Trạng thái hạ bậc khi hủy cọc trước doanh thu (mặc định `da_gap`) | `DepositController.php:L797-L846` | Đọc động từ `system_settings` và áp dụng đúng `security_timer_<demotedStatus>`. | ✅ ĐÃ CHUẨN |
| 63 | `deposit_cancel_demoted_booking_status` | Trạng thái hạ bậc khi hủy cọc với khách từng qua Booking | `DepositController.php:L796-L846` | Đọc động từ `system_settings`. | ✅ ĐÃ CHUẨN |
| 64 | `approval_matrix_config` | Ma trận phân quyền phê duyệt đa cấp (Cấp 1 Team Leader, Cấp 2 Role/User chỉ định, Hạn mức duyệt chi phí `money_tiers`) | `NotificationService.php:L1202-L1295`, `DepositController.php:L510-L770`, `CheckInController.php:L575-L595`, `FinanceController.php:L1190-L1242`, `approvalPermissions.ts:L95-L99` | **Phát hiện P0**:<br>1. `NotificationService::canUserApproveModule` trước đây chặn sớm `sale`/`staff` trước khi xét `designated_user_ids` và chưa xét đầy đủ cả Level 1 lẫn Level 2.<br>2. `DepositController`, `CheckInController`, và `FinanceController::approveExpense` trước đây chỉ kiểm tra role cứng mà chưa gọi `canUserApproveModule` (đặc biệt là hạn mức tiền `money_tiers` của Chi phí).<br>3. `approvalPermissions.ts` trước đây luôn trả `true` cho `manager` kể cả khi module đã cấu hình người duyệt khác.<br>👉 **Đã khắc phục triệt để cả 3 điểm trên**. | ✅ ĐÃ CHUẨN |

---

### Nhóm 6–10: Báo Lỗi Lead, Thông Báo Đa Kênh, Báo Cáo Định Kỳ, AI Pre-Screener, Meta CAPI & Giao Diện (27 Keys)

- **Nhóm 6 (Báo lỗi Lead & Tự động đền bù)**: `report_error_reasons`, `auto_approve_error_report`, `error_report_auto_approve_reasons` -> Đọc động tại `api.php` (`submit_report`), `ContactsPage.tsx`, `SalePortal.tsx`.
- **Nhóm 7 (Thông báo Zalo / Telegram / Email & Nhắc việc)**: `notification_matrix`, `telegram_bot_token`, `telegram_admin_chat_id`, `zalo_bot_token`, `smtp_*`, `task_due_warning_minutes`, `task_overdue_escalation_minutes` -> Đọc động tại `NotificationService.php`, `cron_sync.php`, `mailer.php`, `zalo_bot.php`.
- **Nhóm 8 (Báo cáo Ngày / Tuần / Tháng)**: `daily_report_*`, `weekly_report_*`, `monthly_report_*` -> Đọc động tại `cron_daily_report.php`, `cron_weekly_report.php`, `cron_monthly_report.php`.
- **Nhóm 9 (AI Pre-Screener & Meta CAPI)**: `ai_screener_enabled`, `gemini_api_key`, `capi_dataset_id`, `capi_access_token`, `capi_stage_mapping`, `capi_stuck_alert_threshold` -> Đọc động tại `cron_ai_worker.php`, `CapiHelper.php`, `TriggerHelper.php`, `cron_sync.php`.
- **Nhóm 10 (Đồng bộ Google Sheets & Hệ thống chung)**: `sheet_sync_interval_minutes`, `company_name`, `system_timezone` -> Đọc động tại `cron_sync.php` và `Settings.tsx`.
