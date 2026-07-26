import pptxgen from "pptxgenjs";

console.log("=================================================");
console.log("🚀 THIẾT KẾ LANDING PAGE HERO & DASHBOARD - 60 SLIDE");
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
    greenBg: "D1FAE5",    // Success Green Background for Badges
    white: "FFFFFF",      // High Contrast White
    darkBg: "0B0F19"      // Dark background for Hero/Landing slides
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

// ----------------------------------------------------------------------------
// LAYOUT PATTERN 1: White Card Container with App List Style
// ----------------------------------------------------------------------------
function addCard(slide, x, y, w, h, cardTitle, lines, isGreen = false) {
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

// ----------------------------------------------------------------------------
// LAYOUT PATTERN 2: Big KPI Metric Dashboard Cards
// ----------------------------------------------------------------------------
function addKpiCard(slide, x, y, w, h, kpiValue, kpiLabel, kpiDesc) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.border, width: 1 },
        rectRadius: 0.06
    });

    slide.addText(kpiValue, {
        x: x + 0.2,
        y: y + 0.15,
        w: w - 0.4,
        h: 0.5,
        fontSize: 26,
        fontFace: "Segoe UI",
        color: COLORS.crimson,
        bold: true,
        valign: "middle"
    });

    slide.addText(kpiLabel.toUpperCase(), {
        x: x + 0.2,
        y: y + 0.65,
        w: w - 0.4,
        h: 0.25,
        fontSize: 9,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        bold: true,
        valign: "top"
    });

    slide.addText(kpiDesc, {
        x: x + 0.2,
        y: y + 0.9,
        w: w - 0.4,
        h: h - 1.0,
        fontSize: 8,
        fontFace: "Segoe UI",
        color: COLORS.textGray,
        valign: "top",
        lineSpacing: 11
    });
}

// ----------------------------------------------------------------------------
// LAYOUT PATTERN 3: Visual Flowchart / Progress Step Blocks
// ----------------------------------------------------------------------------
function drawFlowStep(slide, x, y, w, h, stepNum, stepTitle, stepDesc, isLast = false) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.border, width: 1 },
        rectRadius: 0.05
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.15,
        y: y + 0.15,
        w: 0.35,
        h: 0.25,
        fill: { color: COLORS.crimsonBg },
        rectRadius: 0.5
    });
    slide.addText(stepNum, {
        x: x + 0.15,
        y: y + 0.15,
        w: 0.35,
        h: 0.25,
        fontSize: 9,
        fontFace: "Segoe UI",
        color: COLORS.crimson,
        bold: true,
        align: "center",
        valign: "middle"
    });

    slide.addText(stepTitle, {
        x: x + 0.6,
        y: y + 0.15,
        w: w - 0.75,
        h: 0.25,
        fontSize: 10,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        bold: true,
        valign: "middle"
    });

    slide.addText(stepDesc, {
        x: x + 0.15,
        y: y + 0.45,
        w: w - 0.3,
        h: h - 0.6,
        fontSize: 8.2,
        fontFace: "Segoe UI",
        color: COLORS.textGray,
        valign: "top",
        lineSpacing: 11
    });

    if (!isLast) {
        slide.addShape(pptx.shapes.RIGHT_ARROW, {
            x: x + w + 0.04,
            y: y + h / 2 - 0.1,
            w: 0.12,
            h: 0.2,
            fill: { color: COLORS.textMuted },
            line: { color: COLORS.border, width: 0.5 }
        });
    }
}

// ----------------------------------------------------------------------------
// LAYOUT PATTERN 4: Native PowerPoint Grid Tables
// ----------------------------------------------------------------------------
function addGridTable(slide, x, y, w, h, headers, rows) {
    let tableData = [];
    
    let headerRow = headers.map(title => ({
        text: title.toUpperCase(),
        options: {
            bold: true,
            color: COLORS.white,
            fill: COLORS.crimson,
            align: "center",
            fontFace: "Segoe UI",
            fontSize: 8.5
        }
    }));
    tableData.push(headerRow);

    rows.forEach(row => {
        let bodyRow = row.map(cell => ({
            text: cell,
            options: {
                color: COLORS.textDark,
                align: "left",
                fontFace: "Segoe UI",
                fontSize: 8.2,
                fill: COLORS.cardBg
            }
        }));
        tableData.push(bodyRow);
    });

    slide.addTable(tableData, {
        x: x,
        y: y,
        w: w,
        h: h,
        border: { type: "solid", color: COLORS.border, pt: 1 },
        valign: "middle"
    });
}

// ----------------------------------------------------------------------------
// LAYOUT PATTERN 5: Chat Dialogue / Chatbot Console Mockups
// ----------------------------------------------------------------------------
function drawChatBubble(slide, x, y, w, h, sender, message, isBot = false) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: isBot ? COLORS.greenBg : "F1F5F9" },
        line: { color: COLORS.border, width: 1 },
        rectRadius: 0.08
    });

    slide.addText(sender.toUpperCase(), {
        x: x + 0.15,
        y: y + 0.08,
        w: w - 0.3,
        h: 0.2,
        fontSize: 7.5,
        fontFace: "Segoe UI",
        color: isBot ? COLORS.green : COLORS.crimson,
        bold: true
    });

    slide.addText(message, {
        x: x + 0.15,
        y: y + 0.25,
        w: w - 0.3,
        h: h - 0.3,
        fontSize: 8.2,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        valign: "top",
        lineSpacing: 11
    });
}

// ----------------------------------------------------------------------------
// LAYOUT PATTERN 6: Full-bleed Hero Section Slide (Landing Page style)
// ----------------------------------------------------------------------------
function createHeroSlide(title, subtitle, partNum) {
    let slide = pptx.addSlide();
    slide.background = { color: COLORS.darkBg };

    // Thanh viền đỏ ngang ở đỉnh
    slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0,
        y: 0,
        w: 10,
        h: 0.12,
        fill: { color: COLORS.crimson }
    });

    // Phần nhãn chương (Ví dụ: PART 01)
    slide.addText(partNum.toUpperCase(), {
        x: 1.0,
        y: 1.0,
        w: 8.0,
        h: 0.3,
        fontSize: 13,
        fontFace: "Segoe UI",
        color: COLORS.crimson,
        bold: true,
        valign: "middle"
    });

    // Tiêu đề dạng Hero siêu lớn
    slide.addText(title, {
        x: 1.0,
        y: 1.4,
        w: 8.0,
        h: 1.0,
        fontSize: 30,
        fontFace: "Segoe UI",
        color: COLORS.white,
        bold: true,
        valign: "top"
    });

    // Mô tả giới thiệu chương
    slide.addText(subtitle, {
        x: 1.0,
        y: 2.6,
        w: 8.0,
        h: 0.6,
        fontSize: 11.5,
        fontFace: "Segoe UI",
        color: COLORS.gray,
        valign: "top",
        lineSpacing: 16
    });

    return slide;
}

// Helper vẽ các card tính năng dạng glassmorphic dưới slide Hero
function addHeroFeatures(slide, features) {
    let cardW = 2.4;
    let cardH = 1.7;
    let startX = 1.0;
    let gap = 0.4;

    features.forEach((feat, idx) => {
        let x = startX + idx * (cardW + gap);
        let y = 3.3;

        // Vẽ thẻ kính mờ (glassmorphism) màu tối
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: x,
            y: y,
            w: cardW,
            h: cardH,
            fill: { color: "1E293B" }, // Navy Darker Card
            line: { color: "334155", width: 1 },
            rectRadius: 0.08
        });

        // Tiêu đề tính năng
        slide.addText(feat.title.toUpperCase(), {
            x: x + 0.15,
            y: y + 0.15,
            w: cardW - 0.3,
            h: 0.3,
            fontSize: 9.5,
            fontFace: "Segoe UI",
            color: COLORS.crimson,
            bold: true
        });

        // Nội dung tính năng
        slide.addText(feat.desc, {
            x: x + 0.15,
            y: y + 0.45,
            w: cardW - 0.3,
            h: cardH - 0.6,
            fontSize: 8.5,
            fontFace: "Segoe UI",
            color: COLORS.gray,
            valign: "top",
            lineSpacing: 12
        });
    });
}


// ============================================================================
// KHỞI TẠO TỪNG SLIDE TRONG 60 TRANG - PHỐI HỢP CÂN ĐỐI 2 PHONG CÁCH
// ============================================================================

// Slide 1: Trang bìa (Widescreen Cover)
let s1 = pptx.addSlide();
s1.background = { color: COLORS.darkBg };
s1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.2, h: 5.625, fill: { color: COLORS.crimson } });
s1.addText("RICH LAND CRM SYSTEM ARCHITECTURE", {
    x: 0.8, y: 1.6, w: 8.5, h: 0.4, fontSize: 13, fontFace: "Segoe UI", color: COLORS.crimson, bold: true
});
s1.addText("KIẾN TRÚC HỆ THỐNG & LUỒNG HOẠT ĐỘNG LÕI", {
    x: 0.8, y: 2.1, w: 8.5, h: 1.2, fontSize: 32, fontFace: "Segoe UI", color: COLORS.white, bold: true
});
s1.addText("Báo cáo phân tích chuyên sâu về hạ tầng lead, 5 cổng duyệt, quy tắc giao dịch và hàng đợi bất đồng bộ.", {
    x: 0.8, y: 3.4, w: 8.0, h: 0.6, fontSize: 11, fontFace: "Segoe UI", color: COLORS.gray
});
s1.addText("PHIÊN BẢN HỆ THỐNG V1.9.0", {
    x: 0.8, y: 4.5, w: 8.0, h: 0.3, fontSize: 9, fontFace: "Segoe UI", color: COLORS.gray, bold: true
});

// Slide 2: Mục lục (Hero Landing Page style)
let s2 = createHeroSlide("MỤC LỤC & ĐỊNH HƯỚNG BÁO CÁO", "Sơ đồ chi tiết thiết kế 6 chương phân tích toàn bộ cấu trúc định tuyến API, thuật toán Protection Gates, quy trình thanh toán đặt cọc và DevOps.", "Mục lục");
addHeroFeatures(s2, [
    { title: "Cấu trúc 1 & 2", desc: "Hạ tầng định tuyến API, requireAuth, normal roles và cơ chế Protection Gates chia lead." },
    { title: "Cấu trúc 3 & 4", desc: "Quy tắc đặt cọc, đổi căn giao dịch, Meta CAPI và tri thức AI Vector RAG." },
    { title: "Cấu trúc 5 & 6", desc: "Đồng bộ Sheets 2 chiều, chatbot webhooks console và hàng đợi DevOps." }
]);

// Slide 3: Executive Summary (KPI Cards)
let s3 = createBaseSlide("Tóm Tắt Tổng Quan Chỉ Số Hệ Thống", "Tổng quan");
addKpiCard(s3, 0.8, 1.4, 2.7, 3.6, "< 50ms", "Thời gian chia lead", "Lead mới được phân bổ tức thời xuống máy của Sale qua 5 Gate bảo mật trong nháy mắt.");
addKpiCard(s3, 3.85, 1.4, 2.7, 3.6, "99.9 %", "Độ tin cậy hàng đợi", "Các yêu cầu gửi cURL bên thứ ba (Zalo OA, Telegram) được bất đồng bộ hóa 100% tránh nghẽn.");
addKpiCard(s3, 6.9, 1.4, 2.7, 3.6, "100 %", "Vết kiểm toán", "Toàn bộ dòng tiền đặt cọc, đợt thu milestones, thay đổi chủ lead đều được ký số ghi log bảo mật.");

// Slide 4: Client-Server Architecture (Flowchart)
let s4 = createBaseSlide("Luồng Kết Nối Kiến Trúc Client - Server", "Kiến trúc");
drawFlowStep(s4, 0.8, 1.8, 2.5, 2.5, "1", "Vite Frontend React", "Ứng dụng SPA gửi yêu cầu API thông qua Axios Client, tự động nạp JWT token bảo mật.");
drawFlowStep(s4, 3.65, 1.8, 2.5, 2.5, "2", "index.php API Router", "Cổng định tuyến hành động Backend duy nhất, xử lý CORS, bắt lỗi và phân loại action.");
drawFlowStep(s4, 6.5, 1.8, 2.5, 2.5, "3", "MariaDB CSDL", "Quản lý truy vấn quan hệ, khóa ngoại bảng ghi, và view ảo (consultants/accounts) tương thích.", true);

// Slide 5: SPA Route Architecture (Split Card)
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

// Slide 6: Single Entry Point (index.php) (Flowchart)
let s6 = createBaseSlide("Luồng API Đi Qua Cổng Backend Duy Nhất", "Backend");
drawFlowStep(s6, 0.8, 1.8, 2.5, 2.5, "1", "HTTP Request", "Yêu cầu từ SPA hoặc webhook đối tác gửi đến index.php kèm query action.");
drawFlowStep(s6, 3.65, 1.8, 2.5, 2.5, "2", "requireAuth check", "Xác thực JWT token, phân cấp người dùng và chuẩn hóa vai trò an toàn.");
drawFlowStep(s6, 6.5, 1.8, 2.5, 2.5, "3", "Controller Dispatch", "Gửi yêu cầu đến Controller tương ứng, trả kết quả JSON dạng chuẩn.", true);

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

// Slide 8: Role Normalization (Grid Table)
let s8 = createBaseSlide("Ánh Xạ Chuẩn Hóa Quyền Hạn requireAuth", "Xác thực");
addGridTable(s8, 0.8, 1.5, 8.8, 3.3,
    ["Dữ liệu Frontend truyền", "CSDL Backend yêu cầu", "Hành động chuẩn hóa", "Lý do kỹ thuật"],
    [
        ["role = 'sale'", "role = 'sales'", "Thay đổi ký tự cuối thêm 's'", "Đồng bộ phân quyền trong các Controller PHP"],
        ["id = 1004", "user_id = 1004", "Sao chép giá trị khóa chính", "Tương thích các logic lọc quan hệ bảng ghi cũ"],
        ["name = 'Thanh'", "full_name = 'Thanh'", "Ánh xạ key name nếu thiếu", "Ngăn chặn cảnh báo Undefined Index làm gãy JSON"]
    ]
);

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

// Slide 10: Tóm tắt phần 1 (Hero Landing Slide)
let s10 = createHeroSlide("KẾT LUẬN CHƯƠNG 1: KIẾN TRÚC & ĐỊNH TUYẾN", "Dựng nền tảng API PHP Router an toàn tuyệt đối với cơ chế bảo mật ba lớp và tăng tốc độ SPA bằng AppTabs giữ nguyên DOM.", "Kiến trúc lõi");
addHeroFeatures(s10, [
    { title: "Bảo mật 3 lớp", desc: "Kết hợp CORS whitelist -> requireAuth xác thực JWT -> tenant_id cô lập CSDL tuyệt đối." },
    { title: "AppTabs cache", desc: "Không unmount component, bảo vệ bộ lọc và trạng thái client, tối ưu 80% tài nguyên CPU." },
    { title: "Chuẩn hóa vai", desc: "Tự động dịch role, user_id và full_name để triệt tiêu lỗi Notice PHP làm gãy luồng API." }
]);

// Slide 11: Luồng lead đầu vào (Flowchart)
let s11 = createBaseSlide("Tiến Trình Xử Lý Lead Đầu Vào", "Chia Lead");
drawFlowStep(s11, 0.8, 1.8, 2.0, 2.5, "1", "Webhook nhận", "Lead thô từ LP/Meta đổ về dạng POST, normalize SĐT.");
drawFlowStep(s11, 3.0, 1.8, 2.0, 2.5, "2", "Persons Check", "Đối soát SĐT cũ trong CSDL, giữ nguyên chủ cũ nếu có.");
drawFlowStep(s11, 5.2, 1.8, 2.0, 2.5, "3", "getNext Sale", "Tìm Sale hợp lệ kế tiếp trong danh sách phân bổ của Round.");
drawFlowStep(s11, 7.4, 1.8, 2.0, 2.5, "4", "Được gán", "Lead chính thức chuyển trạng thái assigned và bắt đầu đếm 2p.", true);

// Slide 12: Round-Robin Distribution (Flowchart)
let s12 = createBaseSlide("Vòng Lặp Phân Phối Tròn getNextConsultant", "Chia Lead");
drawFlowStep(s12, 0.8, 1.8, 2.5, 2.5, "1", "Lấy Sale cuối", "Đọc id Sale nhận lead gần nhất từ distribution_rounds.");
drawFlowStep(s12, 3.65, 1.8, 2.5, 2.5, "2", "Tăng vị trí +1", "Xoay chỉ mục sang người tiếp theo, tìm trong CSDL.");
drawFlowStep(s12, 6.5, 1.8, 2.5, 2.5, "3", "Cập nhật khóa", "Ghi nhận Sale ID mới vào rounds làm mốc cho lần sau.", true);

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

// Slide 14: Gate 2: Selfie Check-in (KPI Card)
let s14 = createBaseSlide("Gate 2: Điểm Danh & Check-in Đầu Ngày", "5 Gates");
addKpiCard(s14, 0.8, 1.4, 4.0, 3.6, "Selfie check", "Kỷ luật check-in ngày", "Sale bắt buộc chụp ảnh selfie trước ca trực để được duyệt approved. Không check-in đồng nghĩa với không sẵn sàng trực -> Bị Gate loại trừ.");
addCard(s14, 5.3, 1.4, 4.3, 3.6, "Ngoại lệ được duyệt", [
    "- Sale đã đăng ký ca trực cuối tuần (weekend_shift) được duyệt.",
    "- Sale đăng ký trực ca ngày lễ (holiday_shift) được duyệt.",
    "- Sale trực ca đêm (night_shift) được duyệt sẽ tự động bỏ qua check-in."
]);

// Slide 15: Gate 3: Vacation Mode & Status
let s15 = createBaseSlide("Gate 3: Trạng Thế Sale & Nghỉ Phép", "5 Gates");
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

// Slide 16: Gate 4: Backpressure Valve (Van Chống Ôm Lead) (KPI Card)
let s16 = createBaseSlide("Gate 4: Van Chống Ôm Lead (Backpressure)", "5 Gates");
addKpiCard(s16, 0.8, 1.4, 4.0, 3.6, "Max 5", "Ngưỡng ôm lead", "Giới hạn số lead thô chưa xử lý tối đa Sale được găm giữ. Nếu vượt ngưỡng -> Chặn chia lead mới.");
addCard(s16, 5.3, 1.4, 4.3, 3.6, "Điều kiện tính lead chưa tương tác", [
    "- Trạng thái pipeline của KHTN là chưa_xac_dinh.",
    "- HOẶC trạng thái pipeline là quan_tam nhưng chưa hề có bất kỳ ghi chú (notes) hoặc hoạt động nào được ghi nhận từ Sale."
]);

// Slide 17: Gate 5: Quota & Limits (Native Bar Chart)
let s17 = createBaseSlide("Gate 5: Hạn Mức Lead Theo Cấu Hình", "5 Gates");
addCard(s17, 0.8, 1.4, 4.0, 3.6, "Cài đặt hạn mức (Quota)", [
    "- Hệ thống chặn chia lead nếu vượt giới hạn nhận trong ngày/tháng.",
    "- Hạn mức giờ: tối đa 3 lead nhận mỗi giờ.",
    "- Hạn mức ngày: cấu hình động tùy chiến dịch (mặc định 20 lead).",
    "- Hạn mức tháng: mặc định tối đa 300 lead nhận."
]);
let dataBarChart = [
    {
        name: "Hạn mức nhận tối đa",
        labels: ["Mức Giờ", "Mức Ngày", "Mức Tháng"],
        values: [3, 20, 300]
    }
];
s17.addChart(pptx.ChartType.bar, dataBarChart, {
    x: 5.2,
    y: 1.4,
    w: 4.3,
    h: 3.6,
    showLegend: true,
    legendPos: "b",
    chartColors: [COLORS.crimson]
});

// Slide 18: Fallback Routing (Flowchart)
let s18 = createBaseSlide("Quy Trình Định Tuyến Dự Phòng (Fallback)", "Chia Lead");
drawFlowStep(s18, 0.8, 1.8, 2.5, 2.5, "1", "Gãy luồng phân bổ", "Khi toàn bộ Sale trong vòng xoay đều bị Gate chặn, lead không thể chia.");
drawFlowStep(s18, 3.65, 1.8, 2.5, 2.5, "2", "Email dự phòng", "Kích hoạt gửi thông tin lead đến hòm thư liên hệ khẩn cấp của campaign.");
drawFlowStep(s18, 6.5, 1.8, 2.5, 2.5, "3", "Duyệt thủ công", "Lead được chuyển trực tiếp cho Admin duyệt và chia tay.", true);

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

// Slide 20: Tóm tắt phần 2 (Hero Landing Slide)
let s20 = createHeroSlide("KẾT LUẬN CHƯƠNG 2: 5 CỔNG KIỂM DUYỆT LEAD", "Thiết lập màng lọc thông minh, giám sát tự động độ sẵn sàng và hiệu năng tương tác của Sale để tối ưu hóa tỷ lệ chuyển đổi lead đầu vào.", "Phân phối thông minh");
addHeroFeatures(s20, [
    { title: "Selfie check-in", desc: "Ca ngày bắt buộc điểm danh selfie approved đầu ca để nhận lead; ca đêm/lễ duyệt đặc quyền." },
    { title: "Backpressure", desc: "Chốt chặn găm giữ quá 5 lead chưa xử lý, thúc đẩy tương tác phản hồi đầu tiên <15 phút." },
    { title: "Điểm bù credit", desc: "Tích lũy skipped_credit khi Sale đi gặp khách để bù lại lượng lead công bằng khi quay lại." }
]);

// ============================================================================
// PHẦN 3: ĐẶT CỌC & BỂ CỌC & CAPI (SLIDE 21 - 30)
// ============================================================================

// Slide 21: Giao dịch cọc (Native Line Chart)
let s21 = createBaseSlide("Quy Trình Đặt Cọc & Phê Duyệt Doanh Thu", "Đặt Cọc");
addCard(s21, 0.8, 1.4, 4.0, 3.6, "Thủ tục đặt cọc", [
    "- Sale tạo phiếu cọc trên App (Mã căn, dự án, giá trị, commission).",
    "- Khách hàng chuyển khoản, upload minh chứng UNC lên hệ thống.",
    "- Kế toán kiểm tra tiền nổi trong tài khoản ngân hàng và duyệt approved."
]);
let dataLineChart = [
    {
        name: "Phiếu cọc tạo",
        labels: ["T1", "T2", "T3", "T4", "T5", "T6"],
        values: [20, 30, 25, 45, 50, 40]
    },
    {
        name: "Phiếu cọc duyệt",
        labels: ["T1", "T2", "T3", "T4", "T5", "T6"],
        values: [15, 25, 20, 40, 48, 38]
    }
];
s21.addChart(pptx.ChartType.line, dataLineChart, {
    x: 5.2,
    y: 1.4,
    w: 4.3,
    h: 3.6,
    showLegend: true,
    legendPos: "b",
    chartColors: [COLORS.crimson, COLORS.green]
});

// Slide 22: Chi tiết thông tin phiếu cọc (Grid Table)
let s22 = createBaseSlide("Lược Đồ Cấu Trúc deposit_milestones", "Đặt Cọc");
addGridTable(s22, 0.8, 1.5, 8.8, 3.3, 
    ["Trường CSDL", "Kiểu dữ liệu", "Khóa / Ràng buộc", "Mô tả vai trò"],
    [
        ["id", "INT (11) AUTO_INCREMENT", "PRIMARY KEY", "Mã định danh đợt đóng tiền độc nhất"],
        ["deposit_id", "INT (11)", "FOREIGN KEY -> deposits(id)", "Liên kết phiếu đặt cọc tương ứng"],
        ["amount", "DECIMAL (15,2)", "NOT NULL", "Số tiền phải đóng hoặc thực thu đợt này"],
        ["status", "ENUM('pending','approved','failed')", "DEFAULT 'pending'", "Trạng thái phê duyệt chứng từ đóng tiền"],
        ["invoice_id", "INT (11)", "FOREIGN KEY -> invoices(id)", "Hóa đơn tài chính được sinh tự động"]
    ]
);

// Slide 23: Quy tắc Bể cọc (Flowchart)
let s23 = createBaseSlide("Luồng Nghiệp Vụ Xử Lý Hủy Đặt Cọc (Bể Cọc)", "Bể Cọc");
drawFlowStep(s23, 0.8, 1.8, 2.5, 2.5, "1", "Yêu cầu hủy cọc", "Nhận yêu cầu hủy cọc từ khách hàng, kiểm tra lịch sử milestones đóng tiền.");
drawFlowStep(s23, 3.65, 1.8, 2.5, 2.5, "2", "Kiểm tra doanh thu", "Đối soát số đợt đóng tiền approved. Nếu = 0 -> Hạ cấp; Nếu > 0 -> Giữ nguyên.");
drawFlowStep(s23, 6.5, 1.8, 2.5, 2.5, "3", "Khóa & Ghi log", "Cập nhật trạng thái phiếu cọc, giải phóng căn hộ và ghi nhật ký.", true);

// Slide 24: Bể cọc trước doanh thu (KPI Card)
let s24 = createBaseSlide("Hủy Cọc Khi Chưa Phát Sinh Doanh Thu", "Bể Cọc");
addKpiCard(s24, 0.8, 1.4, 4.0, 3.6, "Hạ cấp KHTN", "Hạ trạng thái & rớt nhiệt", "Trạng thái khách hàng bị hạ về Booking/Đã Gặp. Nhiệt độ rớt 1 cấp (Hot -> Warm -> Neutral...). Bắt đầu chạy lại đồng hồ bảo mật 3 tháng.");
addCard(s24, 5.3, 1.4, 4.3, 3.6, "Lý do kỹ thuật & kinh tế", [
    "- Công ty chưa thực thu được dòng tiền thực tế nào từ giao dịch.",
    "- Cho phép lead tự động trả về kho chung (Databank) sau khi hết hạn bảo mật để Sale khác khai thác.",
    "- Tối ưu hóa tối đa vòng đời vòng lặp của lead tiềm năng."
]);

// Slide 25: Bể cọc sau doanh thu (KPI Card)
let s25 = createBaseSlide("Hủy Cọc Khi Đã Phát Sinh Doanh Thu", "Bể Cọc");
addKpiCard(s25, 0.8, 1.4, 4.0, 3.6, "Giữ Đặt Cọc", "Không hạ trạng thái KHTN", "Person được giữ nguyên trạng thái Đặt Cọc/Khách Hàng. Đồng hồ bảo mật dừng chạy, lead không bao giờ bị thu hồi ra kho chung.");
addCard(s25, 5.3, 1.4, 4.3, 3.6, "Lý do kỹ thuật & kinh tế", [
    "- Công ty đã thực thu được đợt tiền approved (đã có hoa hồng thực tế).",
    "- Xác nhận thực tế Person này là Khách Hàng thật của doanh nghiệp.",
    "- Giữ lại chủ cũ để tiếp tục chăm sóc bán lại hoặc làm đại sứ thương hiệu."
]);

// Slide 26: Unit Switching (Đổi căn) (Flowchart)
let s26 = createBaseSlide("Luồng Nghiệp Vụ Đổi Căn Hộ Giao Dịch", "Đổi Căn");
drawFlowStep(s26, 0.8, 1.8, 2.5, 2.5, "1", "Hủy phiếu cọc cũ", "Khóa và đánh dấu hủy phiếu đặt cọc cũ của căn hộ A, lưu giữ lịch sử tài chính.");
drawFlowStep(s26, 3.65, 1.8, 2.5, 2.5, "2", "Tạo phiếu cọc mới", "Khởi tạo phiếu đặt cọc mới hoàn toàn cho căn hộ B với các mốc milestone mới.");
drawFlowStep(s26, 6.5, 1.8, 2.5, 2.5, "3", "Liên kết vết audit", "Tạo ghi chú liên kết dạng 'Đổi căn từ căn A' tại deal mới để đối chiếu chéo.", true);

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

// Slide 28: Meta Conversion API (CAPI) (Flowchart)
let s28 = createBaseSlide("Luồng Tín Hiệu Meta Conversion API (CAPI)", "Meta CAPI");
drawFlowStep(s28, 0.8, 1.8, 2.5, 2.5, "1", "Nghiệp vụ CRM", "Sale cập nhật trạng thái lead hoặc kế toán duyệt đặt cọc approved.");
drawFlowStep(s28, 3.65, 1.8, 2.5, 2.5, "2", "Bắn thẳng Meta API", "Hệ thống băm SHA256 SĐT/email, gửi sự kiện trực tiếp không qua trung gian.");
drawFlowStep(s28, 6.5, 1.8, 2.5, 2.5, "3", "Meta Pixel match", "Meta đối soát mã lead_id để tối ưu hóa thuật toán phân phối ads.", true);

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

// Slide 30: Tóm tắt phần 3 (Hero Landing Slide)
let s30 = createHeroSlide("KẾT LUẬN CHƯƠNG 3: TÀI CHÍNH & CAPI", "Bảo vệ dòng tiền thực thu thông qua kế toán đối soát, vết kiểm toán audit trail và connector trực tiếp Meta Conversion API.", "Tài chính & CAPI");
addHeroFeatures(s30, [
    { title: "Bể cọc phân nhánh", desc: "Hủy cọc trước doanh thu hạ cấp trả kho; hủy cọc sau doanh thu giữ nguyên cọc bảo vệ thực thu." },
    { title: "Unit switching", desc: "Hủy cọc cũ và mở cọc mới, gắn định danh link nguồn giữ trọn vẹn vết kiểm toán tài chính." },
    { title: "CAPI forward-only", desc: "Bắn tín hiệu 1 chiều từ CSDL, chặn gửi sự kiện hoàn trả giúp bảo vệ thuật toán học Meta." }
]);

// ============================================================================
// PHẦN 4: AI TRAINING & RAG SYSTEM (SLIDE 31 - 38)
// ============================================================================

// Slide 31: Introduction to AI RAG (Flowchart)
let s31 = createBaseSlide("Mô Hình Tri Thức AI RAG Truy Xuất", "AI RAG");
drawFlowStep(s31, 0.8, 1.8, 2.5, 2.5, "1", "Upload Tri Thức", "Quản trị viên đưa tài liệu PDF/Web dự án vào hệ thống qua AITrainingPanel.");
drawFlowStep(s31, 3.65, 1.8, 2.5, 2.5, "2", "Embeddings API", "Chia nhỏ đoạn văn bản (chunking) và sinh vector đặc trưng 768 chiều qua API.");
drawFlowStep(s31, 6.5, 1.8, 2.5, 2.5, "3", "CSDL Vector Cache", "Lưu trữ vector và text chunk vào bảng ai_vector_cache để truy xuất nhanh.", true);

// Slide 32: Vector Embeddings (KPI Cards)
let s32 = createBaseSlide("Chỉ Số Hiệu Năng Bộ Đệm Vector Cache", "AI RAG");
addKpiCard(s32, 0.8, 1.4, 2.7, 3.6, "768 Dim", "Kích thước Vector", "Độ rộng chiều vector đặc trưng ngữ nghĩa tạo bởi mô hình gemini-embedding-001.");
addKpiCard(s32, 3.85, 1.4, 2.7, 3.6, "90 %", "Tỷ lệ Hit Cache CSDL", "Tận dụng cache MD5 cục bộ giúp giảm lượng cuộc gọi API ngoài sinh trùng lặp.");
addKpiCard(s32, 6.9, 1.4, 2.7, 3.6, "< 5ms", "Độ trễ đối khớp Cosine", "Thời gian tính độ tương đồng vector ngay trong PHP cho trải nghiệm chớp mắt.");

// Slide 33: RAG Architecture (Flowchart)
let s33 = createBaseSlide("Luồng Truy Xuất Ngữ Cảnh Tri Thức AI RAG", "AI RAG");
drawFlowStep(s33, 0.8, 1.8, 2.5, 2.5, "1", "Câu hỏi mới", "Người dùng nhập câu hỏi hoặc ghi chú lead mới đổ về hệ thống.");
drawFlowStep(s33, 3.65, 1.8, 2.5, 2.5, "2", "Cosine Match", "Đối soát tương đồng ngữ nghĩa trong PHP để tìm 3 đoạn tri thức phù hợp nhất.");
drawFlowStep(s33, 6.5, 1.8, 2.5, 2.5, "3", "LLM Answer", "Nhúng tri thức làm ngữ cảnh và gửi Gemini tạo câu trả lời chuẩn xác.", true);

// Slide 34: Semantic Search vs Keyword Matching (Grid Table)
let s34 = createBaseSlide("Bảng So Sánh Cơ Chế Tìm Kiếm Tri Thức", "AI RAG");
addGridTable(s34, 0.8, 1.5, 8.8, 3.3,
    ["Đặc điểm đối soát", "Tìm kiếm từ khóa truyền thống", "Tìm kiếm ngữ nghĩa (Vector Search)", "Lợi ích cho CRM"],
    [
        ["Phương pháp khớp", "Trùng lặp ký tự chính xác", "Tính toán tương đồng vector Cosine", "Hiểu ý định thay vì chữ viết"],
        ["Từ đồng nghĩa", "Bỏ sót hoàn toàn", "Nhận diện tốt (chung cư = căn hộ)", "Tăng độ bao phủ câu hỏi"],
        ["Lỗi chính tả nhẹ", "Không tìm thấy kết quả", "Vẫn khớp chính xác nhờ khoảng cách", "Bảo vệ độ trễ phản hồi"]
    ]
);

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

// Slide 36: Screening Logic & Decisions (Flowchart)
let s36 = createBaseSlide("Tiến Trình AI Sàng Lọc Phân Loại Lead", "AI RAG");
drawFlowStep(s36, 0.8, 1.8, 2.5, 2.5, "1", "Nhận Lead", "Đọc thông tin ghi chú tương tác ban đầu của lead mới nhận.");
drawFlowStep(s36, 3.65, 1.8, 2.5, 2.5, "2", "AI Phân Loại", "Gemini đối chiếu tri thức, chấm độ tự tin của quyết định.");
drawFlowStep(s36, 6.5, 1.8, 2.5, 2.5, "3", "Lọc Spam / Sai số", "Nếu tự tin > 85%, tự động gán nhãn loại bỏ lead ảo.", true);

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

// Slide 38: Tóm tắt phần 4 (Hero Landing Slide)
let s38 = createHeroSlide("KẾT LUẬN CHƯƠNG 4: HỆ THỐNG TRÍ TUỆ RAG", "Nạp tri thức tài liệu dự án, số hóa thông tin căn hộ thông qua Vector Embeddings và thuật toán tìm kiếm tương đồng ngữ nghĩa trong PHP.", "Trí tuệ RAG");
addHeroFeatures(s38, [
    { title: "768 chiều vector", desc: "Sử dụng gemini-embedding-001 ánh xạ ngữ nghĩa đoạn văn bản 700 ký tự." },
    { title: "Cosine Similarity", desc: "So khớp ngữ nghĩa chớp mắt <5ms trong PHP, bỏ qua sự phụ thuộc vào Vector DB ngoài." },
    { title: "Bộ đệm MD5 Cache", desc: "Tận dụng bảng CSDL ai_vector_cache lưu vết vector, triệt tiêu 90% chi phí gọi API ngoài." }
]);

// ============================================================================
// PHẦN 5: ĐỒNG BỘ GOOGLE SHEETS & WEBHOOKS (SLIDE 39 - 46)
// ============================================================================

// Slide 39: Google Sheets Integration (Grid Table)
let s39 = createBaseSlide("Cấu Trúc Cột Cấu Hình sheet_connections", "Liên kết");
addGridTable(s39, 0.8, 1.5, 8.8, 3.3,
    ["Trường cấu hình", "Kiểu dữ liệu", "Giá trị ví dụ", "Mục đích sử dụng"],
    [
        ["spreadsheet_id", "VARCHAR(128)", "1g3v...Kx4", "Mã định danh duy nhất của Google Sheets"],
        ["sheet_name", "VARCHAR(50)", "'Lead Form'", "Tên cụ thể của thẻ tab cần đồng bộ"],
        ["sync_interval_minutes", "INT(11)", "5", "Chu kỳ thời gian chạy cron quét cập nhật"],
        ["is_active", "TINYINT(1)", "1", "Cờ cho phép bật/tắt tạm thời kết nối đồng bộ"]
    ]
);

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

// Slide 41: Two-Way Sync Conflict Resolution (Flowchart)
let s41 = createBaseSlide("Đối Soát Chống Lặp Đồng Bộ Hai Chiều", "Liên kết");
drawFlowStep(s41, 0.8, 1.8, 2.5, 2.5, "1", "Tính mã băm SHA256", "Tính mã băm cho dữ liệu mỗi dòng trên Google Sheets.");
drawFlowStep(s41, 3.65, 1.8, 2.5, 2.5, "2", "So sánh đối soát", "Lưu hash vào sheet_sync_records, chỉ đồng bộ nếu hash mới khác hash cũ.");
drawFlowStep(s41, 6.5, 1.8, 2.5, 2.5, "3", "Chống lặp vô hạn", "Bỏ qua các dòng chỉnh sửa sinh ra từ chính CRM cập nhật lên.", true);

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

// Slide 43: Admin Chat Command Console (Chat Bubbles Mockup)
let s43 = createBaseSlide("Bảng Mô Phỏng Tập Lệnh Tương Tác Qua Chat", "Điều khiển");
drawChatBubble(s43, 0.8, 1.5, 4.2, 1.6, "Quản lý (Telegram Group)", "/report\n\nYêu cầu xuất báo cáo số liệu lead mới nhận ngày hôm nay.");
drawChatBubble(s43, 0.8, 3.3, 4.2, 1.6, "Quản lý (Telegram Group)", "/duyet 105\n\nDuyệt nhanh phiếu cọc mã số 105 để kế toán khóa giao dịch.");
drawChatBubble(s43, 5.3, 1.5, 4.2, 3.4, "Rich Land CRM Bot", "BÁO CÁO DOANH THU HÔM NAY:\n\n- Lead mới nhận: 45 lead\n- Phiếu cọc mới: 5 phiếu\n- Đã duyệt: 3 phiếu (Doanh thu: 150tr)\n- Đang trực: 12 Sale\n\n[SUCCESS] Hệ thống vận hành bình thường.", true);

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

// Slide 46: Tóm tắt phần 5 (Hero Landing Slide)
let s46 = createHeroSlide("KẾT LUẬN CHƯƠNG 5: ĐỒNG BỘ & TRUNG TÂM LỆNH CHAT", "Tích hợp đa kênh thời gian thực thông qua đồng bộ bảng tính Google Sheets và bảng lệnh Chatbot Webhooks điều khiển quản trị trên Telegram/Zalo di động.", "Liên kết & Điều khiển");
addHeroFeatures(s46, [
    { title: "Mutex lock & hash", desc: "Khóa tệp cron_sync.lock và so khớp SHA256 chống lặp ghi đè vô hạn giữa CRM và Sheets." },
    { title: "Webhook instant", desc: "Tiếp nhận thô và phân loại ngầm lead thô LP/Meta trong <20ms, chặn đứng tỷ lệ trôi thất thoát lead." },
    { title: "Chat command console", desc: "Tập lệnh slash commands bảo mật token URL giúp Manager duyệt nhanh cọc/check-in trên di động." }
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
    "- Chi phí gọi cURL không đồng bộ hóa sẽ tạo ra thắt nút cổ chai cục bộ.",
    "- Đẩy toàn bộ thông báo Zalo/Telegram về hàng đợi nền database.",
    "- Rút ngắn thời gian phản hồi webhook nhận lead xuống dưới 20ms."
]);

// Slide 48: Asynchronous Messaging (Flowchart)
let s48 = createBaseSlide("Mô Hình Hàng Đợi Bất Đồng Bộ Hóa", "Hàng Đợi");
drawFlowStep(s48, 0.8, 1.8, 2.5, 2.5, "1", "Lưu hàng đợi DB", "Hàm Notification gửi tham số sync=false ghi tin nhắn vào zalo/telegram_queue.");
drawFlowStep(s48, 3.65, 1.8, 2.5, 2.5, "2", "Quét ngầm Worker", "Cron job worker chạy ngầm độc lập mỗi phút quét danh sách tin chờ gửi.");
drawFlowStep(s48, 6.5, 1.8, 2.5, 2.5, "3", "Gửi API ngoài", "Gọi cURL ngoài ngầm, tự động thử lại 3 lần nếu mất mạng và dọn logs.", true);

// Slide 49: Queue Table Schemas (Grid Table)
let s49 = createBaseSlide("Lược Đồ Bảng Hàng Đợi zalo_queue", "Hàng Đợi");
addGridTable(s49, 0.8, 1.5, 8.8, 3.3,
    ["Trường CSDL", "Kiểu dữ liệu", "Ràng buộc / Mặc định", "Vai trò nghiệp vụ"],
    [
        ["id", "INT (11) AUTO_INCREMENT", "PRIMARY KEY", "Định danh tin nhắn duy nhất"],
        ["payload", "TEXT", "NOT NULL", "Dữ liệu JSON chứa số điện thoại, nội dung gửi"],
        ["status", "VARCHAR (20)", "'pending'", "Trạng thái hàng đợi: pending, processing, sent, failed"],
        ["attempts", "INT (11)", "0", "Số lần đã thử gửi tin nhắn khi gặp lỗi mạng"],
        ["lead_id", "INT (11)", "NULL", "Liên kết lead để đối soát mốc thời gian nhận"]
    ]
);

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

// Slide 53: Real-time Lead Countdown (KPI Card)
let s53 = createBaseSlide("Đồng Hồ Bảo Mật & Phản Hồi Real-Time", "Hàng Đợi");
addKpiCard(s53, 0.8, 1.4, 4.0, 3.6, "120s", "Thời gian nhận lead", "Khoảng thời gian đếm ngược quy định Sale phải click tiếp nhận lead trên Web App. Quá hạn hệ thống tự động thu hồi (Recall) chia cho người tiếp theo.");
addCard(s53, 5.3, 1.4, 4.3, 3.6, "Đồng bộ mốc kích hoạt", [
    "- Mốc bắt đầu tính giờ được kích hoạt chính xác ngay khi tin nhắn báo lead gửi thành công qua Telegram/Zalo.",
    "- Loại bỏ hoàn toàn sai lệch thời gian do độ trễ mạng khi gọi API ngoài.",
    "- Đảm bảo Sale luôn có đủ trọn vẹn 120 giây để bấm nhận lead."
]);

// Slide 54: The Testing Harness (Grid Table)
let s54 = createBaseSlide("Bản Đồ Thành Phần Khung Kiểm Thử Tích Hợp", "DevOps");
addGridTable(s54, 0.8, 1.5, 8.8, 3.3,
    ["Cấu phần kiểm thử", "Mục tiêu đối soát", "Hàm hỗ trợ chẩn đoán", "Tệp tin cấu hình"],
    [
        ["Kết nối CSDL", "Đối soát pool kết nối an toàn", "$conn (MySQLi) & $pdo (PDO)", "test_bootstrap.php"],
        ["Phân bổ xoay vòng", "Kiểm thử round-robin, vacation, check-in", "getNextConsultantInRound()", "test_rotation_audit.php"],
        ["Đồng hồ Recall", "Đo thời gian trôi lead thu hồi", "recallInactiveLeads()", "test_lead_recall_async.php"],
        ["Xếp hạng truy vấn", "Quét lỗi tương thích MariaDB", "SQL Scan Tool script", "test_schema_queries.php"]
    ]
);

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
    "- Đóng bộ tệp schema master unified_schema.sql ngay khi có chỉnh sửa.",
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

// Slide 59: Git Integration & Deployment (Flowchart)
let s59 = createBaseSlide("Quy Trình Triển Khai Deploy Song Song", "DevOps");
drawFlowStep(s59, 0.8, 1.8, 2.5, 2.5, "1", "Lệnh Deploy", "Manager gõ lệnh deploy chính thức, hệ thống bắt sự kiện.");
drawFlowStep(s59, 3.65, 1.8, 2.5, 2.5, "2", "Deploy song song", "Chạy build code mới lên Staging và áp dụng các nâng cấp database ngầm.");
drawFlowStep(s59, 6.5, 1.8, 2.5, 2.5, "3", "Git Commit & Push", "Đồng bộ commit code mới nhất lên main branch cùng lúc.", true);

// Slide 60: Conclusion & Roadmap (Hero Landing Slide)
let s60 = createHeroSlide("LỘ TRÌNH PHÁT TRIỂN & NÂNG CẤP HỆ THỐNG", "Kế hoạch nâng cấp và mở rộng khả năng tối ưu hóa chuyển đổi, tương tác tự động ở quy mô lớn cho Rich Land CRM.", "Roadmap");
addHeroFeatures(s60, [
    { title: "Phase 1: Hạ tầng", desc: "Ổn định phân chia lead thông qua 5 Gate bảo mật, check-in selfie và hàng đợi tin nhắn ngầm." },
    { title: "Phase 2: RAG & Chat", desc: "Nạp tri thức tự động bằng Vector, chatbot commands quản lý di động và AI screening." },
    { title: "Phase 3: Mở rộng", desc: "Tích hợp IP Phone, ghi âm cuộc gọi, phân tích Cost Ads sâu (ROAS) đến ad creative cụ thể." }
]);

// Thêm chân trang slide cho tất cả các slide (chỉ số trang và bản quyền)
let totalSlides = pptx.slides.length;
pptx.slides.forEach((slide, index) => {
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
