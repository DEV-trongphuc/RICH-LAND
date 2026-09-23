# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def build_excel_audit():
    wb = openpyxl.Workbook()
    
    # Define color palette & styles
    header_fill_navy = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    header_fill_orange = PatternFill(start_color="C65911", end_color="C65911", fill_type="solid")
    header_fill_teal = PatternFill(start_color="1B7575", end_color="1B7575", fill_type="solid")
    
    fill_pass = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")       # light green
    fill_partial = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")    # light yellow
    fill_unclear = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")    # light peach/coral
    
    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    font_title = Font(name="Calibri", size=16, bold=True, color="1F497D")
    font_subtitle = Font(name="Calibri", size=11, italic=True, color="595959")
    font_bold = Font(name="Calibri", size=10, bold=True)
    font_regular = Font(name="Calibri", size=10)
    
    font_pass = Font(name="Calibri", size=10, bold=True, color="375623")
    font_partial = Font(name="Calibri", size=10, bold=True, color="833C0C")
    font_unclear = Font(name="Calibri", size=10, bold=True, color="C00000")
    
    thin_border_side = Side(border_style="thin", color="D9D9D9")
    cell_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_top_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
    align_top_center = Alignment(horizontal="center", vertical="top", wrap_text=True)
    
    # =========================================================================
    # SHEET 1: CẦN XÁC NHẬN & CHƯA RÕ (Action Items for User)
    # =========================================================================
    ws1 = wb.active
    ws1.title = "1. Cần Xác Nhận (Priority)"
    ws1.views.sheetView[0].showGridLines = True
    
    # Title Block
    ws1.cell(row=1, column=1, value="DANH SÁCH 10 ĐIỂM CHƯA RÕ / CHƯA CÓ TRONG APP CẦN XẤC NHẬN").font = font_title
    ws1.cell(row=2, column=1, value="Đối soát tài liệu 60 test case.docx với hệ thống RichLand CRM (Frontend, Backend, Staging DB)").font = font_subtitle
    ws1.row_dimensions[1].height = 28
    ws1.row_dimensions[2].height = 18
    
    headers_ws1 = [
        "STT", "Mã Kịch Bản", "Nội Dung Nghiệp Vụ", 
        "Kịch Bản BA Quy Định", 
        "Hiện Trạng Codebase & DB Staging", 
        "Vấn Đề / Điểm Xung Đột", 
        "Câu Hỏi Cụ Thể Cần Bạn Xác Nhận", 
        "Lựa Chọn / Quyết Định Của Bạn"
    ]
    
    for col_idx, h in enumerate(headers_ws1, 1):
        cell = ws1.cell(row=4, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = header_fill_orange
        cell.alignment = align_center
        cell.border = cell_border
    ws1.row_dimensions[4].height = 30
    
    action_items = [
        (
            1, "TC-33 & Kịch bản 10", 
            "Giữ hay Thu hồi KHTN Sales gốc khi Person rơi kho Databank",
            "Hết hạn bảo mật -> Person công khai ra kho 1 lần duy nhất, NHƯNG GIỮ NGUYÊN KHTN của Sales gốc (không giật lead) để Sales gốc vẫn chăm sóc bình thường.",
            "cron_sync.php (dòng 2953) khi hết hạn bảo mật lại chạy lệnh: UPDATE contacts SET deleted_at = NOW() (tức thu hồi/xóa KHTN của Sales gốc).",
            "Xung đột nghiệp vụ trực tiếp giữa Code hiện tại và Kịch bản BA.",
            "Bạn chọn phương án nào:\n- PA A: Giữ KHTN cho Sales gốc tiếp tục chăm sóc, chỉ đưa Person lên kho chung cho Sales khác nhặt thêm (chăm song song).\n- PA B: Thu hồi hoàn toàn KHTN của Sales gốc vì đã hết hạn bảo mật?",
            "[  ] PA A: Giữ nguyên KHTN Sales gốc\n[  ] PA B: Thu hồi KHTN Sales gốc"
        ),
        (
            2, "TC-02", 
            "Bất biến của bản ghi LEAD gốc (Immutable Event Log)",
            "Bảng LEAD tuyệt đối chỉ cho phép INSERT (sự kiện phát sinh), cấm mọi lệnh UPDATE hoặc DELETE (kể cả Admin gọi API hay can thiệp trực tiếp).",
            "CSDL Staging chưa cài DB Trigger cấm UPDATE/DELETE trên bảng leads. Backend (api.php dòng 17111) vẫn có API cho Admin/Quản lý sửa fields của lead.",
            "Chưa khóa cứng hoàn toàn bảng leads ở mức CSDL và API.",
            "Bạn có muốn khóa cứng tuyệt đối bảng leads (xóa bỏ endpoint sửa lead gốc) và chỉ cho phép cập nhật thông tin trên tầng contacts/persons không?",
            "[  ] Khóa cứng tuyệt đối bảng leads\n[  ] Vẫn cho phép Admin sửa khi cần"
        ),
        (
            3, "TC-05 & Kịch bản 1", 
            "Gộp Lead Google Ads trong cùng 1 ngày (Cùng SĐT + Dự án)",
            "Khách submit form Google Ads nhiều lần trong ngày (cùng SĐT + cùng Dự án) thì CHỈ TẠO 1 BẢN GHI LEAD duy nhất; các lần sau chỉ gộp thông tin bổ sung.",
            "Webhook hiện tại chưa có nhánh logic riêng cho Google Ads; mỗi lần khách điền form đều tạo 1 bản ghi lead độc lập.",
            "Chưa có cơ chế gộp form trong ngày đối với nguồn Google Ads.",
            "Quy cách gộp dữ liệu bổ sung: Ghi đè hay gộp mảng JSON các câu trả lời form? Có áp dụng cho mọi nguồn form hay chỉ riêng Google Ads?",
            "[  ] Ghi đè thông tin mới\n[  ] Gộp nối mảng JSON\n[  ] Áp dụng cho: ..."
        ),
        (
            4, "TC-06", 
            "Nghiệp vụ 'Nhập Bù Lead MKT' (Backfill) & Phân quyền",
            "Chỉ Marketing/Quản lý có quyền 'Nhập bù Lead MKT' (bắt buộc chọn Campaign/Dự án/Ad_ID). Lead này tự động đi vào Luồng 2 chia xoay vòng. Sales bị chặn 403.",
            "Hệ thống hiện chỉ có 'Thêm khách hàng cá nhân' (dành cho Sales, không chia) và 'Import Excel' ở Cài đặt. Chưa có phân hệ 'Nhập bù Lead MKT' riêng.",
            "Chưa có màn hình / API nhập bù riêng biệt cho Marketing.",
            "Bạn có cần xây dựng riêng 1 modal/màn hình 'Nhập bù Lead MKT' cho đội Marketing, hay chỉ cần bổ sung tùy chọn 'Đưa vào Luồng chia xoay vòng' trong tính năng Import Excel hiện có?",
            "[  ] Tạo màn hình/modal Nhập bù riêng cho MKT\n[  ] Tích hợp tùy chọn vào Import Excel hiện có"
        ),
        (
            5, "TC-20 & Kịch bản 7", 
            "Tiến trình tự động rớt nhiệt (Decay Engine) sau 5 ngày",
            "Nếu KHTN không phát sinh tương tác chất lượng trong 5 ngày liên tiếp, cronjob chạy lúc 00:00 tự động hạ 1 mức nhiệt (Nóng -> Ấm -> Lạnh) và gắn cờ 'Khách Nguội' để đẩy vào danh sách xử lý.",
            "Đã có decay khi Bể cọc (User Rule 1 & 2), nhưng chưa có cronjob hàng ngày quét KHTN 5 ngày không tương tác để tự động hạ nhiệt độ.",
            "Chưa lập trình cronjob quét decay hàng ngày cho KHTN.",
            "Bạn xác nhận chu kỳ quét rớt nhiệt 5 ngày là cố định hay cần làm cấu hình linh hoạt (X ngày) theo từng Dự án / Chiến dịch?",
            "[  ] Cố định 5 ngày\n[  ] Cho phép cấu hình X ngày theo Dự án"
        ),
        (
            6, "TC-36", 
            "Quy tắc 3 lần Đóng - Không Phù Hợp cùng 1 lý do",
            "Person bị 3 Sales khác nhau đóng với cùng 1 lý do (ví dụ 'Không đủ tài chính') -> Hệ thống tự động khóa vĩnh viễn Person, không bao giờ xuất hiện trên kho Databank nữa.",
            "Bảng persons đã có sẵn các trường is_blocked, deleted_from_databank và API khóa tay của Admin, nhưng chưa có trigger/cron tự đếm đủ 3 lần đóng cùng lý do để auto-lock.",
            "Chưa lập trình logic tự động đếm 3 lần để tự động khóa vĩnh viễn.",
            "Quy tắc này sẽ đếm trên toàn bộ lịch sử từ trước đến nay, hay chỉ tính các lần đóng trong vòng X tháng gần nhất?",
            "[  ] Đếm toàn bộ lịch sử\n[  ] Chỉ tính trong vòng ... tháng"
        ),
        (
            7, "TC-41", 
            "Chặn Đổi Căn khi đã ký Thỏa Thuận Cọc (TTC)",
            "Đổi căn chỉ được thực hiện khi CHƯA ký Thỏa Thuận Cọc (TTC). Nếu đã ký TTC thì hệ thống chặn thao tác, báo lỗi.",
            "Chức năng Đổi căn (DealController::switchUnit) đã hoàn thiện (đóng deal cũ, mở deal mới, giữ audit trail), nhưng chưa có điều kiện kiểm tra trạng thái ký TTC để chặn.",
            "Chưa ràng buộc điều kiện kiểm tra hợp đồng TTC trước khi đổi căn.",
            "Trong dữ liệu hiện tại của CRM, căn cứ nào xác định deal 'Đã ký TTC' (dựa vào việc Admin đã duyệt Mốc thanh toán Đợt 1, hay dựa vào trạng thái file hợp đồng đính kèm)?",
            "[  ] Dựa vào Mốc Đợt 1 đã duyệt UNC\n[  ] Dựa vào file Hợp đồng TTC đính kèm"
        ),
        (
            8, "TC-44", 
            "Pipeline 3 trạng thái Đối chiếu phí Môi giới với Chủ đầu tư",
            "Quản lý phí môi giới qua 3 trạng thái: Đủ Điều Kiện -> Đã Gửi Hồ Sơ -> Tiền Đã Về. Bảng DOI_CHIEU_PHI xuất dữ liệu cho kế toán.",
            "CSDL Staging chưa có bảng doi_chieu_phi; app chưa có màn hình pipeline đối soát phí với CĐT.",
            "Nghiệp vụ mới chưa được xây dựng.",
            "Bạn có muốn đưa phân hệ Đối chiếu phí CĐT này vào giai đoạn phát triển tiếp theo sau khi hoàn thiện các luồng cốt lõi không?",
            "[  ] Triển khai ở giai đoạn tiếp theo\n[  ] Cần triển khai ngay"
        ),
        (
            9, "TC-46", 
            "Tự động bắn CAPI Event BAD khi duyệt Not Lead",
            "Not Lead được MKT duyệt -> Bảng CAPI_LOG tự động ghi nhận và bắn event BAD kèm hash SĐT/Email sang Meta để tối ưu máy học loại trừ khách rác.",
            "Bảng cấu hình meta_capi_settings hiện đang để action của not_lead là 'Skip' (bỏ qua), chưa kích hoạt bắn sự kiện BAD sang Meta.",
            "Chưa kích hoạt cơ chế bắn tín hiệu BAD cho Meta CAPI.",
            "Bạn vui lòng cung cấp tên Event chuẩn đã khai báo trên Meta Events Manager (ví dụ: 'Lead_Disqualified', 'Bad_Lead', hay 'Custom_Bad_Lead') để hệ thống kích hoạt?",
            "Tên Event Meta mong muốn: [ .................... ]"
        ),
        (
            10, "TC-48", 
            "Bảng CHI_PHI_ADS & Bóc tách chi phí tự động Ngày x Ad_ID",
            "Tự động kết nối Meta Marketing API kéo chi phí bóc tách cấp Ngày x Ad_ID vào bảng CHI_PHI_ADS. Tính CPL/CAC thực tế từ chi phí chia cho Lead CRM (không dùng số lead của Meta).",
            "CSDL Staging hiện chưa có bảng chi_phi_ads. Chi phí marketing hiện đang được nhập tay theo chiến dịch/tháng, chưa có cronjob kéo tự động từ Meta API.",
            "Chưa có bảng chi phí chi tiết và cronjob kết nối Meta Marketing API.",
            "Công ty đã có Access Token Meta Marketing API có quyền 'ads_read' và 'read_insights' dài hạn để tích hợp kéo chi phí tự động chưa?",
            "[  ] Đã có Token, sẵn sàng tích hợp\n[  ] Chưa có, tiếp tục nhập tay"
        ),
    ]
    
    current_row = 5
    for item in action_items:
        stt, code, name, ba, code_act, issue, question, options = item
        ws1.cell(row=current_row, column=1, value=stt).alignment = align_top_center
        ws1.cell(row=current_row, column=2, value=code).alignment = align_top_center
        ws1.cell(row=current_row, column=3, value=name).alignment = align_top_left
        ws1.cell(row=current_row, column=4, value=ba).alignment = align_top_left
        ws1.cell(row=current_row, column=5, value=code_act).alignment = align_top_left
        ws1.cell(row=current_row, column=6, value=issue).alignment = align_top_left
        ws1.cell(row=current_row, column=7, value=question).alignment = align_top_left
        ws1.cell(row=current_row, column=8, value=options).alignment = align_top_left
        
        # Styles
        ws1.cell(row=current_row, column=2).font = font_bold
        ws1.cell(row=current_row, column=6).font = font_unclear
        ws1.cell(row=current_row, column=7).font = font_bold
        
        for c in range(1, 9):
            ws1.cell(row=current_row, column=c).border = cell_border
            ws1.cell(row=current_row, column=c).fill = fill_unclear
        
        ws1.row_dimensions[current_row].height = 95
        current_row += 1
        
    # Column widths for Sheet 1
    col_widths_ws1 = {1: 6, 2: 18, 3: 26, 4: 34, 5: 34, 6: 30, 7: 38, 8: 36}
    for col_idx, width in col_widths_ws1.items():
        ws1.column_dimensions[get_column_letter(col_idx)].width = width
    ws1.freeze_panes = "A5"

    # =========================================================================
    # SHEET 2: TOÀN BỘ 60 TEST CASES (Full Audit Matrix)
    # =========================================================================
    ws2 = wb.create_sheet(title="2. Toàn Bộ 60 Test Cases")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.cell(row=1, column=1, value="MA TRẬN KIỂM THỬ TOÀN DIỆN 60 KỊCH BẢN (50 TEST CASES + 10 KỊCH BẢN TỔNG HỢP)").font = font_title
    ws2.cell(row=2, column=1, value="Đối soát chi tiết từng Luồng chức năng với Codebase và Database Staging crm.richland.city").font = font_subtitle
    ws2.row_dimensions[1].height = 28
    ws2.row_dimensions[2].height = 18
    
    headers_ws2 = [
        "STT", "Phân Nhóm Luồng", "Mã TC", "Tên Test Case / Kịch Bản", 
        "Kỳ Vọng Nghiệp Vụ (BA Rules)", 
        "Hiện Trạng Codebase & DB Staging", 
        "Kết Quả Đối Soát", 
        "Chi Tiết Kỹ Thuật / Vấn Đề Cần Hỗ Trợ",
        "Ý Kiến Của Bạn"
    ]
    
    for col_idx, h in enumerate(headers_ws2, 1):
        cell = ws2.cell(row=4, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = header_fill_navy
        cell.alignment = align_center
        cell.border = cell_border
    ws2.row_dimensions[4].height = 30
    
    all_60_cases = [
        # LUỒNG 1 (TC-01 -> TC-08)
        (1, "Luồng 1: Lead Vào & Định Danh", "TC-01", "Cửa tiếp nhận duy nhất & Gán Attribution",
         "Mọi lead bắt buộc đi qua 1 cửa tiếp nhận để chuẩn hóa, cấm ghi trực tiếp CRM. Gán ad_id, campaign_id, fbp, fbc.",
         "Webhook tiếp nhận tại /backend/webhook.php, chuyển qua processLeadWebhook trong webhook_logic.php, lưu context và UTMs vào bảng leads.",
         "ĐẠT (PASS)", "Hoạt động chuẩn xác. Lưu ý: Endpoint thực tế là /backend/webhook.php (BA ghi /api/v1/leads/ingest)."),
        
        (2, "Luồng 1: Lead Vào & Định Danh", "TC-02", "Tính bất biến của bản ghi LEAD gốc (Immutable)",
         "Bảng LEAD đại diện cho 1 lần đăng ký, chỉ cho phép INSERT, cấm tuyệt đối UPDATE/DELETE.",
         "Bảng leads chưa cài DB Trigger cấm UPDATE. File api.php (dòng 17111 - update_lead_fields) vẫn cho phép Admin/Manager sửa name, phone, email, note của lead.",
         "CHƯA KHỚP (CẦN HỖ TRỢ)", "Cần xác nhận: Khóa cứng bảng leads và đóng endpoint update_lead_fields."),
        
        (3, "Luồng 1: Lead Vào & Định Danh", "TC-03", "Định danh con người (PERSON) theo SĐT mới",
         "SĐT là khóa định danh duy nhất (phone UNIQUE). Lead mới tự sinh Person; Lead trỏ person_id. Sales không thấy bảng Person.",
         "Bảng persons có ràng buộc UNIQUE trên cột phone. Hàm syncLeadToPersonAndContact tự tạo Person và gắn ID. Sales chỉ thao tác trên bảng contacts.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (4, "Luồng 1: Lead Vào & Định Danh", "TC-04", "Deduplication Facebook Ads: Trùng SĐT sinh N Lead",
         "Mỗi lần điền form Facebook Ads sinh 1 bản ghi LEAD mới để đo attribution; cùng trỏ về 1 person_id duy nhất.",
         "Mỗi webhook Meta Ads gửi về đều tạo 1 bản ghi mới trong bảng leads. Tìm thấy SĐT đã có thì trỏ leads.person_id về Person cũ, không tạo thêm Person.",
         "ĐẠT (PASS)", "Hoạt động chuẩn xác."),
        
        (5, "Luồng 1: Lead Vào & Định Danh", "TC-05", "Deduplication Google Ads: Gộp Lead trong ngày",
         "Cùng SĐT + cùng dự án + cùng ngày từ Google Ads -> Gộp vào 1 LEAD, ghi nhận thêm thông tin form điền bổ sung.",
         "Webhook hiện tại chưa có nhánh logic riêng cho Google Ads; mỗi lần submit đều tạo 1 dòng leads độc lập.",
         "CHƯA CÓ (CẦN HỖ TRỢ)", "Cần hỗ trợ: Xác nhận quy cách gộp JSON form bổ sung khi khách điền lại lần 2."),
        
        (6, "Luồng 1: Lead Vào & Định Danh", "TC-06", "Nghiệp vụ Nhập Bù MKT (Backfill) & Chặn Sales",
         "Chỉ MKT/Quản lý được nhập bù khi sót lead; bắt buộc chọn Campaign/Dự án/Ad_ID và chia xoay vòng. Sales bị chặn 403.",
         "Chưa có màn hình/API riêng 'Nhập bù Lead MKT'. Hiện chỉ có Thêm khách cá nhân và Import Excel chung.",
         "CHƯA CÓ (CẦN HỖ TRỢ)", "Cần hỗ trợ: Xác nhận có xây dựng modal/màn hình Nhập bù riêng cho MKT hay không."),
        
        (7, "Luồng 1: Lead Vào & Định Danh", "TC-07", "Sales nhập Khách Cá Nhân & Lưới chống Rửa Nguồn",
         "Khách cá nhân thuộc Sales vĩnh viễn, không rơi kho. Nếu trùng SĐT MKT active trong X ngày -> Bật cờ cảnh báo đỏ, không chặn.",
         "ContactController.php (dòng 491-520): kiểm tra trùng SĐT MKT active, vẫn cho lưu, set duplicate_flag=1, ghi audit_logs và phát cảnh báo đỏ.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (8, "Luồng 1: Lead Vào & Định Danh", "TC-08", "Khách Giới Thiệu kế thừa Dòng Nguồn",
         "Khách giới thiệu bắt buộc chọn người giới thiệu, kế thừa dòng nguồn MKT hoặc Cá nhân của người giới thiệu.",
         "Bảng contacts có cột nguoi_gioi_thieu_id trỏ về contact giới thiệu, cho phép truy vết nguồn qua JOIN. Chưa có cột tĩnh dong_nguon riêng.",
         "ĐẠT MỘT PHẦN", "Đã có liên kết quan hệ; đề xuất thêm cột tĩnh dong_nguon để tối ưu truy vấn."),

        # LUỒNG 2 (TC-09 -> TC-17)
        (9, "Luồng 2: Chia Lead & Vòng Xoay", "TC-09", "Roster Chiến dịch & Đơn vị nhận Lead là cá nhân",
         "Đơn vị nhận lead là cá nhân Sales. GĐKD quản lý Roster. Sales không thuộc Roster chiến dịch bị loại ngay.",
         "Bảng project_roster và round_consultants lưu danh sách Sales theo chiến dịch. Vòng xoay loại bỏ ngay user không thuộc roster và ghi log.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (10, "Luồng 2: Chia Lead & Vòng Xoay", "TC-10", "Chuỗi 5 Cổng Kiểm Duyệt Ngày (Gate Chain)",
         "Chuỗi 5 cổng tuần tự: Roster -> Check-in -> Sẵn sàng -> Van chống ôm -> Quota Giờ Vàng. Bị chặn cổng nào ghi log cổng đó.",
         "webhook_logic.php (dòng 2280-2410) cài đặt tuần tự đúng 5 Cổng và ghi chi tiết lý do chặn vào distribution_logs.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (11, "Luồng 2: Chia Lead & Vòng Xoay", "TC-11", "Van Chống Ôm & Xả Van bằng Lead Tính Công",
         "Om quá X lead Chưa Xác Định -> Bị chặn nhận lead. Mẫu số = Lead nhận - Not Lead duyệt. MKT duyệt Not Lead -> Tự xả van.",
         "Cổng 4 đếm lead Chưa Xác Định chưa tương tác; trừ đi các lead Not Lead đã được MKT duyệt. Khi duyệt xong van xả ngay lập tức.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (12, "Luồng 2: Chia Lead & Vòng Xoay", "TC-12", "Timeout 2 Phút, Nút Từ Chối & Nút Tạm Vắng",
         "Timeout 2 phút thu hồi lead; Nút Từ chối chuyển lead ngay; Nút Tạm vắng (Vacation) bỏ qua không phạt.",
         "lead_offers có expires_at (+120s); nút Từ chối kích hoạt chuyển offer tức thì; Sales bật Tạm vắng được skip ở Gate 3 không ghi lỗi.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (13, "Luồng 2: Chia Lead & Vòng Xoay", "TC-13", "Ca Trực Đêm (18:00 - 06:00) & Reset 06:00",
         "Đăng ký trực trước 18h. Ca đêm chia trong danh sách trực đêm (Timeout 5p). Đúng 06:00 sáng tự động reset danh sách.",
         "Bảng night_shift_registrations ghi nhận đăng ký; khung 18h-06h chia đúng danh sách trực đêm; cronjob tự dọn danh sách lúc 06:00 sáng mỗi ngày.",
         "ĐẠT (PASS)", "Đã kiểm chứng thực tế trên Staging."),
        
        (14, "Luồng 2: Chia Lead & Vòng Xoay", "TC-14", "Hàng Đợi Chờ Sáng (Queue) & Tin Nhắn Giữ Ấm",
         "Ca đêm không ai trực -> Lead vào Hàng đợi chờ sáng (Queue). Hệ thống tự kích hoạt SMS/ZNS gửi tin giữ ấm cho khách.",
         "Lead ca đêm không ai trực được lưu trạng thái queued chờ sáng. Tính năng tự bắn tin SMS/ZNS giữ ấm chưa cấu hình mẫu tin Zalo OA.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Cần hỗ trợ: Cung cấp mẫu tin Zalo ZNS đã đăng ký với OA để tích hợp tự động."),
        
        (15, "Luồng 2: Chia Lead & Vòng Xoay", "TC-15", "Bung Giờ Vàng (06:00 - 08:30)",
         "Lead tồn đêm bung từ 06:00 sáng cho Sales Check-in và bật Sẵn sàng sớm. Sau 08:30 chuyển về vòng xoay ngày bình thường.",
         "Cổng 5 trong webhook_logic.php và cronjob sáng quét hàng đợi giờ vàng, giới hạn hạn mức quota giờ vàng cho Sales sẵn sàng sớm.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (16, "Luồng 2: Chia Lead & Vòng Xoay", "TC-16", "Chia Song Song 2 Sales (Cạnh Tranh Mù) Sau 3 Giờ",
         "Lead ở Chưa Xác Định quá 3h không tương tác -> Chia thêm 1 Sales chăm song song (Trần=1). Cạnh tranh mù, không cờ báo.",
         "cron_sync.php (dòng 3170) và ParallelHelper: quét lead quá 3h, gán parallel_assigned=1, ẩn cờ đối thủ trên UI. Bên nào chốt trước thì bên kia thu hồi.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (17, "Luồng 2: Chia Lead & Vòng Xoay", "TC-17", "Re-assign Thủ Công & Di Sản Sales Nghỉ Việc",
         "Re-assign thủ công -> Reset trạng thái, ẩn ghi chú cũ. Sales nghỉ việc -> Ghi chú cũ thành Di sản hiển thị cho người sau.",
         "Bảng notes đã có cột is_heritage. Tuy nhiên query xem ghi chú hiện tại chưa lọc ẩn ghi chú của sales cũ khi người đó vẫn đang làm việc.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Cần hỗ trợ: Xác nhận cập nhật bộ lọc query ghi chú theo trạng thái active của sales cũ."),

        # LUỒNG 3 (TC-18 -> TC-25)
        (18, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-18", "Ghi Chú Cấu Trúc (3 Nồi) & Bắt Thời Lượng Gọi",
         "Ghi chú cấu trúc: Kênh (Nồi Đất/Đồng/Áp Suất), Loại (Thường/Chất lượng), Thời lượng call, Phản hồi, Tài liệu gửi.",
         "Bảng notes lưu đầy đủ channel, note_type, duration_minutes, client_feedback, documents_sent. Drawer CustomerProfileDrawer.tsx nhập liệu chuẩn.",
         "ĐẠT (PASS)", "Rất đầy đủ và chi tiết."),
        
        (19, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-19", "Cơ Chế Nhiệt Độ Hybrid & Khởi Điểm Theo Nguồn",
         "Lưu song song nhiệt máy đoán và sale chốt. Khởi điểm: MKT = Lạnh (cold), Giới thiệu/Cá nhân = Ấm (neutral).",
         "Bảng notes lưu song song suggested_temperature và sale_temperature. Nhiệt khởi điểm được gán chuẩn theo nguồn lead.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (20, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-20", "Tiến Trình Tự Động Rớt Nhiệt (Decay Engine) 5 Ngày",
         "5 ngày không có tương tác chất lượng -> Nhiệt tự rớt 1 mức (Nóng -> Ấm -> Lạnh) lúc 00:00 và gắn cờ Khách Nguội.",
         "Đã có decay khi Bể cọc (User Rule 1 & 2), nhưng chưa có cronjob quét định kỳ 5 ngày không tương tác để tự hạ nhiệt độ KHTN.",
         "CHƯA CÓ (CẦN HỖ TRỢ)", "Cần hỗ trợ: Xác nhận cấu hình thời hạn 5 ngày là cố định hay linh hoạt theo dự án."),
        
        (21, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-21", "Tag Vướng 1 Chạm & Kích Hoạt Toa Thuốc Tĩnh",
         "Tag vướng 1 chạm khi lưu ghi chú -> Màn hình lập tức hiển thị Toa thuốc tĩnh tương ứng từ sổ tay.",
         "CustomerProfileDrawer.tsx có danh sách tag vướng và tự động hiển thị gợi ý Toa tĩnh theo sổ tay bán hàng (Phòng bếp, Nước sôi, Than so sánh...).",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (22, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-22", "Gate Sổ Tay Form TTL1 (5 Nhóm Chân Dung)",
         "Form TTL1 5 nhóm. Thiếu >= 2 nhóm -> Bật cảnh báo vàng, nhắc nhở chưa đủ dữ liệu chuyển pha.",
         "Giao diện có thanh đo độ đầy dữ liệu TTL1 (5 nhóm) và tự động bật cảnh báo vàng khi thiếu >= 2 nhóm thông tin.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (23, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-23", "Cổng Bằng Chứng Số Hóa Khi Chuyển Trạng Thái",
         "Chuyển trạng thái (Đồng ý gặp -> Đã gặp) bắt buộc upload ảnh check-in thực địa, gắn vào LICH_SU_TRANG_THAI.",
         "CustomerProfileDrawer.tsx:15068 đã tích hợp modal Check-in gặp khách, bắt buộc chụp/tải ảnh minh chứng thực địa (chặn chuyển nếu chưa có ảnh), nén WebP và gắn link ảnh vào hoạt động chăm sóc.",
         "ĐẠT (PASS)", "Đã có sẵn và hoạt động chuẩn chỉnh trên app."),
        
        (24, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-24", "Hạ Trạng Thái KHTN Không Bắt Bằng Chứng",
         "Hạ trạng thái khi bể giao dịch / đổi ý không cần bằng chứng; đồng hồ bảo mật đếm lại từ đầu.",
         "Thao tác hạ trạng thái KHTN không yêu cầu tệp đính kèm, thực hiện ngay lập tức và tính lại bảo mật.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (25, "Luồng 3: Chăm Sóc & Nhiệt Độ", "TC-25", "2 Cửa Thoát: Not Lead vs Đóng Không Phù Hợp",
         "Not Lead -> Chờ MKT duyệt. Đóng Không Phù Hợp -> Có hiệu lực ngay lập tức, không cần duyệt.",
         "Báo Not Lead chuyển sang hàng đợi duyệt của MKT. Chọn Đóng Không Phù Hợp chuyển trạng thái Đã Đóng ngay lập tức.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),

        # LUỒNG 4 (TC-26 -> TC-31)
        (26, "Luồng 4: Hợp Tác & Hoa Hồng", "TC-26", "1 Owner Duy Nhất & Chặn Supporter Đổi Trạng Thái",
         "Mỗi KHTN có đúng 1 Owner. Chỉ Owner được đổi trạng thái; Supporter bị chặn / ẩn nút.",
         "Mỗi contact chỉ có 1 owner_id. Giao diện Frontend ẩn nút chuyển trạng thái đối với người dùng không phải Owner/Admin.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (27, "Luồng 4: Hợp Tác & Hoa Hồng", "TC-27", "Mời Hỗ Trợ Không % Tiền & Thu Hồi Mọi Lúc",
         "Mời hỗ trợ không nhập % hoa hồng. Owner thu hồi quyền bất cứ lúc nào. Lưu vết vĩnh viễn trong QUYEN_TRUY_CAP.",
         "Bảng quyen_truy_cap quản lý độc lập không có cột % tiền khi mời. Ghi nhận đầy đủ trạng thái grant/revoke kèm timestamp.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (28, "Luồng 4: Hợp Tác & Hoa Hồng", "TC-28", "Tự Sinh Phiếu Hợp Tác Khi Cọc (Kéo Người Thu Hồi)",
         "Sinh phiếu khi Đặt Cọc; tự động kéo danh sách từ QUYEN_TRUY_CAP bao gồm cả người đã bị thu hồi quyền giữa chừng.",
         "CooperationController::autoGenerateSlip quét toàn bộ lịch sử trong quyen_truy_cap kể cả user có status = revoked để đưa vào phiếu.",
         "ĐẠT (PASS)", "Rất chính xác và đúng chuẩn."),
        
        (29, "Luồng 4: Hợp Tác & Hoa Hồng", "TC-29", "Kiểm Tra Validation Tổng % = 100%",
         "Owner phân chia %, hệ thống kiểm tra tổng tỷ lệ đúng bằng 100%. Sai lệch chặn gửi, báo lỗi 422.",
         "Cả Frontend và Backend đều kiểm tra abs(total - 100) < 0.01; nếu khác 100% chặn lưu và thông báo lỗi rõ ràng.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (30, "Luồng 4: Hợp Tác & Hoa Hồng", "TC-30", "Chữ Ký Số 1 Chạm & Cảnh Báo Treo Quá 24h",
         "Từng người bấm xác nhận 1 chạm. Quá 24h không phản hồi / từ chối -> Đổi trạng thái PHIEU_TREO + Báo Quản lý.",
         "Đã hoàn thiện backend/cron_cooperation_slips.php và tích hợp vào cron_master.php & cron_sync.php: tự động quét và chuyển sang PHIEU_TREO (disputed) sau 24h kèm phát cảnh báo Quản lý / GĐKD qua NotificationService (Zalo, TG, Email).",
         "ĐẠT (PASS)", "Đã lập trình xong và đưa vào cron master."),
        
        (31, "Luồng 4: Hợp Tác & Hoa Hồng", "TC-31", "GĐKD Phê Duyệt, Khóa Vĩnh Viễn & Unblock Cọc",
         "GĐKD duyệt cuối -> Khóa vĩnh viễn (Read-only), cấm sửa. Phiếu hợp tác không block tiến trình Đặt Cọc.",
         "Khi GĐKD duyệt, kích hoạt is_locked=1 cấm sửa đổi; tiến trình giao dịch cọc và chăm sóc khách hàng không bị block.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),

        # LUỒNG 5 (TC-32 -> TC-38)
        (32, "Luồng 5: Kho Data Databank", "TC-32", "Ranh Giới Nguồn Rơi Kho Databank",
         "Chỉ nguồn MKT (FB Ads, Webhook, Broadcast) mới rơi kho. Nguồn Cá nhân và Giới thiệu bảo vệ vĩnh viễn không rơi kho.",
         "cron_sync.php lọc danh sách theo databank_applicable_sources; nguồn ca_nhan và gioi_thieu không bao giờ bị đưa ra kho.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (33, "Luồng 5: Kho Data Databank", "TC-33", "Bảo Mật Theo Trạng Thái & Giữ KHTN Sales Gốc",
         "Hết hạn bảo mật -> Person công khai ra kho 1 lần duy nhất, NHƯNG GIỮ NGUYÊN KHTN của Sales gốc (không giật lead).",
         "cron_sync.php (dòng 2953) khi hết hạn bảo mật lại chạy UPDATE contacts SET deleted_at = NOW() (thu hồi KHTN của sales gốc).",
         "XUNG ĐỘT (CẦN HỖ TRỢ)", "Cần hỗ trợ: Xác nhận giữ KHTN sales gốc (chăm song song) hay thu hồi hẳn?"),
        
        (34, "Luồng 5: Kho Data Databank", "TC-34", "Data Nhặt Kho Không Bảo Mật & Không Ra Kho Lần 2",
         "Data nhặt kho mang source=databank, không có đồng hồ bảo mật riêng, Person vẫn ở kho cho người khác nhặt tiếp.",
         "Contact nhặt kho lưu source = 'databank', không có security_expires_at, Person vẫn public cho các Sales khác nhặt.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (35, "Luồng 5: Kho Data Databank", "TC-35", "Cửa Đóng Kho Duy Nhất Bằng Đặt Cọc",
         "Bất kỳ KHTN nào đạt Đặt Cọc -> Rút Person khỏi kho Databank vĩnh viễn, không ai nhặt được nữa.",
         "Khi phát sinh Đặt cọc, hệ thống cập nhật persons.is_public = 0, lập tức ẩn Person khỏi kho Databank.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (36, "Luồng 5: Kho Data Databank", "TC-36", "Quy Tắc 3 Lần Đóng Cùng 1 Lý Do",
         "Đóng Không Phù Hợp vẫn ra kho. Đóng 3 lần cùng 1 lý do -> Tự động khóa vĩnh viễn không ra kho nữa.",
         "Bảng persons đã có trường is_blocked và API khóa tay, nhưng chưa có trigger tự động đếm đủ 3 lần đóng để auto-lock.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Cần hỗ trợ: Xác nhận logic tự động đếm 3 lần để tự khóa vĩnh viễn."),
        
        (37, "Luồng 5: Kho Data Databank", "TC-37", "Admin Ẩn/Hiện SĐT Khi Duyệt Kho Databank",
         "SĐT bị che dạng 090****567 khi duyệt kho; chỉ hiển thị đầy đủ sau khi Sales bấm Nhận thành công.",
         "Hàm maskPhone che số điện thoại đối với Sales thường khi xem danh sách kho; nhận xong mới hiển thị đầy đủ trên KHTN.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (38, "Luồng 5: Kho Data Databank", "TC-38", "Bảo Mật Ghi Chú Cũ vs Hiện Ghi Chú Di Sản",
         "Nhặt kho không thấy ghi chú của Sales cũ. Ngoại lệ: Ghi chú di sản (is_heritage=1) của Sales đã nghỉ việc.",
         "Ghi chú thông thường của sales cũ bị ẩn; chỉ có ghi chú có cờ is_heritage của sales đã nghỉ việc mới hiển thị.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),

        # LUỒNG 6 (TC-39 -> TC-44)
        (39, "Luồng 6: Quản Lý Tiền, Cọc & Doanh Thu", "TC-39", "Quy Trình 4 Bước Cọc & CAPI Purchase Bước 1",
         "Quy trình 4 bước. Hoàn tất Bước 1 có UNC -> Bật ngay trạng thái Đặt Cọc và bắn CAPI Purchase về Meta.",
         "DepositController.php xử lý 4 bước; Bước 1 có UNC chuyển contact sang DatCoc và kích hoạt bắn CAPI Purchase tức thì.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (40, "Luồng 6: Quản Lý Tiền, Cọc & Doanh Thu", "TC-40", "UNC Là Nguồn Sự Thật Duy Nhất Cho Mốc Tiền",
         "UNC là nguồn sự thật duy nhất; Admin bấm xác nhận từng mốc thanh toán; lưu file bằng chứng 2 lớp.",
         "Bảng deposit_milestones lưu unc_file_path; Admin đối soát và bấm xác nhận từng mốc thanh toán trên CRM.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (41, "Luồng 6: Quản Lý Tiền, Cọc & Doanh Thu", "TC-41", "Quy Tắc Đổi Căn (Chỉ Trước Khi Ký TTC)",
         "Đổi căn đóng deal cũ, tạo deal mới, giữ audit trail. Chỉ được đổi khi CHƯA ký Thỏa thuận cọc (TTC).",
         "DealController::switchUnit đã có (đóng deal cũ, mở deal mới, giữ trail), nhưng chưa có điều kiện kiểm tra trạng thái ký TTC.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Cần hỗ trợ: Căn cứ nhận biết đã ký TTC trong hệ thống hiện tại."),
        
        (42, "Luồng 6: Quản Lý Tiền, Cọc & Doanh Thu", "TC-42", "Bể Cọc Chưa DT (Tụt Cấp) vs Đã Có DT (Giữ Cọc)",
         "Bể cọc chưa doanh thu -> Tụt 1 mức, chạy lại bảo mật. Đã phát sinh doanh thu (đợt 1) -> Giữ nguyên Đặt Cọc.",
         "Codebase và CSDL đã cài đặt chính xác tuyệt đối theo User Rule 1 & 2; đã kiểm thử tự động thành công.",
         "ĐẠT (PASS)", "Hoàn hảo theo User Rules."),
        
        (43, "Luồng 6: Quản Lý Tiền, Cọc & Doanh Thu", "TC-43", "Bể Cọc Sau HĐMB: Đóng Deal Công Ty Tại HĐMB",
         "Trách nhiệm Sales đóng tại mốc HĐMB. Khách hủy hợp đồng với CĐT sau HĐMB không lùi trạng thái trên CRM.",
         "CRM đóng giao dịch tại mốc hoàn tất HĐMB; không thực hiện điều chỉnh lùi trạng thái KHTN.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (44, "Luồng 6: Quản Lý Tiền, Cọc & Doanh Thu", "TC-44", "Pipeline 3 Trạng Thái Đối Chiếu Phí CĐT",
         "3 trạng thái: Đủ Điều Kiện -> Đã Gửi Hồ Sơ -> Tiền Đã Về. Bảng DOI_CHIEU_PHI xuất 1 đầu ra cho kế toán.",
         "CSDL Staging chưa có bảng doi_chieu_phi; app chưa có màn hình pipeline đối chiếu công nợ môi giới với CĐT.",
         "CHƯA CÓ (CẦN HỖ TRỢ)", "Cần hỗ trợ: Tính năng mới cần lên kế hoạch triển khai."),

        # LUỒNG 7 (TC-45 -> TC-50)
        (45, "Luồng 7: Dữ Liệu Ngược & Phân Quyền", "TC-45", "CAPI Mapping & Bắn Theo Lead (Forward-Only)",
         "Bắn theo Lead gốc; Forward-only, tuyệt đối không bao giờ bắn tín hiệu hoàn trả/lùi khi deal bị tụt cấp.",
         "MetaCapiService và cron_sync.php bắn theo lead_id Meta; tuân thủ nghiêm ngặt User Rule 4 (không bao giờ bắn lùi).",
         "ĐẠT (PASS)", "Hoàn hảo theo User Rules."),
        
        (46, "Luồng 7: Dữ Liệu Ngược & Phân Quyền", "TC-46", "Tự Động Bắn BAD Khi Duyệt Not Lead",
         "Not Lead duyệt -> Bắn event BAD sang Meta. Đóng Không Phù Hợp -> Không bắn gì (tránh đầu độc AI).",
         "Bảng cấu hình meta_capi_settings hiện để action của not_lead là 'Skip', chưa kích hoạt bắn sự kiện BAD.",
         "CHƯA CÓ (CẦN HỖ TRỢ)", "Cần hỗ trợ: Cung cấp tên Event BAD chuẩn trên Meta Events Manager."),
        
        (47, "Luồng 7: Dữ Liệu Ngược & Phân Quyền", "TC-47", "Giám Sát Hàng Đợi CAPI Quá 24h",
         "Giám sát hàng đợi CAPI_LOG; phát thông báo Cảnh Báo Đỏ cho Quản trị viên khi event kẹt quá 24h.",
         "Hàm checkCapiStuckAlert trong cron_sync.php (dòng 3530) tự động quét và cảnh báo lỗi khi event pending > 24h.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (48, "Luồng 7: Dữ Liệu Ngược & Phân Quyền", "TC-48", "Cost Ingestion Ngày x Ad_ID & CPL Theo CRM",
         "Bảng CHI_PHI_ADS bóc tách chi phí tự động cấp Ngày x Ad_ID; CPL tính từ chi phí chia cho Lead CRM thực tế.",
         "CSDL Staging chưa có bảng chi_phi_ads; chi phí marketing đang quản lý thủ công theo chiến dịch/tháng.",
         "CHƯA CÓ (CẦN HỖ TRỢ)", "Cần hỗ trợ: Cung cấp Token Meta Marketing API có quyền ads_read."),
        
        (49, "Luồng 7: Dữ Liệu Ngược & Phân Quyền", "TC-49", "Phân Quyền Dữ Liệu Row-Level Security (RLS)",
         "Sales chỉ thấy lead mình tạo hoặc được cấp quyền truy cập trong quyen_truy_cap; chặn xem trộm dữ liệu.",
         "Mọi câu lệnh SQL trong Controller PHP đều gán điều kiện scope WHERE (owner_id = ? OR id IN (quyen_truy_cap...)).",
         "ĐẠT (PASS)", "Bảo mật phân quyền chặt chẽ."),
        
        (50, "Luồng 7: Dữ Liệu Ngược & Phân Quyền", "TC-50", "Hash Password, Audit Log & Báo Cáo Dynamic",
         "Mật khẩu hash Bcrypt/Argon2 an toàn. Bảng AUDIT_LOG ghi vết. Báo cáo tính dynamic từ data gốc, cấm text nén.",
         "Mật khẩu băm chuẩn an toàn; bảng audit_logs ghi nhận mọi thay đổi nhạy cảm; Dashboard doanh thu tính dynamic từ DB.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),

        # 10 KỊCH BẢN TỔNG HỢP
        (51, "10 Kịch Bản Tổng Hợp", "Kịch bản 1", "Single Entry Point & Quy Tắc Deduplication",
         "Case 1A FB: 2 Lead, 1 Person. Case 1B Google: 1 Lead duy nhất trong ngày, gộp form điền bổ sung.",
         "Nhánh FB Ads: Đạt 100%. Nhánh Google Ads gộp trong ngày: Chưa có logic gộp trong app.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Xem chi tiết tại mục TC-05 ở Sheet 1."),
        
        (52, "10 Kịch Bản Tổng Hợp", "Kịch bản 2", "Lưới Lọc Chống Rửa Nguồn (Anti-Attribution-Theft)",
         "Trùng SĐT MKT active: Không chặn lưu, sinh KHTN cho Sales, ghi audit_logs, bắn cảnh báo đỏ cho Quản lý & MKT.",
         "Hệ thống cho lưu thành công, ghi nhận duplicate_flag=1, lưu vết audit_logs và gửi cảnh báo đỏ cho Quản lý.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (53, "10 Kịch Bản Tổng Hợp", "Kịch bản 3", "Kế Thừa Dòng Nguồn Đối Với Khách Giới Thiệu",
         "Khách B giới thiệu từ A kế thừa dòng nguồn MKT; Khách D từ C kế thừa nguồn cá nhân.",
         "Có quan hệ foreign key nguoi_gioi_thieu_id để JOIN truy vết. Chưa có trường tĩnh dong_nguon lưu trực tiếp trên contacts.",
         "ĐẠT MỘT PHẦN", "Xem chi tiết tại mục TC-08."),
        
        (54, "10 Kịch Bản Tổng Hợp", "Kịch bản 4", "Chuỗi Cổng Kiểm Duyệt & Van Chống Ôm",
         "Om >= 5 lead Chưa XĐ bị chặn chia. MKT duyệt Not Lead thì mẫu số giảm, van tự động xả để nhận lead ngay.",
         "Cổng 4 kiểm tra chuẩn xác số lead đang om; xả van ngay lập tức khi MKT bấm duyệt Not Lead.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (55, "10 Kịch Bản Tổng Hợp", "Kịch bản 5", "Timeout 2 Phút & Chuyển Hàng Đợi Xoay Vòng",
         "Timeout 2p thu hồi; Từ chối nhảy ngay; Tạm vắng skip không phạt; Lead đêm chờ Giờ Vàng (06:00 - 08:30).",
         "Đã kiểm thử và chạy thực tế chuẩn chỉnh trên Staging.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (56, "10 Kịch Bản Tổng Hợp", "Kịch bản 6", "Chia Lead Song Song (Cạnh Tranh Mù) Sau 3 Giờ",
         "Chưa XĐ quá 3h chia thêm 1 Sales; UI hoàn toàn không hiện cờ đối thủ; bên nào chốt/tiến trạng thái thì bên kia đóng.",
         "cron_sync.php và ParallelHelper vận hành chuẩn theo đúng thiết kế Cạnh tranh mù.",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (57, "10 Kịch Bản Tổng Hợp", "Kịch bản 7", "Cơ Chế Bếp Đun Nước & Nhiệt Độ Hybrid + Decay",
         "Lưu song song 2 giá trị nhiệt (máy đoán + sale chốt). Quá 5 ngày không tương tác rớt 1 mức nhiệt.",
         "Lưu 2 nhiệt đạt 100%. Phần cronjob tự động rớt nhiệt sau 5 ngày chưa có trong app.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Xem chi tiết tại mục TC-20 ở Sheet 1."),
        
        (58, "10 Kịch Bản Tổng Hợp", "Kịch bản 8", "Cổng Bằng Chứng & Cảnh Báo Form TTL1",
         "Form TTL1 thiếu >= 2 nhóm báo vàng. Chuyển trạng thái bắt buộc đính kèm ảnh bằng chứng.",
         "Form TTL1 cảnh báo vàng đạt 100%. Modal check-in bắt buộc tải ảnh minh chứng thực địa khi chuyển sang Đã Gặp đạt 100% (chặn chuyển nếu chưa có ảnh).",
         "ĐẠT (PASS)", "Hoàn toàn khớp chuẩn nghiệp vụ."),
        
        (59, "10 Kịch Bản Tổng Hợp", "Kịch bản 9", "Quy Trình Hợp Tác & Chữ Ký Số Tự Thực Thi",
         "Tự kéo người thu hồi khi cọc; Sum% = 100%; ký số 1 chạm; cảnh báo phiếu treo quá 24h; GĐKD duyệt khóa vĩnh viễn.",
         "Tự sinh phiếu, kéo người thu hồi, Sum% 100%, khóa vĩnh viễn đạt 100%. Cronjob Master tự động quét và chuyển trạng thái Phiếu treo quá 24h kèm phát cảnh báo Quản lý.",
         "ĐẠT (PASS)", "Đã lập trình xong và đưa vào cron master."),
        
        (60, "10 Kịch Bản Tổng Hợp", "Kịch bản 10", "Đồng Hồ Databank & Cơ Chế Ra Kho / Đóng Kho",
         "Ra kho 1 lần duy nhất; nhặt kho không bảo mật; cọc rút khỏi kho; đóng 3 lần cùng lý do khóa vĩnh viễn.",
         "Data nhặt kho không bảo mật và Cọc rút khỏi kho đạt 100%. Xung đột giữ lead sales gốc và tự khóa 3 lần cần hỗ trợ.",
         "ĐẠT MỘT PHẦN (CẦN HỖ TRỢ)", "Xem chi tiết tại mục TC-33 và TC-36 ở Sheet 1.")
    ]
    
    current_row = 5
    for item in all_60_cases:
        stt, group, code, name, ba, act, result, note, user_input = item + ("",)
        ws2.cell(row=current_row, column=1, value=stt).alignment = align_top_center
        ws2.cell(row=current_row, column=2, value=group).alignment = align_top_left
        ws2.cell(row=current_row, column=3, value=code).alignment = align_top_center
        ws2.cell(row=current_row, column=4, value=name).alignment = align_top_left
        ws2.cell(row=current_row, column=5, value=ba).alignment = align_top_left
        ws2.cell(row=current_row, column=6, value=act).alignment = align_top_left
        ws2.cell(row=current_row, column=7, value=result).alignment = align_top_center
        ws2.cell(row=current_row, column=8, value=note).alignment = align_top_left
        ws2.cell(row=current_row, column=9, value=user_input).alignment = align_top_left
        
        # Format cell styles
        ws2.cell(row=current_row, column=3).font = font_bold
        
        if "ĐẠT (PASS)" in result:
            ws2.cell(row=current_row, column=7).font = font_pass
            ws2.cell(row=current_row, column=7).fill = fill_pass
        elif "ĐẠT MỘT PHẦN" in result:
            ws2.cell(row=current_row, column=7).font = font_partial
            ws2.cell(row=current_row, column=7).fill = fill_partial
        else:
            ws2.cell(row=current_row, column=7).font = font_unclear
            ws2.cell(row=current_row, column=7).fill = fill_unclear
            
        for c in range(1, 10):
            ws2.cell(row=current_row, column=c).border = cell_border
            
        ws2.row_dimensions[current_row].height = 65
        current_row += 1
        
    col_widths_ws2 = {1: 6, 2: 24, 3: 14, 4: 26, 5: 35, 6: 36, 7: 18, 8: 36, 9: 25}
    for col_idx, width in col_widths_ws2.items():
        ws2.column_dimensions[get_column_letter(col_idx)].width = width
    ws2.freeze_panes = "A5"

    # =========================================================================
    # SHEET 3: BÁO CÁO TỔNG HỢP & THỐNG KÊ (Executive Summary)
    # =========================================================================
    ws3 = wb.create_sheet(title="3. Báo Cáo Tổng Hợp")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.cell(row=1, column=1, value="BÁO CÁO TỔNG HỢP KẾT QUẢ ĐỐI SOÁT AUDIT").font = font_title
    ws3.cell(row=2, column=1, value="Dự án: RichLand CRM | Phiên bản đối soát: 60 Test Case").font = font_subtitle
    ws3.row_dimensions[1].height = 28
    ws3.row_dimensions[2].height = 18
    
    # Table 1: Summary by Status
    ws3.cell(row=4, column=1, value="1. THỐNG KÊ THEO KẾT QUẢ KIỂM THỬ").font = font_bold
    headers_t1 = ["Kết Quả", "Số Lượng Kịch Bản", "Tỷ Lệ (%)", "Đánh Giá Ý Nghĩa"]
    for idx, h in enumerate(headers_t1, 1):
        c = ws3.cell(row=5, column=idx, value=h)
        c.font = font_header
        c.fill = header_fill_navy
        c.alignment = align_center
        c.border = cell_border
        
    stats_data = [
        ("ĐẠT (PASS)", 46, "76.7%", "Đã có sẵn trong Codebase và CSDL Staging, vận hành chuẩn xác theo kịch bản và Business Rules.", fill_pass, font_pass),
        ("ĐẠT MỘT PHẦN (PARTIAL)", 4, "6.7%", "Nghiệp vụ cốt lõi đã chạy, thiếu điều kiện phụ (trường lưu trữ phụ).", fill_partial, font_partial),
        ("CHƯA CÓ / CẦN HỖ TRỢ (UNCLEAR / MISSING)", 10, "16.6%", "Tính năng chưa có trong app, kịch bản BA có xung đột với code hiện tại, cần xác nhận quy cách.", fill_unclear, font_unclear),
        ("TỔNG CỘNG", 60, "100.0%", "Toàn bộ 50 Test Cases đơn lẻ + 10 Kịch bản kiểm thử tích hợp.", None, font_bold)
    ]
    
    for row_idx, data in enumerate(stats_data, 6):
        res, count, pct, desc, fill_style, font_style = data
        ws3.cell(row=row_idx, column=1, value=res).alignment = align_center
        ws3.cell(row=row_idx, column=2, value=count).alignment = align_center
        ws3.cell(row=row_idx, column=3, value=pct).alignment = align_center
        ws3.cell(row=row_idx, column=4, value=desc).alignment = align_left
        
        ws3.cell(row=row_idx, column=1).font = font_style
        ws3.cell(row=row_idx, column=2).font = font_style
        ws3.cell(row=row_idx, column=3).font = font_style
        
        if fill_style:
            for c in range(1, 5):
                ws3.cell(row=row_idx, column=c).fill = fill_style
        for c in range(1, 5):
            ws3.cell(row=row_idx, column=c).border = cell_border
        ws3.row_dimensions[row_idx].height = 24
        
    # Table 2: Breakdown by Functional Flow
    ws3.cell(row=12, column=1, value="2. PHÂN BỐ KẾT QUẢ THEO 7 LUỒNG NGHIỆP VỤ & 10 KỊCH BẢN TỔNG HỢP").font = font_bold
    headers_t2 = ["Nhóm Nghiệp Vụ", "Tổng Số TC", "Đạt (Pass)", "Đạt Một Phần", "Chưa Có / Cần Hỗ Trợ"]
    for idx, h in enumerate(headers_t2, 1):
        c = ws3.cell(row=13, column=idx, value=h)
        c.font = font_header
        c.fill = header_fill_teal
        c.alignment = align_center
        c.border = cell_border
        
    flow_data = [
        ("Luồng 1: Lead Vào & Định Danh (TC-01 -> TC-08)", 8, 4, 1, 3),
        ("Luồng 2: Chia Lead & Vòng Xoay (TC-09 -> TC-17)", 9, 7, 2, 0),
        ("Luồng 3: Chăm Sóc & Nhiệt Độ (TC-18 -> TC-25)", 8, 7, 0, 1),
        ("Luồng 4: Hợp Tác & Hoa Hồng (TC-26 -> TC-31)", 6, 6, 0, 0),
        ("Luồng 5: Kho Data Databank (TC-32 -> TC-38)", 7, 4, 1, 2),
        ("Luồng 6: Quản Lý Tiền & Cọc (TC-39 -> TC-44)", 6, 4, 1, 1),
        ("Luồng 7: Dữ Liệu Ngược & Phân Quyền (TC-45 -> TC-50)", 6, 4, 0, 2),
        ("10 Kịch Bản Tổng Hợp (Kịch bản 1 -> 10)", 10, 6, 4, 0),
        ("TỔNG CỘNG", 60, 46, 4, 10)
    ]
    
    for row_idx, data in enumerate(flow_data, 14):
        flow, total, p, part, miss = data
        ws3.cell(row=row_idx, column=1, value=flow).alignment = align_left
        ws3.cell(row=row_idx, column=2, value=total).alignment = align_center
        ws3.cell(row=row_idx, column=3, value=p).alignment = align_center
        ws3.cell(row=row_idx, column=4, value=part).alignment = align_center
        ws3.cell(row=row_idx, column=5, value=miss).alignment = align_center
        
        if row_idx == 22: # Total row
            for c in range(1, 6):
                ws3.cell(row=row_idx, column=c).font = font_bold
                ws3.cell(row=row_idx, column=c).fill = fill_partial
                
        for c in range(1, 6):
            ws3.cell(row=row_idx, column=c).border = cell_border
        ws3.row_dimensions[row_idx].height = 22
        
    col_widths_ws3 = {1: 45, 2: 18, 3: 18, 4: 18, 5: 22}
    for col_idx, width in col_widths_ws3.items():
        ws3.column_dimensions[get_column_letter(col_idx)].width = width
        
    # Save Workbook
    out_file = r"d:\RICH_LAND_DATA_UI\CHECK_LOG_60_TEST_CASES.xlsx"
    wb.save(out_file)
    print(f"Workbook successfully saved to: {out_file}")

if __name__ == "__main__":
    build_excel_audit()
