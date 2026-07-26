import pptxgen from "pptxgenjs";

console.log("=================================================");
console.log("🚀 MÔ PHỎNG THIẾT KẾ DASHBOARD UI - 60 SLIDE");
console.log("=================================================");

let pptx = new pptxgen();

// Thiết lập tỷ lệ màn hình rộng 16:9
pptx.layout = "LAYOUT_16x9";

// Cấu hình bảng màu Dashboard UI cao cấp (Light Theme)
const COLORS = {
    bg: "F8FAFC",         // Slate Light Canvas Background
    sidebarBg: "FFFFFF",  // Pure White Sidebar
    headerBg: "FFFFFF",   // Pure White Top Bar
    cardBg: "FFFFFF",     // Pure White Cards
    border: "E2E8F0",     // Very Light Gray Border
    textDark: "0F172A",   // Slate Dark Main Text
    textGray: "475569",   // Muted Slate-Gray Body Text
    textMuted: "94A3B8",  // Light Muted Gray
    crimson: "BD1D2D",    // primary brand Crimson Red
    crimsonBg: "FEE2E2",  // Light Crimson for Badges
    green: "065F46",      // Success Green Text
    greenBg: "D1FAE5"     // Success Green Background for Badges
};

// Helper tạo slide giao diện Dashboard Web App
function createBaseSlide(title, breadcrumbText) {
    let slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };

    // 1. THANH MENU DỌC BÊN TRÁI (Left Sidebar Menu)
    slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0,
        y: 0,
        w: 0.6,
        h: 5.625,
        fill: { color: COLORS.sidebarBg },
        line: { color: COLORS.border, width: 1 }
    });

    // Logo ứng dụng trên Sidebar
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.15,
        y: 0.2,
        w: 0.3,
        h: 0.3,
        fill: { color: COLORS.crimson },
        rectRadius: 0.2
    });

    // Các nút điều hướng mô phỏng trên Sidebar (App Menu Icons)
    let sidebarIconsY = [0.8, 1.3, 1.8, 2.3, 2.8, 3.3];
    sidebarIconsY.forEach((iconY, idx) => {
        // Tô màu đỏ nổi bật cho nút đầu tiên để giả lập tab đang được active
        let isFirst = idx === 0;
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: 0.18,
            y: iconY,
            w: 0.24,
            h: 0.24,
            fill: { color: isFirst ? COLORS.crimsonBg : "F1F5F9" },
            line: { color: isFirst ? COLORS.crimson : COLORS.border, width: 1 },
            rectRadius: 0.15
        });
    });

    // 2. THANH TIÊU ĐỀ NGANG PHÍA TRÊN (Top App Header)
    slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.6,
        y: 0,
        w: 9.4,
        h: 0.6,
        fill: { color: COLORS.headerBg },
        line: { color: COLORS.border, width: 1 }
    });

    // Breadcrumb định vị vị trí trang
    slide.addText(`RICH LAND CRM   /   ${breadcrumbText.toUpperCase()}`, {
        x: 0.8,
        y: 0.15,
        w: 5.0,
        h: 0.3,
        fontSize: 8.5,
        fontFace: "Segoe UI",
        color: COLORS.textMuted,
        bold: true,
        valign: "middle"
    });

    // Ô tìm kiếm mô phỏng bên phải (Search Input Box)
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 7.2,
        y: 0.15,
        w: 2.2,
        h: 0.3,
        fill: { color: "F8FAFC" },
        line: { color: COLORS.border, width: 1 },
        rectRadius: 0.15
    });
    slide.addText("Search database...", {
        x: 7.35,
        y: 0.15,
        w: 1.8,
        h: 0.3,
        fontSize: 8,
        fontFace: "Segoe UI",
        color: COLORS.textMuted,
        valign: "middle"
    });

    // 3. TIÊU ĐỀ TRANG CHÍNH TRÊN CANVAS
    slide.addText(title, {
        x: 0.8,
        y: 0.8,
        w: 8.8,
        h: 0.5,
        fontSize: 19,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        bold: true,
        valign: "middle"
    });

    return slide;
}

// Helper vẽ thẻ panel (Card Container) màu trắng bo góc mềm mại
function addCard(slide, x, y, w, h, cardTitle, lines, isGreen = false) {
    // Vẽ nền thẻ trắng với đường viền mỏng
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: isGreen ? COLORS.green : COLORS.border, width: 1 },
        rectRadius: 0.05
    });

    let textY = y + 0.15;
    let contentH = h - 0.3;

    // Tiêu đề thẻ dạng menu con
    if (cardTitle) {
        slide.addText(cardTitle.toUpperCase(), {
            x: x + 0.2,
            y: textY,
            w: w - 0.4,
            h: 0.3,
            fontSize: 9.5,
            fontFace: "Segoe UI",
            color: isGreen ? COLORS.green : COLORS.crimson,
            bold: true,
            valign: "top"
        });
        textY += 0.32;
        contentH -= 0.32;
    }

    // Format các dòng gạch đầu dòng dạng app list item
    let formattedText = lines.map(line => {
        if (line.startsWith("- ")) {
            return "▪  " + line.substring(2);
        }
        return line;
    }).join("\n\n");

    slide.addText(formattedText, {
        x: x + 0.2,
        y: textY,
        w: w - 0.4,
        h: contentH,
        fontSize: 9.2,
        fontFace: "Segoe UI",
        color: COLORS.textGray,
        valign: "top",
        lineSpacing: 14
    });
}

// Helper vẽ huy hiệu (Pill Badge) trạng thái
function addBadge(slide, x, y, text, isGreen = false) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: 1.1,
        h: 0.25,
        fill: { color: isGreen ? COLORS.greenBg : COLORS.crimsonBg },
        rectRadius: 0.5
    });
    slide.addText(text, {
        x: x,
        y: y,
        w: 1.1,
        h: 0.25,
        fontSize: 8,
        fontFace: "Segoe UI",
        color: isGreen ? COLORS.green : COLORS.crimson,
        bold: true,
        align: "center",
        valign: "middle"
    });
}

// ============================================================================
// PHẦN 1: KIẾN TRÚC & ĐỊNH TUYẾN (SLIDE 1 - 10)
// ============================================================================

// Slide 1: Trang bìa (Widescreen Cover)
let s1 = pptx.addSlide();
s1.background = { color: COLORS.bg };
s1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.2, h: 5.625, fill: { color: COLORS.crimson } });
s1.addText("RICH LAND CRM SYSTEM ARCHITECTURE", {
    x: 0.8, y: 1.6, w: 8.5, h: 0.4, fontSize: 13, fontFace: "Segoe UI", color: COLORS.crimson, bold: true
});
s1.addText("KIẾN TRÚC HỆ THỐNG & LUỒNG HOẠT ĐỘNG LÕI", {
    x: 0.8, y: 2.1, w: 8.5, h: 1.2, fontSize: 32, fontFace: "Segoe UI", color: COLORS.textDark, bold: true
});
s1.addText("Báo cáo phân tích chuyên sâu về hạ tầng lead, 5 cổng duyệt, quy tắc giao dịch và hàng đợi bất đồng bộ.", {
    x: 0.8, y: 3.4, w: 8.0, h: 0.6, fontSize: 11, fontFace: "Segoe UI", color: COLORS.textGray
});
s1.addText("PHIÊN BẢN HỆ THỐNG V1.9.0", {
    x: 0.8, y: 4.5, w: 8.0, h: 0.3, fontSize: 9, fontFace: "Segoe UI", color: COLORS.textMuted, bold: true
});

// Slide 2: Mục lục (Table of Contents)
let s2 = createBaseSlide("Danh Mục Nội Dung Thuyết Trình", "Mục lục");
addCard(s2, 0.8, 1.4, 4.2, 3.6, "Cấu trúc nửa đầu", [
    "- Phần 1: Kiến trúc ứng dụng & luồng định tuyến (Slides 3-10)",
    "- Phần 2: Thuật toán chia lead & 5 cổng duyệt bảo vệ (Slides 11-20)",
    "- Phần 3: Quy tắc đặt cọc, hủy cọc & đối soát hoa hồng (Slides 21-30)"
]);
addCard(s2, 5.3, 1.4, 4.2, 3.6, "Cấu trúc nửa sau", [
    "- Phần 4: Hệ thống tri thức AI & Vector RAG (Slides 31-38)",
    "- Phần 5: Đồng bộ hai chiều & Trung tâm lệnh Chatbot (Slides 39-46)",
    "- Phần 6: Hàng đợi bất đồng bộ & Khung kiểm thử DevOps (Slides 47-60)"
]);

// Slide 3: Executive Summary
let s3 = createBaseSlide("Tóm Tắt Tổng Quan Hệ Thống", "Tổng quan");
addCard(s3, 0.8, 1.4, 4.2, 3.6, "Mục tiêu thiết kế", [
    "- Phân chia Lead tự động tức thời với độ trễ xử lý <50ms.",
    "- Ngăn ngừa tình trạng ôm lead, giấu lead hoặc phân bổ thiếu công bằng.",
    "- Đảm bảo vết kiểm toán (audit trail) chính xác cho dòng tiền cọc và hoa hồng."
]);
addCard(s3, 5.3, 1.4, 4.2, 3.6, "Giải pháp kỹ thuật lõi", [
    "- Sử dụng API Router tập trung qua cổng bảo mật JWT.",
    "- Xây dựng 5 Gate kiểm duyệt thông minh dựa trên Check-in và Roster.",
    "- Offload các tác vụ gửi tin qua Zalo/Telegram vào hàng đợi Database."
]);

// Slide 4: Client-Server Architecture
let s4 = createBaseSlide("Kiến Trúc Client - Server Tổng Thể", "Kiến trúc");
addCard(s4, 0.8, 1.4, 4.2, 3.6, "Frontend React SPA", [
    "- Xây dựng trên nền tảng React, Vite và TypeScript tối ưu dung lượng gói tin.",
    "- Sử dụng Tailwind CSS cho giao diện đồng bộ, tốc độ dựng trang nhanh.",
    "- Kết nối API thông qua Axios Client cấu hình tự động gắn JWT Token."
]);
addCard(s4, 5.3, 1.4, 4.2, 3.6, "Backend API & Database", [
    "- API viết bằng PHP thuần để đảm bảo thời gian khởi động (bootstrap) tối thiểu.",
    "- CSDL MySQL/MariaDB lưu giữ toàn bộ dữ liệu quan hệ.",
    "- Tận dụng View ảo (consultants, accounts) để tương thích ngược."
]);

// Slide 5: SPA Route Architecture
let s5 = createBaseSlide("Cấu Trúc Định Tuyến & Giữ DOM AppTabs", "Kiến trúc");
addCard(s5, 0.8, 1.4, 4.2, 3.6, "react-router-dom định tuyến", [
    "- Quản lý tập trung các đường dẫn tại tệp App.tsx.",
    "- Phân tách các trang theo phân quyền người dùng cụ thể.",
    "- Tích hợp lazy loading để tăng tốc độ tải trang lần đầu."
]);
addCard(s5, 5.3, 1.4, 4.2, 3.6, "Giải pháp AppTabs", [
    "- Thay vì Unmount các component khi đổi trang, AppTabs giữ nguyên DOM.",
    "- Duy trì state của các bộ lọc và trang dữ liệu khi Sale chuyển tab.",
    "- Giảm tải số lần gọi API tải lại trang không cần thiết."
]);

// Slide 6: Single Entry Point (index.php)
let s6 = createBaseSlide("Cổng API Backend Duy Nhất", "Backend");
addCard(s6, 0.8, 1.4, 4.2, 3.6, "Cơ chế Route qua Action", [
    "- Mọi yêu cầu HTTP đổ về tệp backend/index.php duy nhất.",
    "- Phân loại luồng xử lý dựa trên tham số query action.",
    "- Quản lý CORS tập trung, chặn các truy cập ngoài danh sách cho phép."
]);
addCard(s6, 5.3, 1.4, 4.2, 3.6, "Xử lý lỗi tập trung", [
    "- Khối try-catch bao bọc toàn hệ thống bắt toàn bộ lỗi runtime.",
    "- Chuyển đổi mã lỗi CSDL thành phản hồi JSON chuẩn hóa.",
    "- Ngăn ngừa rò rỉ cấu trúc tệp tin hệ thống ra môi trường ngoài."
]);

// Slide 7: Authentication Engine (requireAuth)
let s7 = createBaseSlide("Cơ Chế Xác Thực Người Dùng JWT", "Xác thực");
addCard(s7, 0.8, 1.4, 4.2, 3.6, "requireAuth Middleware", [
    "- Trích xuất Bearer Token từ tiêu đề Authorization.",
    "- Hỗ trợ lấy token từ query string cho các tiến trình kiểm thử nhanh.",
    "- Giải mã cấu trúc token để lấy định danh user và thời gian hết hạn."
]);
addCard(s7, 5.3, 1.4, 4.2, 3.6, "Quản lý Token", [
    "- Thời gian sống của token được giới hạn bảo mật.",
    "- Chữ ký JWT mã hóa bằng khóa bí mật riêng cấu hình trên Staging.",
    "- Từ chối truy cập ngay lập tức nếu token bị chỉnh sửa hoặc hết hạn."
]);

// Slide 8: Role Normalization
let s8 = createBaseSlide("Chuẩn Hóa Vai Trò Người Dùng", "Xác thực");
addCard(s8, 0.8, 1.4, 4.2, 3.6, "Ánh xạ vai trò", [
    "- Frontend truyền quyền dạng 'sale' để hiển thị giao diện.",
    "- requireAuth tự động chuyển đổi thành 'sales' cho đồng bộ backend.",
    "- Tránh tình trạng sai lệch kiểm tra quyền giữa client và server."
]);
addCard(s8, 5.3, 1.4, 4.2, 3.6, "Khắc phục lỗi Undefined Index", [
    "- Tự động ánh xạ trường id thành user_id trong dữ liệu phiên làm việc.",
    "- Đồng bộ khóa name và full_name để tương thích các đoạn code cũ.",
    "- Chặn hoàn toàn các cảnh báo Notice từ PHP làm gãy cấu trúc JSON trả về."
]);

// Slide 9: Multi-Tenant Isolation
let s9 = createBaseSlide("Cô Lập Dữ Liệu Đa Khách Thuê", "Bảo mật");
addCard(s9, 0.8, 1.4, 4.2, 3.6, "Phạm vi tenant_id", [
    "- Mỗi bản ghi liên quan đến khách hàng, user đều chứa khóa tenant_id.",
    "- Mọi câu lệnh SQL truy vấn đều được tự động thêm điều kiện lọc tenant.",
    "- Đảm bảo các doanh nghiệp dùng chung CSDL không nhìn thấy dữ liệu của nhau."
]);
addCard(s9, 5.3, 1.4, 4.2, 3.6, "Ngăn ngừa truy cập chéo", [
    "- Kiểm duyệt dữ liệu đầu vào chặn đứng việc truyền ID giả mạo.",
    "- Cơ chế ghi nhật ký tự động báo động khi có dấu hiệu truy cập chéo tenant.",
    "- Đảm bảo an toàn tuyệt đối cho dữ liệu khách hàng tiềm năng."
]);

// Slide 10: Tóm tắt phần 1
let s10 = createBaseSlide("Tóm Tắt Takeaways Phần 1", "Tổng quan");
addCard(s10, 0.8, 1.4, 8.8, 3.6, "Tóm tắt kỹ thuật", [
    "- Kiến trúc React SPA kết hợp PHP API tối giản giúp tăng hiệu năng truy cập vượt trội.",
    "- Hệ thống bảo mật 3 lớp: CORS -> JWT requireAuth -> Tenant ID Scoping bảo vệ dữ liệu tối đa.",
    "- Giữ DOM bằng AppTabs tối ưu hóa hoàn toàn tài nguyên CPU/RAM phía client."
]);

// ============================================================================
// PHẦN 2: THUẬT TOÁN CHIA LEAD & GATES (SLIDE 11 - 20)
// ============================================================================

// Slide 11: Luồng lead đầu vào
let s11 = createBaseSlide("Vòng Đời Của Một Lead Đầu Vào", "Chia Lead");
addCard(s11, 0.8, 1.4, 4.2, 3.6, "Tiếp nhận lead", [
    "- Lead đổ về từ Google Sheets, Landing Page hoặc webhook Facebook Ads.",
    "- Ghi nhận vào bảng leads dạng trạng thái thô để lưu vết lịch sử.",
    "- Hệ thống chuẩn hóa số điện thoại bằng hàm normalizePhone."
]);
addCard(s11, 5.3, 1.4, 4.2, 3.6, "Xác minh trùng lặp", [
    "- Tra cứu bảng persons bằng SĐT để tìm kiếm khách hàng cũ.",
    "- Nếu tìm thấy: Giữ nguyên chủ sở hữu cũ để chăm sóc (bảo mật khách hàng).",
    "- Nếu là khách mới: Kích hoạt luồng phân bổ xoay vòng trong chiến dịch."
]);

// Slide 12: Round-Robin Distribution
let s12 = createBaseSlide("Thuật Toán Xoay Vòng Round-Robin", "Chia Lead");
addCard(s12, 0.8, 1.4, 4.2, 3.6, "getNextConsultantInRound", [
    "- Đọc cột last_assigned_consultant_id trong bảng distribution_rounds.",
    "- Sắp xếp danh sách Sale đăng ký tham gia vòng theo thứ tự ID tăng dần.",
    "- Tìm vị trí Sale kế tiếp sau Sale vừa nhận lead gần nhất."
]);
addCard(s12, 5.3, 1.4, 4.2, 3.6, "Đảm bảo tính công bằng", [
    "- Hỗ trợ tỷ lệ nhận lead (receive_ratio) khác nhau giữa các Sale.",
    "- Cập nhật ngay mốc thời gian nhận lead cuối cùng vào CSDL.",
    "- Tự động bỏ qua các Sale không vượt qua các rào chắn kiểm duyệt."
]);

// Slide 13: Gate 1: Campaign & Project Roster
let s13 = createBaseSlide("Gate 1: Dự Án & Roster Chiến Dịch", "5 Gates");
addCard(s13, 0.8, 1.4, 4.2, 3.6, "Phân loại theo dự án", [
    "- Quét từ khóa chiến dịch hoặc ghi chú lead để nhận diện dự án phù hợp.",
    "- Dự án được quản lý trong bảng projects trạng thái đang hoạt động.",
    "- Nếu nhận diện được dự án: Bắt buộc đi qua cổng Roster."
]);
addCard(s13, 5.3, 1.4, 4.2, 3.6, "Project Roster check", [
    "- Tra cứu bảng project_roster để tìm danh sách Sale được cấp quyền.",
    "- Chỉ chia lead dự án cho Sale nằm trong roster đăng ký của dự án đó.",
    "- Chặn chia lead nhầm cho Sale chưa được đào tạo dự án tương ứng."
]);

// Slide 14: Gate 2: Selfie Check-in
let s14 = createBaseSlide("Gate 2: Điểm Danh & Check-in Đầu Ngày", "5 Gates");
addCard(s14, 0.8, 1.4, 4.2, 3.6, "Rào chắn Check-in", [
    "- Sale làm việc ca ngày bắt buộc phải thực hiện selfie check-in trên App.",
    "- Trạng thái check-in phải là approved (hoặc pending_approval tùy cấu hình).",
    "- Chưa check-in đầu ngày đồng nghĩa với việc không sẵn sàng -> Bị loại trừ."
]);
addCard(s14, 5.3, 1.4, 4.2, 3.6, "Trường hợp ngoại lệ", [
    "- Tự động bỏ qua kiểm tra check-in đối với Sale trực ca đêm đã duyệt.",
    "- Bỏ qua check-in khi có đăng ký trực ngày lễ/cuối tuần (weekend/holiday).",
    "- Đảm bảo Sale trực ca đặc biệt vẫn nhận được lead bình thường."
]);

// Slide 15: Gate 3: Vacation Mode & Status
let s15 = createBaseSlide("Gate 3: Trạng Thái Sale & Nghỉ Phép", "5 Gates");
addCard(s15, 0.8, 1.4, 4.2, 3.6, "Vacation Mode", [
    "- Sale đi gặp khách hoặc có việc cá nhân bật chế độ tạm vắng trên App.",
    "- Cột vacation_mode = 1 trong bảng consultants và users.",
    "- Hệ thống loại trừ ngay lập tức khi quét phân bổ lead."
]);
addCard(s15, 5.3, 1.4, 4.2, 3.6, "Lịch trình nghỉ phép", [
    "- Tra cứu mốc thời gian leave_start và leave_end đã đăng ký.",
    "- Nếu ngày hiện tại nằm trong lịch nghỉ phép -> Loại trừ.",
    "- Đảm bảo lead không bị giao cho người đang vắng mặt dẫn đến trôi lead."
]);

// Slide 16: Gate 4: Backpressure Valve (Van Chống Ôm Lead)
let s16 = createBaseSlide("Gate 4: Van Chống Ôm Lead (Backpressure)", "5 Gates");
addCard(s16, 0.8, 1.4, 4.2, 3.6, "Cơ chế chống găm giữ lead", [
    "- Đếm số lượng KHTN chưa tương tác của Sale trong chiến dịch hiện tại.",
    "- Điều kiện: pipeline = 'chua_xac_dinh', hoặc 'quan_tam' nhưng chưa có note.",
    "- Đảm bảo Sale tập trung chăm sóc lead cũ trước khi nhận lead mới."
]);
addCard(s16, 5.3, 1.4, 4.2, 3.6, "Chặn phân bổ vượt ngưỡng", [
    "- Đọc giới hạn cấu hình hệ thống backpressure_limit (mặc định 5).",
    "- Nếu số lead chưa xử lý >= giới hạn -> Chặn chia lead mới cho Sale đó.",
    "- Thúc đẩy tốc độ tương tác lead dưới 15 phút đầu tiên."
]);

// Slide 17: Gate 5: Quota & Limits
let s17 = createBaseSlide("Gate 5: Hạn Mức Phân Phối Lead", "5 Gates");
addCard(s17, 0.8, 1.4, 4.2, 3.6, "Quota theo thời gian", [
    "- Giới hạn số lead tối đa Sale được phép nhận theo Giờ, Ngày và Tháng.",
    "- Cấu hình linh hoạt qua bảng cài đặt hệ thống (system_settings).",
    "- Tra cứu nhật ký logs để đếm số lượng lead thực nhận."
]);
addCard(s17, 5.3, 1.4, 4.2, 3.6, "Quota Giờ Vàng", [
    "- Cài đặt khung giờ vàng (ví dụ: 06:00 - 08:30 sáng).",
    "- Giới hạn số lượng lead tối đa nhận được trong khung giờ này.",
    "- Giảm thiểu tình trạng dồn dập lead vào đầu ngày cho một cá nhân."
]);

// Slide 18: Fallback Routing
let s18 = createBaseSlide("Định Tuyến Dự Phòng Khi Bị Chặn Toàn Bộ", "Chia Lead");
addCard(s18, 0.8, 1.4, 4.2, 3.6, "Tình huống gãy luồng", [
    "- Toàn bộ Sale trong vòng xoay đều bị chặn bởi các Gate bảo vệ.",
    "- Hoặc không có Sale nào check-in/hoạt động tại thời điểm lead về.",
    "- Cần cơ chế dự phòng để lead không bị mồ côi."
]);
addCard(s18, 5.3, 1.4, 4.2, 3.6, "Luồng xử lý dự phòng", [
    "- Chuyển tiếp lead đến email liên hệ dự phòng cấu hình trong chiến dịch.",
    "- Hoặc phân phối trực tiếp cho các tài khoản Quản trị viên (Admin/Manager).",
    "- Đảm bảo lead luôn được lưu vết và gán người chịu trách nhiệm."
]);

// Slide 19: Starvation Prevention (Chống đói lead)
let s19 = createBaseSlide("Cơ Chế Chống Đói Lead Cho Sale Vắng Mặt", "Chia Lead");
addCard(s19, 0.8, 1.4, 4.2, 3.6, "Tích lũy điểm bỏ qua", [
    "- Khi Sale vắng mặt hoặc đi gặp khách hàng (bị Gate chặn).",
    "- Hệ thống tự động cộng dồn điểm cộng bù (skipped_credit) cho họ.",
    "- Ghi nhận chính xác số lượt phân bổ bị bỏ lỡ."
]);
addCard(s19, 5.3, 1.4, 4.2, 3.6, "Ưu tiên bù lượt", [
    "- Khi Sale quay lại hoạt động và điểm danh thành công.",
    "- Hệ thống kiểm tra và ưu tiên phân phối lead cho người có skipped_credit cao nhất.",
    "- Đảm bảo sự công bằng về doanh số lead nhận được giữa các thành viên."
]);

// Slide 20: Tóm tắt phần 2
let s20 = createBaseSlide("Tóm Tắt Toàn Cảnh Quy Trình Chia Lead", "Tổng quan");
addCard(s20, 0.8, 1.4, 8.8, 3.6, "Tổng kết 5 Gates bảo vệ", [
    "- Cổng 1 & 3: Lọc đúng người đăng ký roster dự án và đang ở trạng thái sẵn sàng hoạt động.",
    "- Cổng 2: Bắt buộc kỷ luật điểm danh check-in hàng ngày bằng hình ảnh selfie.",
    "- Cổng 4 & 5: Thiết lập van chống ôm lead và giới hạn hạn mức để điều tiết nhịp độ chăm sóc khách hàng.",
    "- Cơ chế Fallback và Starvation đảm bảo lead không bị thất lạc và cân bằng lợi ích cho Sale."
]);

// ============================================================================
// PHẦN 3: ĐẶT CỌC & BỂ CỌC & CAPI (SLIDE 21 - 30)
// ============================================================================

// Slide 21: Giao dịch cọc
let s21 = createBaseSlide("Quy Trình Giao Dịch Đặt Cọc & Doanh Thu", "Đặt Cọc");
addCard(s21, 0.8, 1.4, 4.2, 3.6, "Khởi tạo phiếu cọc", [
    "- Sale tạo phiếu cọc ghi nhận mã căn, giá bán, hoa hồng và các đợt thanh toán.",
    "- Phiếu cọc được tạo ở trạng thái chờ duyệt (pending_approval).",
    "- Khách hàng tải ảnh ủy nhiệm chi (UNC) lên để xác minh."
]);
addCard(s21, 5.3, 1.4, 4.2, 3.6, "Phê duyệt đợt thanh toán", [
    "- Kế toán kiểm tra dòng tiền thực tế đổ về tài khoản ngân hàng.",
    "- Duyệt đợt thanh toán thành approved trong hệ thống.",
    "- Hệ thống tự động tạo hóa đơn (invoice) tương ứng để đối soát."
]);

// Slide 22: Chi tiết thông tin phiếu cọc
let s22 = createBaseSlide("Thông Tin Thuộc Tính Phiếu Đặt Cọc", "Đặt Cọc");
addCard(s22, 0.8, 1.4, 4.2, 3.6, "Thông tin căn hộ & tài chính", [
    "- Căn hộ liên kết với bảng projects để xác định dự án.",
    "- Tổng giá trị hợp đồng, tỷ lệ hoa hồng chia sẻ cho Sale.",
    "- Mốc thời gian ký hợp đồng mua bán dự kiến."
]);
addCard(s22, 5.3, 1.4, 4.2, 3.6, "Quản lý đợt thanh toán (Milestones)", [
    "- Bảng deposit_milestones theo dõi từng đợt đóng tiền.",
    "- Trạng thái đợt tiền: pending (chờ), approved (đã thu), failed (lỗi).",
    "- Doanh thu công ty chỉ ghi nhận từ các đợt đóng tiền approved."
]);

// Slide 23: Quy tắc Bể cọc
let s23 = createBaseSlide("Quy Tắc Nghiệp Vụ Bể Cọc (Hủy Cọc)", "Bể Cọc");
addCard(s23, 0.8, 1.4, 4.2, 3.6, "Hai kịch bản hủy cọc", [
    "- Kịch bản 1: Hủy cọc khi chưa phát sinh doanh thu thực tế cho công ty.",
    "- Kịch bản 2: Hủy cọc khi đã đóng ít nhất đợt 1 (đã phát sinh dòng tiền thực).",
    "- Hai kịch bản có cách xử lý dữ liệu khách hàng hoàn toàn khác nhau."
]);
addCard(s23, 5.3, 1.4, 4.2, 3.6, "Đảm bảo tính chính trực dữ liệu", [
    "- Bảo vệ doanh thu thực tế được ghi nhận bởi kế toán.",
    "- Kích hoạt lại đồng hồ bảo mật dữ liệu khách hàng hợp lý.",
    "- Lưu lại vết hủy cọc cụ thể để phục vụ thanh tra tài chính."
]);

// Slide 24: Bể cọc trước doanh thu
let s24 = createBaseSlide("Bể Cọc Trước Khi Phát Sinh Doanh Thu", "Bể Cọc");
addCard(s24, 0.8, 1.4, 4.2, 3.6, "Điều kiện áp dụng", [
    "- Khách hàng hủy đặt cọc trước khi đóng tiền đợt 1.",
    "- Chưa có bất kỳ milestone nào được kế toán duyệt approved.",
    "- Chưa ghi nhận doanh thu thực tế nào cho công ty từ giao dịch này."
]);
addCard(s24, 5.3, 1.4, 4.2, 3.6, "Hành vi hệ thống", [
    "- Hạ trạng thái KHTN từ Đặt Cọc về trạng thái trước đó (Booking/Đã Gặp).",
    "- Giảm nhiệt độ chăm sóc xuống 1 cấp (ví dụ: Hot -> Warm).",
    "- Kích hoạt lại đồng hồ bảo mật chạy 3 tháng, có thể tự động trả về kho chung."
]);

// Slide 25: Bể cọc sau doanh thu
let s25 = createBaseSlide("Bể Cọc Trước/Sau Doanh Thu Phân Nhánh", "Bể Cọc");
addCard(s25, 0.8, 1.4, 4.2, 3.6, "Điều kiện áp dụng", [
    "- Khách hàng hủy đặt cọc nhưng đã đóng đợt 1 thành công.",
    "- Đã có ít nhất 1 đợt thanh toán được duyệt approved trong CSDL.",
    "- Công ty đã thực thu được một phần phí môi giới hoặc doanh thu."
]);
addCard(s25, 5.3, 1.4, 4.2, 3.6, "Hành vi hệ thống", [
    "- Giữ nguyên trạng thái Đặt Cọc / Khách Hàng của Person.",
    "- Không hạ trạng thái, không kích hoạt trả về kho chung.",
    "- Chuyển trạng thái phiếu cọc sang cancelled và ghi nhận lý do cụ thể."
]);

// Slide 26: Unit Switching (Đổi căn)
let s26 = createBaseSlide("Quy Trình Đổi Căn Hộ Giao Dịch", "Đổi Căn");
addCard(s26, 0.8, 1.4, 4.2, 3.6, "Đóng giao dịch cũ", [
    "- Đóng/hủy phiếu đặt cọc cũ của căn hộ A.",
    "- Đánh dấu trạng thái phiếu cọc cũ là thất bại hoặc đổi căn.",
    "- Lưu giữ nguyên lịch sử dòng tiền và hóa đơn của căn hộ cũ."
]);
addCard(s26, 5.3, 1.4, 4.2, 3.6, "Tạo giao dịch mới", [
    "- Tạo một phiếu đặt cọc mới hoàn toàn cho căn hộ B.",
    "- Gắn ghi chú liên kết dạng 'Đổi căn từ căn A' ở phiếu cọc mới.",
    "- Giữ trọn vẹn lịch sử phí và vết kiểm toán tài chính (audit trail)."
]);

// Slide 27: Financial Audit Trail
let s27 = createBaseSlide("Vết Kiểm Toán Tài Chỉ tiêu Doanh Thu", "Audit Trail");
addCard(s27, 0.8, 1.4, 4.2, 3.6, "Ghi nhật ký thay đổi", [
    "- Mọi thao tác thay đổi giá bán, chiết khấu, hoa hồng đều được ghi log.",
    "- Ghi nhận danh tính người chỉnh sửa và mốc thời gian chi tiết.",
    "- Chặn sửa đổi trực tiếp các hóa đơn đã được kế toán duyệt khóa sổ."
]);
addCard(s27, 5.3, 1.4, 4.2, 3.6, "Hóa đơn & Doanh thu", [
    "- Auto-create hóa đơn tương ứng với số tiền đợt thanh toán được duyệt.",
    "- Đối chiếu chéo giữa số liệu báo cáo của Sale và dữ liệu thực tế của kế toán.",
    "- Xuất báo cáo công nợ đợt đóng tiền tự động gửi về cho khách hàng."
]);

// Slide 28: Meta Conversion API (CAPI)
let s28 = createBaseSlide("Tích Hợp Tín Hiệu Meta Conversion API", "Meta CAPI");
addCard(s28, 0.8, 1.4, 4.2, 3.6, "Bắn tín hiệu chuyển đổi trực tiếp", [
    "- Loại bỏ hoàn toàn Google Sheets trung gian để tránh gãy luồng tín hiệu.",
    "- Gửi sự kiện chuyển đổi trực tiếp từ máy chủ CRM về Meta Pixel.",
    "- Tối ưu hóa chất lượng khớp dữ liệu (Match Quality) bằng hash SHA256."
]);
addCard(s28, 5.3, 1.4, 4.2, 3.6, "Phân loại sự kiện", [
    "- Trạng thái lead mới -> CompleteRegistration.",
    "- Trạng thái Quan Tâm -> Converted.",
    "- Trạng thái Đặt Cọc -> Purchase (gửi kèm giá trị hoa hồng thực nhận)."
]);

// Slide 29: CAPI Forward-only Signal
let s29 = createBaseSlide("Quy Tắc Tín Hiệu CAPI Một Chiều (Forward-Only)", "Meta CAPI");
addCard(s29, 0.8, 1.4, 4.2, 3.6, "Quy tắc một chiều", [
    "- Tuyệt đối không gửi sự kiện hoàn trả, hạ cấp trạng thái lead về Meta.",
    "- Một khi tín hiệu Purchase đã được gửi đi là kết thúc luồng cho lead đó.",
    "- Bảo vệ dữ liệu tối ưu hóa chiến dịch quảng cáo không bị nhiễu loạn."
]);
addCard(s29, 5.3, 1.4, 4.2, 3.6, "Lợi ích thuật toán học", [
    "- Giúp thuật toán tìm kiếm khách hàng của Meta tập trung vào tệp chuyển đổi thật.",
    "- Né tránh nhầm lẫn do các thay đổi trạng thái hậu trường của CRM.",
    "- Giảm chi phí quảng cáo (CPA) đáng kể cho các chiến dịch sau."
]);

// Slide 30: Tóm tắt phần 3
let s30 = createBaseSlide("Tóm Tắt Quy Tắc Giao Dịch & CAPI", "Tổng quan");
addCard(s30, 0.8, 1.4, 8.8, 3.6, "Tổng kết nghiệp vụ tài chính", [
    "- Bể cọc trước doanh thu hạ trạng thái và thả lại kho dữ liệu; bể cọc sau doanh thu giữ nguyên trạng thái.",
    "- Đổi căn đóng deal cũ tạo deal mới kèm liên kết ghi chú rõ ràng phục vụ audit.",
    "- Tín hiệu Meta CAPI gửi trực tiếp từ CRM theo quy tắc một chiều tiến lên để bảo vệ thuật toán ads."
]);

// ============================================================================
// PHẦN 4: AI TRAINING & RAG SYSTEM (SLIDE 31 - 38)
// ============================================================================

// Slide 31: Introduction to AI RAG
let s31 = createBaseSlide("Hệ Thống Trí Tuệ Nhân Tạo AI RAG", "AI RAG");
addCard(s31, 0.8, 1.4, 4.2, 3.6, "Giới thiệu RAG", [
    "- Retrieval-Augmented Generation: Tạo sinh có truy xuất tri thức.",
    "- Giúp mô hình AI trả lời và sàng lọc lead dựa trên tài liệu thực tế của dự án.",
    "- Khắc phục hoàn toàn hiện tượng ảo giác (hallucination) của AI."
]);
addCard(s31, 5.3, 1.4, 4.2, 3.6, "Ứng dụng trong CRM", [
    "- Tự động chấm điểm độ thiện chí của khách hàng qua ghi chú tương tác.",
    "- Nhận diện câu hỏi thường gặp và gợi ý kịch bản tư vấn phù hợp cho Sale.",
    "- Phân loại tự động lead rác/spam đổ về hệ thống."
]);

// Slide 32: Vector Embeddings
let s32 = createBaseSlide("Quy Trình Vector Hóa Tri Thức Dự Án", "AI RAG");
addCard(s32, 0.8, 1.4, 4.2, 3.6, "Embeddings API", [
    "- Sử dụng mô hình gemini-embedding-001 để biến đổi văn bản thành vector.",
    "- Mỗi vector là một chuỗi 768 chiều biểu thị đặc trưng ngữ nghĩa.",
    "- Lưu trữ vector vào cơ sở dữ liệu để tìm kiếm tương đồng ngữ nghĩa sau này."
]);
addCard(s32, 5.3, 1.4, 4.2, 3.6, "Bộ đệm ai_vector_cache", [
    "- Tính mã băm MD5 của văn bản làm khóa tra cứu cục bộ.",
    "- Lưu trữ vector tương ứng vào bảng ai_vector_cache.",
    "- Giảm 90% chi phí gọi API ngoài và tăng tốc độ truy xuất ngữ nghĩa lên <5ms."
]);

// Slide 33: RAG Architecture
let s33 = createBaseSlide("Kiến Trúc Truy Xuất Ngữ Cảnh Ngữ Nghĩa", "AI RAG");
addCard(s33, 0.8, 1.4, 4.2, 3.6, "Truy vấn tương đồng Cosine", [
    "- Chuyển đổi câu hỏi/ghi chú mới của khách hàng thành vector truy vấn.",
    "- So khớp Cosine Similarity với danh sách vector tri thức dự án có sẵn.",
    "- Lọc ra top các đoạn tri thức có điểm tương đồng cao nhất."
]);
addCard(s33, 5.3, 1.4, 4.2, 3.6, "Lắp ráp Prompt", [
    "- Lấy các đoạn tri thức liên quan nhất làm ngữ cảnh (context).",
    "- Kết hợp câu hỏi gốc của khách hàng để tạo Prompt gửi lên LLM.",
    "- AI phản hồi chính xác dựa trên dữ liệu thật của dự án."
]);

// Slide 34: Semantic Search vs Keyword Matching
let s34 = createBaseSlide("So Sánh Tìm Kiếm Ngữ Nghĩa & Từ Khóa", "AI RAG");
addCard(s34, 0.8, 1.4, 4.2, 3.6, "Giới hạn tìm kiếm từ khóa", [
    "- Chỉ tìm thấy nếu viết chính xác từ khóa (ví dụ: 'căn hộ').",
    "- Bỏ lỡ các từ đồng nghĩa (ví dụ: 'chung cư', 'nhà chung', 'condo').",
    "- Dễ bị sai lệch khi khách hàng gõ sai lỗi chính tả nhẹ."
]);
addCard(s34, 5.3, 1.4, 4.2, 3.6, "Ưu thế tìm kiếm ngữ nghĩa", [
    "- Hiểu được ý nghĩa thực sự đằng sau câu hỏi của khách hàng.",
    "- Trả về kết quả phù hợp kể cả khi không trùng bất kỳ từ khóa nào.",
    "- Nhận diện tốt các câu hỏi ẩn ý về giá bán hoặc pháp lý."
]);

// Slide 35: AI Training Interface
let s35 = createBaseSlide("Giao Diện Quản Lý Huấn Luyện AI", "AI RAG");
addCard(s35, 0.8, 1.4, 4.2, 3.6, "AITrainingPanel", [
    "- Cho phép upload tài liệu tri thức định dạng PDF hoặc nhập liên kết Web.",
    "- Bảng hiển thị danh sách tài liệu kèm trạng thái xử lý vector hóa.",
    "- Quản trị viên dễ dàng thêm mới, cập nhật hoặc xóa bỏ tri thức cũ."
]);
addCard(s35, 5.3, 1.4, 4.2, 3.6, "Kiểm thử trực tiếp (Sandbox)", [
    "- Cung cấp khung nhập câu hỏi thử nghiệm ngay trên màn hình Admin.",
    "- Hiển thị danh sách các đoạn ngữ cảnh đối khớp kèm điểm tương đồng.",
    "- Đánh giá chất lượng tri thức trước khi đưa vào vận hành thực tế."
]);

// Slide 36: Screening Logic & Decisions
let s36 = createBaseSlide("Logic Sàng Lọc Lead Tự Động Bằng AI", "AI RAG");
addCard(s36, 0.8, 1.4, 4.2, 3.6, "Đánh giá chất lượng lead", [
    "- Phân tích nội dung ghi chú lead từ nguồn đổ về.",
    "- Đối chiếu tri thức dự án để phát hiện các dấu hiệu không phù hợp.",
    "- Gắn thẻ tự động: Lead hợp lệ (Valid), Lead ảo/Spam, Lead sai số."
]);
addCard(s36, 5.3, 1.4, 4.2, 3.6, "Độ tự tin (Confidence Score)", [
    "- Trả về điểm phần trăm độ tự tin của quyết định phân loại.",
    "- Nếu điểm tự tin cao: Tự động cập nhật trạng thái và thực hiện phân bổ.",
    "- Tiết kiệm 80% thời gian lọc tay cho bộ phận kiểm soát chất lượng."
]);

// Slide 37: AI Error Fallbacks
let s37 = createBaseSlide("Cơ Chế Dự Phòng Lỗi Khi Gọi AI", "AI RAG");
addCard(s37, 0.8, 1.4, 4.2, 3.6, "Kịch bản lỗi thường gặp", [
    "- API hết hạn mức (rate limit), máy chủ Gemini phản hồi chậm hoặc timeout.",
    "- Định dạng phản hồi JSON từ AI bị lỗi cấu trúc.",
    "- Không kết nối được mạng internet từ server."
]);
addCard(s37, 5.3, 1.4, 4.2, 3.6, "Xử lý dự phòng", [
    "- Tự động thực hiện gửi lại yêu cầu tối đa 3 lần.",
    "- Nếu vẫn lỗi: Tự động chuyển trạng thái lead về chờ admin duyệt thủ công.",
    "- Đảm bảo hệ thống không bị ngắt quãng hoạt động khi API ngoài gặp sự cố."
]);

// Slide 38: Tóm tắt phần 4
let s38 = createBaseSlide("Tóm Tắt Hệ Thống AI RAG", "Tổng quan");
addCard(s38, 0.8, 1.4, 8.8, 3.6, "Tóm tắt cơ chế tri thức AI", [
    "- Tích hợp Gemini API trích xuất PDF/Web, thực hiện chunking dấu câu chuẩn xác.",
    "- Bộ đệm ai_vector_cache tối ưu chi phí và tăng tốc đối khớp ngữ nghĩa bằng Cosine trong PHP.",
    "- AI tự động sàng lọc phân loại lead, hỗ trợ cơ chế dự phòng lỗi chuyển duyệt thủ công khi API lỗi."
]);

// ============================================================================
// PHẦN 5: ĐỒNG BỘ GOOGLE SHEETS & WEBHOOKS (SLIDE 39 - 46)
// ============================================================================

// Slide 39: Google Sheets Integration
let s39 = createBaseSlide("Đồng Bộ Dữ Liệu Google Sheets", "Liên kết");
addCard(s39, 0.8, 1.4, 4.2, 3.6, "Cấu hình kết nối", [
    "- Quản lý danh sách bảng tính qua bảng sheet_connections.",
    "- Lưu trữ Spreadsheet ID, tên Sheet và tần suất đồng bộ mong muốn.",
    "- Cho phép bật/tắt kết nối nhanh chóng thông qua thuộc tính is_active."
]);
addCard(s39, 5.3, 1.4, 4.2, 3.6, "Luồng chạy nền định kỳ", [
    "- Cron job quét danh sách kết nối đang hoạt động.",
    "- Đọc dữ liệu thô từ API Google Sheets và phân tích cấu trúc cột.",
    "- Cập nhật tự động các thay đổi về trạng thái lead hoặc ghi chú vào CRM."
]);

// Slide 40: Real-Time Webhook Receivers
let s40 = createBaseSlide("Cổng Tiếp Nhận Webhook Tức Thời", "Liên kết");
addCard(s40, 0.8, 1.4, 4.2, 3.6, "Tiếp nhận tức thời", [
    "- Cung cấp URL webhook bảo mật cho các đối tác quảng cáo.",
    "- Bắt dữ liệu dạng POST JSON ngay khi khách hàng điền form.",
    "- Trả về phản hồi HTTP 200 tức thì để bên gửi không bị treo."
]);
addCard(s40, 5.3, 1.4, 4.2, 3.6, "Ghi nhận & Xử lý thô", [
    "- Ghi dữ liệu thô vào bảng leads kèm mốc thời gian nhận.",
    "- Kích hoạt tiến trình phân chia lead ngầm không gây nghẽn luồng nhận lead.",
    "- Đảm bảo tỷ lệ thất thoát lead đầu vào tiệm cận mức 0%."
]);

// Slide 41: Two-Way Sync Conflict Resolution
let s41 = createBaseSlide("Xử Lý Xung Đột Đồng Bộ Hai Chiều", "Liên kết");
addCard(s41, 0.8, 1.4, 4.2, 3.6, "Tránh ghi đè trùng lặp", [
    "- Tính mã băm SHA256 cho dữ liệu mỗi hàng bảng tính.",
    "- Lưu trữ mã băm vào bảng sheet_sync_records sau mỗi lần đồng bộ.",
    "- So sánh hash mới với hash cũ để phát hiện dòng thực sự có chỉnh sửa."
]);
addCard(s41, 5.3, 1.4, 4.2, 3.6, "Chống vòng lặp vô hạn", [
    "- Khi CRM cập nhật Sheets, hệ thống lưu lại hash mới nhất của hàng đó.",
    "- Lượt quét tiếp theo của Cron sẽ bỏ qua dòng đó vì hash trùng khớp.",
    "- Giải quyết triệt để vấn đề vòng lặp cập nhật vô hạn giữa CRM và Sheets."
]);

// Slide 42: Chat App Command Centers
let s42 = createBaseSlide("Trung Tâm Lệnh Chatbot Webhooks", "Điều khiển");
addCard(s42, 0.8, 1.4, 4.2, 3.6, "Tương tác qua ứng dụng Chat", [
    "- Tích hợp Bot API của Telegram và Zalo OA vào hệ thống.",
    "- Thiết lập Webhook lắng nghe tin nhắn từ nhóm chat quản trị.",
    "- Mang lại trải nghiệm quản lý di động cực kỳ nhanh chóng."
]);
addCard(s42, 5.3, 1.4, 4.2, 3.6, "Bảo mật cổng nhận lệnh", [
    "- Đường dẫn Webhook chứa token bảo mật ngẫu nhiên chặn quét cổng.",
    "- Chỉ xử lý tin nhắn xuất phát từ các Chat ID đã được xác minh.",
    "- Ghi log đầy đủ mọi yêu cầu lệnh gửi về để kiểm tra sau này."
]);

// Slide 43: Admin Chat Command Console
let s43 = createBaseSlide("Tập Lệnh Điều Khiển Hệ Thống Qua Chat", "Điều khiển");
addCard(s43, 0.8, 1.4, 4.2, 3.6, "Tra cứu & Xem báo cáo", [
    "- Lệnh `/report`: Trả về thống kê lead mới, cọc, doanh thu trong ngày.",
    "- Lệnh `/sales`: Danh sách Sale đang hoạt động, vắng mặt hoặc nghỉ phép.",
    "- Lệnh `/check [sđt]`: Kiểm tra nhanh lịch sử trùng lặp của khách hàng."
]);
addCard(s43, 5.3, 1.4, 4.2, 3.6, "Phê duyệt tức thời", [
    "- Lệnh `/duyet [id]`: Duyệt nhanh check-in hoặc duyệt đợt thanh toán cọc.",
    "- Lệnh `/tuchoi [id] [lý_do]`: Từ chối duyệt kèm ghi chú lý do.",
    "- Phê duyệt giao dịch ngay khi đang trò chuyện với đối tác ngoài thực địa."
]);

// Slide 44: Zalo Bot Webhook Processing
let s44 = createBaseSlide("Xử Lý Webhook Phía Zalo Bot", "Điều khiển");
addCard(s44, 0.8, 1.4, 4.2, 3.6, "zalo_webhook.php", [
    "- Phân tích cấu trúc sự kiện gửi từ Zalo OA API.",
    "- Trích xuất thông tin người gửi, nội dung văn bản lệnh.",
    "- Xác minh chữ ký số của Zalo để đảm bảo tin nhắn an toàn."
]);
addCard(s44, 5.3, 1.4, 4.2, 3.6, "Luồng phản hồi Zalo", [
    "- Ánh xạ Zalo User ID với tài khoản hệ thống để kiểm tra vai trò.",
    "- Thực thi truy vấn CSDL tương ứng và định dạng kết quả dạng tin nhắn chat.",
    "- Gọi API gửi tin nhắn Zalo OA trả kết quả về cho quản trị viên."
]);

// Slide 45: Telegram Bot Webhook Processing
let s45 = createBaseSlide("Xử Lý Webhook Phía Telegram Bot", "Điều khiển");
addCard(s45, 0.8, 1.4, 4.2, 3.6, "telegram_webhook.php", [
    "- Đăng ký URL webhook bảo mật với máy chủ Telegram API.",
    "- Bắt dữ liệu tin nhắn nhóm hoặc tin nhắn trực tiếp với Bot.",
    "- Phân tích cú pháp lệnh gạch chéo (slash commands)."
]);
addCard(s45, 5.3, 1.4, 4.2, 3.6, "Luồng phản hồi Telegram", [
    "- Định dạng kết quả dạng Markdown chất lượng cao để hiển thị đẹp mắt.",
    "- Gửi phản hồi kèm các nút bấm tương tác nhanh (Inline Keyboards).",
    "- Hỗ trợ gửi ảnh báo cáo đồ thị trực quan cho Quản lý."
]);

// Slide 46: Tóm tắt phần 5
let s46 = createBaseSlide("Tóm Tắt Đồng Bộ & Điều Khiển Chat", "Tổng quan");
addCard(s46, 0.8, 1.4, 8.8, 3.6, "Tổng kết liên kết ngoài", [
    "- Google Sheets đồng bộ hai chiều sử dụng thuật toán đối soát Row Hash SHA256 chống lặp vô hạn.",
    "- Bộ tiếp nhận Webhook tối ưu hóa hàng đợi giúp bắt lead tức thời từ quảng cáo.",
    "- Trung tâm điều khiển qua Telegram/Zalo Bot mang lại khả năng phê duyệt nhanh và xem báo cáo linh hoạt từ xa."
]);

// ============================================================================
// PHẦN 6: HÀNG ĐỢI BẤT ĐỒNG BỘ & DEVOPS (SLIDE 47 - 60)
// ============================================================================

// Slide 47: Bottleneck Analysis
let s47 = createBaseSlide("Phân Tích Điểm Nghẽn Mạng Đồng Bộ", "Hàng Đợi");
addCard(s47, 0.8, 1.4, 4.2, 3.6, "Vấn đề nghẽn luồng (Blocking)", [
    "- Khi có lead mới, hệ thống phải gọi nhiều API bên thứ ba (Telegram, Zalo OA).",
    "- Các cuộc gọi HTTP đồng bộ bắt tiến trình PHP phải đợi kết nối mạng phản hồi.",
    "- Gây tăng thời gian phản hồi API lên >5 giây, dễ dẫn đến timeout và mất lead."
]);
addCard(s47, 5.3, 1.4, 4.2, 3.6, "Giải pháp chuyển sang Hàng đợi", [
    "- Loại bỏ hoàn toàn các cuộc gọi API đồng bộ trong luồng chính nhận lead.",
    "- Chuyển toàn bộ tác vụ thông báo sang mô hình bất đồng bộ (Asynchronous).",
    "- Trả về kết quả tiếp nhận lead ngay lập tức cho đối tác trong <20ms."
]);

// Slide 48: Asynchronous Messaging
let s48 = createBaseSlide("Kiến Trúc Hàng Đợi Tin Nhắn Bất Đồng Bộ", "Hàng Đợi");
addCard(s48, 0.8, 1.4, 4.2, 3.6, "Cơ chế đẩy hàng đợi (Enqueue)", [
    "- Các hàm sendZaloMessage và sendTelegramMessage nhận tham số sync = false.",
    "- Thay vì gọi cURL đi, hệ thống lưu payload tin nhắn vào bảng hàng đợi CSDL.",
    "- Đảm bảo tiến trình chính kết thúc cực nhanh, không phụ thuộc mạng ngoài."
]);
addCard(s48, 5.3, 1.4, 4.2, 3.6, "Xử lý hàng đợi ngầm (Worker)", [
    "- Tiến trình Cron job worker chạy ngầm độc lập quét bảng hàng đợi.",
    "- Lấy các tin nhắn chưa gửi để thực hiện kết nối gửi đi tuần tự.",
    "- Cập nhật trạng thái gửi thành công hoặc ghi lỗi nếu thất bại."
]);

// Slide 49: Queue Table Schemas
let s49 = createBaseSlide("Lược Đồ Bảng Hàng Đợi & Tối Ưu Chỉ Mục", "Hàng Đợi");
addCard(s49, 0.8, 1.4, 4.2, 3.6, "Cấu trúc bảng hàng đợi", [
    "- Bảng zalo_queue và telegram_queue lưu trữ: payload, status, retries.",
    "- Cột status gồm các trạng thái: pending, processing, sent, failed.",
    "- Ghi nhận lỗi chi tiết trong cột error_message khi gửi thất bại."
]);
addCard(s49, 5.3, 1.4, 4.2, 3.6, "Tối ưu chỉ mục (Database Indexing)", [
    "- Tạo chỉ mục idx_telegram_queue_status_created trên (status, created_at).",
    "- Giúp câu lệnh SELECT của Worker tìm kiếm tin nhắn chờ gửi chỉ trong <1ms.",
    "- Tránh tình trạng khóa bảng hoặc quét toàn bộ bảng khi hàng đợi lớn."
]);

// Slide 50: Asynchronous Zalo Delivery
let s50 = createBaseSlide("Luồng Gửi Tin Nhắn Zalo Bất Đồng Bộ", "Hàng Đợi");
addCard(s50, 0.8, 1.4, 4.2, 3.6, "Hàm sendZaloMessageWrapper", [
    "- Tiếp nhận thông tin người nhận, nội dung mẫu tin nhắn Zalo OA.",
    "- Kiểm tra tham số sync. Nếu false -> Chuyển hướng lưu vào CSDL.",
    "- Trả về kết quả thành công ảo cho luồng chính để tiếp tục chạy."
]);
addCard(s50, 5.3, 1.4, 4.2, 3.6, "Tiến trình gửi thực tế", [
    "- Worker lấy bản ghi từ zalo_queue để thực hiện cuộc gọi Zalo API.",
    "- Xử lý các mã phản hồi lỗi từ Zalo (hết hạn Token, sai ID người dùng).",
    "- Thực hiện tự động làm mới Access Token của Zalo OA khi hết hạn."
]);

// Slide 51: Asynchronous Telegram Delivery
let s51 = createBaseSlide("Luồng Gửi Tin Nhắn Telegram Bất Đồng Bộ", "Hàng Đợi");
addCard(s51, 0.8, 1.4, 4.2, 3.6, "Hàm sendTelegramMessageWrapper", [
    "- Tiếp nhận chat_id nhóm nhận và nội dung tin nhắn Markdown.",
    "- Ghi nhận vào bảng telegram_queue chỉ trong 1 truy vấn INSERT nhanh.",
    "- Giải phóng tiến trình PHP ngay lập tức."
]);
addCard(s51, 5.3, 1.4, 4.2, 3.6, "Gửi và cập nhật log", [
    "- Worker gọi API Telegram SendMessage ngầm.",
    "- Cập nhật trạng thái sent trong hàng đợi sau khi Telegram phản hồi HTTP 200.",
    "- Đảm bảo thông tin nhóm chat quản trị luôn được cập nhật đầy đủ."
]);

// Slide 52: Background Queue Worker
let s52 = createBaseSlide("Tiến Trình Chạy Ngầm Xử Lý Hàng Đợi", "Hàng Đợi");
addCard(s52, 0.8, 1.4, 4.2, 3.6, "cron_queue_worker.php", [
    "- Được thiết lập chạy liên tục mỗi phút bằng Cron Job hệ thống.",
    "- Giới hạn số lượng tin nhắn xử lý mỗi đợt để tránh làm quá tải CPU.",
    "- Cơ chế tự động thử lại (Retry) tối đa 3 lần đối với tin nhắn lỗi mạng."
]);
addCard(s52, 5.3, 1.4, 4.2, 3.6, "Dọn dẹp nhật ký cũ (Auto-purge)", [
    "- Dữ liệu nhật ký tin nhắn gửi thành công phình to theo thời gian.",
    "- Worker tự động thực hiện lệnh dọn dẹp định kỳ.",
    "- Xóa sạch các bản ghi trạng thái sent/failed cũ hơn 30 ngày để tối ưu bộ nhớ."
]);

// Slide 53: Real-time Lead Countdown
let s53 = createBaseSlide("Đồng Hồ Bảo Mật & Phản Hồi Real-Time", "Hàng Đợi");
addCard(s53, 0.8, 1.4, 4.2, 3.6, "Đồng hồ đếm ngược 2 phút", [
    "- Hệ thống yêu cầu Sale phải tiếp nhận lead trong vòng 2 phút đầu tiên.",
    "- Nếu quá hạn: Hệ thống tự động thu hồi (Recall) và phân phối lại.",
    "- Đồng hồ đếm ngược cần độ chính xác tuyệt đối."
]);
addCard(s53, 5.3, 1.4, 4.2, 3.6, "Đồng bộ mốc kích hoạt", [
    "- Mốc bắt đầu tính giờ được kích hoạt chính xác ngay khi tin nhắn báo lead gửi thành công.",
    "- Loại bỏ hoàn toàn sai lệch thời gian do độ trễ mạng khi gọi API ngoài.",
    "- Đảm bảo Sale luôn có đủ trọn vẹn 120 giây để bấm nhận lead."
]);

// Slide 54: The Testing Harness
let s54 = createBaseSlide("Khung Kiểm Thử Tích Hợp Hệ Thống", "DevOps");
addCard(s54, 0.8, 1.4, 4.2, 3.6, "test_bootstrap.php", [
    "- Tập tin nền tảng khởi tạo môi trường kiểm thử an toàn.",
    "- Chỉ cần nhúng dòng require_once test_bootstrap.php ở đầu mỗi tệp test.",
    "- Tự động nạp cấu hình hệ thống, kết nối cơ sở dữ liệu."
]);
addCard(s54, 5.3, 1.4, 4.2, 3.6, "Nạp sẵn thư viện nghiệp vụ", [
    "- Nạp toàn bộ các tệp helper lõi: webhook_logic.php, mailer.php.",
    "- Tích hợp sẵn bộ điều khiển Zalo Bot và Telegram Bot.",
    "- Cung cấp môi trường kiểm thử đầy đủ không cần thiết lập lại từ đầu."
]);

// Slide 55: Unified Testing Environment
let s55 = createBaseSlide("Môi Trường Kiểm Thử Nhất Quán", "DevOps");
addCard(s55, 0.8, 1.4, 4.2, 3.6, "Kết nối CSDL chuẩn hóa", [
    "- Cung cấp sẵn các biến kết nối toàn cục: $conn (MySQLi) và $pdo (PDO).",
    "- Đảm bảo các hàm gọi CSDL dùng chung kết nối hiện tại để tránh cạn kiệt pool.",
    "- Hỗ trợ cơ chế kiểm soát giao dịch để có thể rollback dữ liệu sau khi test."
]);
addCard(s55, 5.3, 1.4, 4.2, 3.6, "Dữ liệu Mock an toàn", [
    "- Cung cấp bộ hàm tạo dữ liệu thử nghiệm (Sale giả lập, Lead giả lập).",
    "- Chặn gửi email/tin nhắn thật đến khách hàng trong quá trình chạy test.",
    "- Giúp kiểm thử an toàn ngay trên cơ sở dữ liệu Staging mà không sợ ô nhiễm."
]);

// Slide 56: Diagnostic Utilities
let s56 = createBaseSlide("Bộ Công Cụ Chẩn Đoán & Khẳng Định", "DevOps");
addCard(s56, 0.8, 1.4, 4.2, 3.6, "Hàm assertTest chẩn đoán", [
    "- In ra kết quả kiểm thử trực quan dạng PASS/FAIL trên trình duyệt.",
    "- Hiển thị chi tiết giá trị thực tế so với giá trị kỳ vọng khi thất bại.",
    "- Thống kê tổng hợp số lượng ca kiểm thử thành công ở cuối trang."
]);
addCard(s56, 5.3, 1.4, 4.2, 3.6, "Hàm assertDbField kiểm đối chéo", [
    "- Thực hiện truy vấn nhanh kiểm tra giá trị của một trường cụ thể trong bảng.",
    "- Khẳng định dữ liệu đã được cập nhật chính xác vào CSDL sau khi thực thi logic.",
    "- Loại bỏ việc viết thủ công các câu lệnh SELECT kiểm tra dữ liệu."
]);

// Slide 57: Staging Database Verification
let s57 = createBaseSlide("Quy Tắc Đối Soát Cấu Trúc CSDL Từ Xa", "DevOps");
addCard(s57, 0.8, 1.4, 4.2, 3.6, "Bắt buộc đối soát từ xa (Rule 8)", [
    "- Trước khi chạy bất kỳ đoạn mã nâng cấp CSDL nào trên môi trường Staging.",
    "- Agent bắt buộc phải thực hiện truy vấn đối soát qua exec_db_query.php.",
    "- Đảm bảo kiểu dữ liệu, khóa ngoại hoàn toàn khớp với thiết kế."
]);
addCard(s57, 5.3, 1.4, 4.2, 3.6, "Ngăn ngừa lỗi lệch Schema", [
    "- Loại bỏ hoàn toàn lỗi 500 phát sinh do thiếu cột hoặc sai kiểu dữ liệu.",
    "- Đồng bộ tệp schema master unified_schema.sql ngay khi có chỉnh sửa.",
    "- Đảm bảo môi trường phát triển cục bộ và Staging luôn nhất quán tuyệt đối."
]);

// Slide 58: Static Query Scan
let s58 = createBaseSlide("Quét Lỗi Cú Pháp Truy Vấn Tĩnh", "DevOps");
addCard(s58, 0.8, 1.4, 4.2, 3.6, "Công cụ quét SQL Scan", [
    "- Tự động quét toàn bộ mã nguồn PHP để tìm kiếm các từ khóa SQL không hợp lệ.",
    "- Phát hiện các câu lệnh không tương thích với cấu hình chế độ MariaDB Staging.",
    "- Tìm ra các truy vấn SQL viết sai cú pháp trước khi chạy thực tế."
]);
addCard(s58, 5.3, 1.4, 4.2, 3.6, "Phòng ngừa sự cố", [
    "- Báo cáo chi tiết đường dẫn tệp và số dòng có nguy cơ gây lỗi truy vấn.",
    "- Đảm bảo tính ổn định cao của tầng dữ liệu.",
    "- Rút ngắn thời gian gỡ lỗi thủ công của lập trình viên."
]);

// Slide 59: Git Integration & Deployment
let s59 = createBaseSlide("Quy Trình Triển Khai Deploy Song Song", "DevOps");
addCard(s59, 0.8, 1.4, 4.2, 3.6, "Tự động hóa đồng bộ (Rule 5)", [
    "- Khi có lệnh yêu cầu deploy từ cấp quản lý.",
    "- Hệ thống tự động thực hiện lệnh deploy backend lên máy chủ.",
    "- Chạy lệnh di chuyển phiên bản cơ sở dữ liệu ngầm tự động."
]);
addCard(s59, 5.3, 1.4, 4.2, 3.6, "Commit & Push song song", [
    "- Tiến trình thực hiện git add, commit và push code lên nhánh chính main.",
    "- Đảm bảo mã nguồn trên server Staging và kho lưu trữ Git luôn khớp nhau.",
    "- Tuyệt đối cấm tự động chạy deploy khi chưa có lệnh bằng chữ cụ thể (Rule 7)."
]);

// Slide 60: Conclusion & Roadmap
let s60 = createBaseSlide("Kết Luận & Định Hướng Nâng Cấp", "Kết Luận");
addCard(s60, 0.8, 1.4, 4.2, 3.6, "Thành quả đạt được", [
    "- Xây dựng hoàn chỉnh luồng phân chia lead tự động an toàn qua 5 lớp kiểm duyệt.",
    "- Thiết lập hàng đợi tin nhắn giải quyết triệt để vấn đề nghẽn luồng kết nối ngoài.",
    "- Khung kiểm thử tự động toàn diện giúp bảo vệ tính ổn định của hệ thống."
]);
addCard(s60, 5.3, 1.4, 4.2, 3.6, "Kế hoạch tương lai", [
    "- Tích hợp sâu AI RAG hỗ trợ chấm điểm và phân loại lead nâng cao ở diện rộng.",
    "- Tích hợp báo cáo phân tích sâu ROAS ads đến từng ad creative.",
    "- Mở rộng kết nối API cho nhiều hệ thống tổng đài cuộc gọi của đối tác."
]);

// Thêm chân trang slide cho tất cả các slide (chỉ số trang và bản quyền)
let totalSlides = pptx.slides.length;
pptx.slides.forEach((slide, index) => {
    // Bỏ qua slide tiêu đề đầu tiên
    if (index === 0) return;
    
    // Đánh số trang góc dưới bên phải
    slide.addText(`Slide ${index + 1} / ${totalSlides}`, {
        x: 8.5,
        y: 5.15,
        w: 1.0,
        h: 0.3,
        fontSize: 8.5,
        fontFace: "Segoe UI",
        color: COLORS.textMuted,
        align: "right",
        bold: true
    });
    
    // Dòng bản quyền góc dưới bên trái
    slide.addText("TÀI LIỆU KIẾN TRÚC KỸ THUẬT RICH LAND CRM — BẢO MẬT NỘI BỘ", {
        x: 0.8,
        y: 5.15,
        w: 6.0,
        h: 0.3,
        fontSize: 8.5,
        fontFace: "Segoe UI",
        color: COLORS.textMuted,
        bold: true
    });
});

console.log("💾 Đang xuất tệp trình chiếu PowerPoint...");
pptx.writeFile({ fileName: "RichLand_System_Architecture_Presentation.pptx" })
    .then(fileName => {
        console.log(`\n=================================================`);
        console.log(`✅ THÀNH CÔNG: Đã tạo file ${fileName}`);
        console.log(`=================================================`);
    })
    .catch(err => {
        console.error("❌ LỖI KHI XUẤT FILE:", err);
    });
