import pptxgen from "pptxgenjs";

console.log("=================================================");
console.log("🚀 THIẾT KẾ ĐA DẠNG LAYOUT CAO CẤP - 60 SLIDE");
console.log("=================================================");

let pptx = new pptxgen();

// Thiết lập tỷ lệ màn hình rộng 16:9
pptx.layout = "LAYOUT_16x9";

// Cấu hình bảng màu Dashboard UI cao cấp (Light Theme & Brand Red)
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
// STYLE 1: White Card Container with App List Style
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
// STYLE 2: Big KPI Metric Dashboard Cards
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
// STYLE 3: Visual Flowchart / Progress Step Blocks
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
// STYLE 4: Native PowerPoint Grid Tables
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
// STYLE 5: Chat Dialogue / Chatbot Console Mockups
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
// STYLE 6: Full-bleed Brand Red Landing Page Transition Slide
// ----------------------------------------------------------------------------
function createCrimsonHeroSlide(title, subtitle, partNum) {
    let slide = pptx.addSlide();
    slide.background = { color: COLORS.crimson }; 

    slide.addText(partNum.toUpperCase(), {
        x: 1.0,
        y: 1.0,
        w: 8.0,
        h: 0.3,
        fontSize: 13,
        fontFace: "Segoe UI",
        color: "FFC1C1", 
        bold: true,
        valign: "middle"
    });

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

    slide.addText(subtitle, {
        x: 1.0,
        y: 2.6,
        w: 8.0,
        h: 0.6,
        fontSize: 11.5,
        fontFace: "Segoe UI",
        color: "F1F5F9",
        valign: "top",
        lineSpacing: 16
    });

    return slide;
}

function addCrimsonFeatures(slide, features) {
    let cardW = 2.4;
    let cardH = 1.7;
    let startX = 1.0;
    let gap = 0.4;

    features.forEach((feat, idx) => {
        let x = startX + idx * (cardW + gap);
        let y = 3.3;

        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: x,
            y: y,
            w: cardW,
            h: cardH,
            fill: { color: "9C1523" }, 
            line: { color: "C92A3A", width: 1 },
            rectRadius: 0.08
        });

        slide.addText(feat.title.toUpperCase(), {
            x: x + 0.15,
            y: y + 0.15,
            w: cardW - 0.3,
            h: 0.3,
            fontSize: 9.5,
            fontFace: "Segoe UI",
            color: COLORS.white,
            bold: true
        });

        slide.addText(feat.desc, {
            x: x + 0.15,
            y: y + 0.45,
            w: cardW - 0.3,
            h: cardH - 0.6,
            fontSize: 8.5,
            fontFace: "Segoe UI",
            color: "F1F5F9",
            valign: "top",
            lineSpacing: 12
        });
    });
}

// ----------------------------------------------------------------------------
// STYLE 7: Split Comparison Layout (Challenge vs Solution side-by-side)
// ----------------------------------------------------------------------------
function addSplitComparison(slide, x, y, w, h, leftTitle, leftLines, rightTitle, rightLines) {
    let panelW = (w - 0.4) / 2;
    
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: panelW,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.crimson, width: 1.8 },
        rectRadius: 0.06
    });
    
    slide.addText(leftTitle.toUpperCase(), {
        x: x + 0.2,
        y: y + 0.15,
        w: panelW - 0.4,
        h: 0.3,
        fontSize: 9.5,
        fontFace: "Segoe UI",
        color: COLORS.crimson,
        bold: true
    });
    
    let leftText = leftLines.map(line => line.startsWith("- ") ? "▪  " + line.substring(2) : line).join("\n\n");
    slide.addText(leftText, {
        x: x + 0.2,
        y: y + 0.5,
        w: panelW - 0.4,
        h: h - 0.7,
        fontSize: 9,
        fontFace: "Segoe UI",
        color: COLORS.textGray,
        valign: "top",
        lineSpacing: 12
    });

    let rightX = x + panelW + 0.4;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: rightX,
        y: y,
        w: panelW,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: "059669", width: 1.8 },
        rectRadius: 0.06
    });
    
    slide.addText(rightTitle.toUpperCase(), {
        x: rightX + 0.2,
        y: y + 0.15,
        w: panelW - 0.4,
        h: 0.3,
        fontSize: 9.5,
        fontFace: "Segoe UI",
        color: "059669",
        bold: true
    });
    
    let rightText = rightLines.map(line => line.startsWith("- ") ? "▪  " + line.substring(2) : line).join("\n\n");
    slide.addText(rightText, {
        x: rightX + 0.2,
        y: y + 0.5,
        w: panelW - 0.4,
        h: h - 0.7,
        fontSize: 9,
        fontFace: "Segoe UI",
        color: COLORS.textGray,
        valign: "top",
        lineSpacing: 12
    });
}

// ----------------------------------------------------------------------------
// STYLE 8: Asymmetric Stat Block Layout
// ----------------------------------------------------------------------------
function addAsymmetricStatBlock(slide, x, y, w, h, statVal, statLabel, statDesc, rightTitle, rightLines) {
    let leftW = w * 0.38;
    let rightW = w * 0.58;
    
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: leftW,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.crimson, width: 2 },
        rectRadius: 0.06
    });
    
    slide.addText(statVal, {
        x: x + 0.15,
        y: y + 0.3,
        w: leftW - 0.3,
        h: 0.8,
        fontSize: 34,
        fontFace: "Segoe UI",
        color: COLORS.crimson,
        bold: true,
        align: "center",
        valign: "middle"
    });
    
    slide.addText(statLabel.toUpperCase(), {
        x: x + 0.15,
        y: y + 1.2,
        w: leftW - 0.3,
        h: 0.3,
        fontSize: 9.5,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        bold: true,
        align: "center"
    });
    
    slide.addText(statDesc, {
        x: x + 0.15,
        y: y + 1.6,
        w: leftW - 0.3,
        h: h - 1.8,
        fontSize: 8.5,
        fontFace: "Segoe UI",
        color: COLORS.textGray,
        align: "center",
        valign: "top",
        lineSpacing: 12
    });
    
    let rightX = x + leftW + (w * 0.04);
    addCard(slide, rightX, y, rightW, h, rightTitle, rightLines);
}

// ----------------------------------------------------------------------------
// STYLE 9: Circular Timeline Progress Flow
// ----------------------------------------------------------------------------
function addTimelineFlow(slide, x, y, w, h, steps) {
    let stepCount = steps.length;
    let stepW = (w - (0.3 * (stepCount - 1))) / stepCount;
    let stepH = h;
    
    steps.forEach((step, idx) => {
        let stepX = x + idx * (stepW + 0.3);
        
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: stepX,
            y: y,
            w: stepW,
            h: stepH,
            fill: { color: COLORS.cardBg },
            line: { color: COLORS.border, width: 1 },
            rectRadius: 0.06
        });
        
        if (idx < stepCount - 1) {
            slide.addShape(pptx.shapes.LINE, {
                x: stepX + stepW,
                y: y + 0.4,
                w: 0.3,
                h: 0,
                line: { color: COLORS.crimson, width: 1.5, dashType: "dash" }
            });
        }
        
        slide.addShape(pptx.shapes.OVAL, {
            x: stepX + stepW / 2 - 0.2,
            y: y + 0.2,
            w: 0.4,
            h: 0.4,
            fill: { color: COLORS.crimson },
            line: { color: COLORS.white, width: 1.5 }
        });
        
        slide.addText((idx + 1).toString(), {
            x: stepX + stepW / 2 - 0.2,
            y: y + 0.2,
            w: 0.4,
            h: 0.4,
            fontSize: 9.5,
            fontFace: "Segoe UI",
            color: COLORS.white,
            bold: true,
            align: "center",
            valign: "middle"
        });
        
        slide.addText(step.title, {
            x: stepX + 0.1,
            y: y + 0.75,
            w: stepW - 0.2,
            h: 0.3,
            fontSize: 9.5,
            fontFace: "Segoe UI",
            color: COLORS.textDark,
            bold: true,
            align: "center"
        });
        
        slide.addText(step.desc, {
            x: stepX + 0.1,
            y: y + 1.1,
            w: stepW - 0.2,
            h: stepH - 1.2,
            fontSize: 8,
            fontFace: "Segoe UI",
            color: COLORS.textGray,
            align: "center",
            valign: "top",
            lineSpacing: 10
        });
    });
}

// ----------------------------------------------------------------------------
// STYLE 10: VSCode Editor Code Mockups
// ----------------------------------------------------------------------------
function drawCodeEditorCard(slide, x, y, w, h, editorTitle, codeLines) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: "1E293B" }, // VSCode Dark Theme
        line: { color: "334155", width: 1.5 },
        rectRadius: 0.05
    });

    slide.addShape(pptx.shapes.RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: 0.35,
        fill: { color: "0F172A" }
    });

    let dotColors = ["EF4444", "F59E0B", "10B981"];
    dotColors.forEach((color, idx) => {
        slide.addShape(pptx.shapes.OVAL, {
            x: x + 0.15 + (idx * 0.15),
            y: y + 0.12,
            w: 0.1,
            h: 0.1,
            fill: { color: color }
        });
    });

    slide.addText(editorTitle, {
        x: x + 0.7,
        y: y,
        w: w - 1.0,
        h: 0.35,
        fontSize: 8,
        fontFace: "Consolas",
        color: "94A3B8",
        valign: "middle"
    });

    let codeText = codeLines.map((line, idx) => {
        let lineNum = (idx + 1).toString().padStart(2, " ");
        return `${lineNum} |  ${line}`;
    }).join("\n");

    slide.addText(codeText, {
        x: x + 0.15,
        y: y + 0.45,
        w: w - 0.3,
        h: h - 0.55,
        fontSize: 8.2,
        fontFace: "Consolas",
        color: "E2E8F0",
        valign: "top",
        lineSpacing: 11
    });
}

// ----------------------------------------------------------------------------
// STYLE 11: CRM Lead Profile Ticket Mockup Cards
// ----------------------------------------------------------------------------
function drawLeadTicketCard(slide, x, y, w, h, clientName, phone, source, temperature, statusText = "Assigned") {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.border, width: 1 },
        rectRadius: 0.08
    });

    slide.addShape(pptx.shapes.RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: 0.3,
        fill: { color: "F8FAFC" }
    });

    slide.addShape(pptx.shapes.OVAL, {
        x: x + 0.15,
        y: y + 0.1,
        w: 0.1,
        h: 0.1,
        fill: { color: "3B82F6" }
    });

    slide.addText(`TICKET: ${statusText.toUpperCase()}`, {
        x: x + 0.3,
        y: y,
        w: w - 0.4,
        h: 0.3,
        fontSize: 8,
        fontFace: "Segoe UI",
        color: "475569",
        bold: true,
        valign: "middle"
    });

    slide.addText(clientName, {
        x: x + 0.15,
        y: y + 0.4,
        w: w - 0.3,
        h: 0.25,
        fontSize: 10.5,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        bold: true
    });

    slide.addText(phone, {
        x: x + 0.15,
        y: y + 0.65,
        w: w - 0.3,
        h: 0.2,
        fontSize: 9,
        fontFace: "Segoe UI",
        color: COLORS.textGray
    });

    // Source Badge
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.15,
        y: y + 0.95,
        w: 0.9,
        h: 0.22,
        fill: { color: "E0F2FE" }, 
        rectRadius: 0.5
    });
    slide.addText(source, {
        x: x + 0.15,
        y: y + 0.95,
        w: 0.9,
        h: 0.22,
        fontSize: 7.5,
        fontFace: "Segoe UI",
        color: "0369A1", 
        bold: true,
        align: "center",
        valign: "middle"
    });

    // Temperature Badge
    let tempColor = temperature.toUpperCase() === "HOT" || temperature.toUpperCase() === "VALID" ? COLORS.crimson : "D97706";
    let tempBg = temperature.toUpperCase() === "HOT" || temperature.toUpperCase() === "VALID" ? COLORS.crimsonBg : "FEF3C7";
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x + 1.15,
        y: y + 0.95,
        w: 0.8,
        h: 0.22,
        fill: { color: tempBg },
        rectRadius: 0.5
    });
    slide.addText(temperature, {
        x: x + 1.15,
        y: y + 0.95,
        w: 0.8,
        h: 0.22,
        fontSize: 7.5,
        fontFace: "Segoe UI",
        color: tempColor,
        bold: true,
        align: "center",
        valign: "middle"
    });
}

// ----------------------------------------------------------------------------
// STYLE 12: Sale User Profile Card with Quota progress bars
// ----------------------------------------------------------------------------
function drawSaleProfileCard(slide, x, y, w, h, name, status, quotaUsed, quotaMax) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.border, width: 1 },
        rectRadius: 0.08
    });

    slide.addShape(pptx.shapes.OVAL, {
        x: x + 0.15,
        y: y + 0.15,
        w: 0.45,
        h: 0.45,
        fill: { color: "F1F5F9" },
        line: { color: COLORS.border, width: 1 }
    });
    slide.addText(name.charAt(0), {
        x: x + 0.15,
        y: y + 0.15,
        w: 0.45,
        h: 0.45,
        fontSize: 12,
        fontFace: "Segoe UI",
        color: COLORS.crimson,
        bold: true,
        align: "center",
        valign: "middle"
    });

    slide.addText(name, {
        x: x + 0.7,
        y: y + 0.15,
        w: w - 0.8,
        h: 0.25,
        fontSize: 10,
        fontFace: "Segoe UI",
        color: COLORS.textDark,
        bold: true
    });

    let isOnline = status.toUpperCase() === "ONLINE" || status.toUpperCase() === "ACTIVE";
    let isVacation = status.toUpperCase() === "VACATION" || status.toUpperCase() === "OFF" || status.toUpperCase() === "LEAVE" || status.toUpperCase() === "BLOCKED";
    let badgeBg = isOnline ? COLORS.greenBg : (isVacation ? COLORS.crimsonBg : "E2E8F0");
    let badgeText = isOnline ? COLORS.green : (isVacation ? COLORS.crimson : "475569");
    
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.7,
        y: y + 0.4,
        w: 0.9,
        h: 0.2,
        fill: { color: badgeBg },
        rectRadius: 0.5
    });
    slide.addText(status.toUpperCase(), {
        x: x + 0.7,
        y: y + 0.4,
        w: 0.9,
        h: 0.2,
        fontSize: 7.2,
        fontFace: "Segoe UI",
        color: badgeText,
        bold: true,
        align: "center",
        valign: "middle"
    });

    slide.addText(`Quota: ${quotaUsed}/${quotaMax} Leads`, {
        x: x + 0.15,
        y: y + 0.72,
        w: w - 0.3,
        h: 0.2,
        fontSize: 7.5,
        fontFace: "Segoe UI",
        color: COLORS.textGray
    });

    let barY = y + 0.92;
    let barW = w - 0.3;
    let barH = 0.08;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.15,
        y: barY,
        w: barW,
        h: barH,
        fill: { color: "F1F5F9" },
        rectRadius: 0.5
    });

    let pct = quotaUsed / quotaMax;
    if (pct > 1) pct = 1;
    if (pct > 0) {
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: x + 0.15,
            y: barY,
            w: barW * pct,
            h: barH,
            fill: { color: pct >= 1.0 ? COLORS.crimson : "3B82F6" },
            rectRadius: 0.5
        });
    }
}

// ----------------------------------------------------------------------------
// STYLE 13: Transaction Horizontal Pipeline Steppers
// ----------------------------------------------------------------------------
function drawPipelineStepper(slide, x, y, w, h, activeStepIdx) {
    let steps = ["Nhận Lead thô", "Quan tâm", "Đã gặp", "Đặt cọc", "Thành công"];
    let stepCount = steps.length;
    let stepW = (w - (0.15 * (stepCount - 1))) / stepCount;
    
    steps.forEach((step, idx) => {
        let stepX = x + idx * (stepW + 0.15);
        let isActive = idx === activeStepIdx;
        let isPast = idx < activeStepIdx;
        
        let fillCol = isActive ? COLORS.crimson : (isPast ? "E2E8F0" : COLORS.cardBg);
        let borderCol = isActive ? COLORS.crimson : COLORS.border;
        let textCol = isActive ? COLORS.white : (isPast ? COLORS.textMuted : COLORS.textDark);
        
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: stepX,
            y: y,
            w: stepW,
            h: h,
            fill: { color: fillCol },
            line: { color: borderCol, width: 1 },
            rectRadius: 0.05
        });
        
        slide.addText(step.toUpperCase(), {
            x: stepX + 0.05,
            y: y,
            w: stepW - 0.1,
            h: h,
            fontSize: 7.5,
            fontFace: "Segoe UI",
            color: textCol,
            bold: isActive,
            align: "center",
            valign: "middle"
        });
    });
}

// ----------------------------------------------------------------------------
// NEW STYLE 14: 3-Column Feature Grid Layout
// ----------------------------------------------------------------------------
function addThreeColumnFeatureGrid(slide, x, y, w, h, cols) {
    let colW = (w - 0.6) / 3;
    cols.forEach((col, idx) => {
        let colX = x + idx * (colW + 0.3);
        addCard(slide, colX, y, colW, h, col.title, col.lines, col.isGreen);
    });
}

// ----------------------------------------------------------------------------
// NEW STYLE 15: Full Bleed Stat Header (Top metrics bar, content callback)
// ----------------------------------------------------------------------------
function addFullBleedStatHeader(slide, x, y, w, h, stats, contentFn) {
    let statW = (w - 0.45) / 4;
    stats.forEach((stat, idx) => {
        let statX = x + idx * (statW + 0.15);
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: statX,
            y: y,
            w: statW,
            h: 0.75,
            fill: { color: COLORS.cardBg },
            line: { color: COLORS.border, width: 1 },
            rectRadius: 0.08
        });
        
        slide.addText(stat.val, {
            x: statX + 0.05,
            y: y + 0.08,
            w: statW - 0.1,
            h: 0.35,
            fontSize: 15,
            fontFace: "Segoe UI",
            color: COLORS.crimson,
            bold: true,
            align: "center"
        });
        
        slide.addText(stat.label.toUpperCase(), {
            x: statX + 0.05,
            y: y + 0.42,
            w: statW - 0.1,
            h: 0.25,
            fontSize: 7,
            fontFace: "Segoe UI",
            color: COLORS.textDark,
            bold: true,
            align: "center"
        });
    });
    
    contentFn(slide, x, y + 0.9, w, h - 0.9);
}

// ----------------------------------------------------------------------------
// NEW STYLE 16: Quadrant Card Grid (2x2 equal sized cards)
// ----------------------------------------------------------------------------
function addGridCardQuad(slide, x, y, w, h, cards) {
    let cardW = (w - 0.3) / 2;
    let cardH = (h - 0.3) / 2;
    
    cards.forEach((card, idx) => {
        let col = idx % 2;
        let row = Math.floor(idx / 2);
        let cardX = x + col * (cardW + 0.3);
        let cardY = y + row * (cardH + 0.3);
        
        addCard(slide, cardX, cardY, cardW, cardH, card.title, card.lines, card.isGreen);
    });
}


// ============================================================================
// KHỞI DỰNG CÁC SLIDE TRÌNH CHIẾU KIẾN TRÚC RICH LAND CRM VỚI STYLE DỰNG SẴN
// ============================================================================

// Slide 1: Trang bìa (Full-bleed Brand Red Cover)
let s1 = pptx.addSlide();
s1.background = { color: COLORS.crimson }; 
s1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.2, h: 5.625, fill: { color: COLORS.white } });
s1.addText("RICH LAND CRM SYSTEM ARCHITECTURE", {
    x: 0.8, y: 1.6, w: 8.5, h: 0.4, fontSize: 13, fontFace: "Segoe UI", color: "FFC1C1", bold: true
});
s1.addText("KIẾN TRÚC HỆ THỐNG & LUỒNG HOẠT ĐỘNG LÕI", {
    x: 0.8, y: 2.1, w: 8.5, h: 1.2, fontSize: 32, fontFace: "Segoe UI", color: COLORS.white, bold: true
});
s1.addText("Báo cáo phân tích chuyên sâu về hạ tầng lead, 5 cổng duyệt, quy tắc giao dịch và hàng đợi bất đồng bộ.", {
    x: 0.8, y: 3.4, w: 8.0, h: 0.6, fontSize: 11, fontFace: "Segoe UI", color: "F1F5F9"
});
s1.addText("PHIÊN BẢN HỆ THỐNG V1.9.0", {
    x: 0.8, y: 4.5, w: 8.0, h: 0.3, fontSize: 9, fontFace: "Segoe UI", color: "FFC1C1", bold: true
});

// Slide 2: Mục lục (Crimson Hero Slide)
let s2 = createCrimsonHeroSlide("MỤC LỤC & ĐỊNH HƯỚNG BÁO CÁO", "Sơ đồ chi tiết thiết kế 6 chương phân tích toàn bộ cấu trúc định tuyến API, thuật toán Protection Gates, quy trình thanh toán đặt cọc và DevOps.", "Mục lục");
addCrimsonFeatures(s2, [
    { title: "Cấu trúc 1 & 2", desc: "Hạ tầng định tuyến API, requireAuth, normal roles và cơ chế Protection Gates chia lead." },
    { title: "Cấu trúc 3 & 4", desc: "Quy tắc đặt cọc, đổi căn giao dịch, Meta CAPI và tri thức AI Vector RAG." },
    { title: "Cấu trúc 5 & 6", desc: "Đồng bộ Sheets 2 chiều, chatbot webhooks console và hàng đợi DevOps." }
]);

// Slide 3: Executive Summary (3-Card KPI Dashboard)
let s3 = createBaseSlide("Tóm Tắt Tổng Quan Chỉ Số Hệ Thống", "Tổng quan");
addKpiCard(s3, 0.8, 1.4, 2.7, 3.6, "< 50ms", "Thời gian chia lead", "Lead mới được phân bổ tức thời xuống máy của Sale qua 5 Gate bảo mật trong nháy mắt.");
addKpiCard(s3, 3.85, 1.4, 2.7, 3.6, "99.9 %", "Độ tin cậy hàng đợi", "Các yêu cầu gửi cURL bên thứ ba (Zalo OA, Telegram) được bất đồng bộ hóa 100% tránh nghẽn.");
addKpiCard(s3, 6.9, 1.4, 2.7, 3.6, "100 %", "Vết kiểm toán", "Toàn bộ dòng tiền đặt cọc, đợt thu milestones, thay đổi chủ lead đều được ký số ghi log bảo mật.");

// Slide 4: Client-Server Architecture (Timeline Flow)
let s4 = createBaseSlide("Luồng Kết Nối Kiến Trúc Client - Server", "Kiến trúc");
addTimelineFlow(s4, 0.8, 1.5, 8.8, 3.3, [
    { title: "Vite Frontend React", desc: "SPA gửi yêu cầu API thông qua Axios Client, tự động nạp JWT token bảo mật." },
    { title: "index.php API Router", desc: "Cổng định tuyến Backend duy nhất, xử lý CORS, bắt lỗi và phân loại action." },
    { title: "MariaDB CSDL", desc: "Quản lý truy vấn quan hệ, khóa ngoại bảng ghi và views tương thích ngược." }
]);

// Slide 5: SPA Route Architecture (Split Comparison)
let s5 = createBaseSlide("Cấu Trúc Định Tuyến & Giữ DOM AppTabs", "Kiến trúc");
addSplitComparison(s5, 0.8, 1.4, 8.8, 3.5,
    "Cách định tuyến thông thường",
    ["- Unmount các component khi đổi trang.", "- Mất toàn bộ state, bộ lọc dữ liệu khi chuyển tab.", "- Bắt buộc gọi lại API kéo dữ liệu từ đầu gây trễ mạng."],
    "Giải pháp giữ DOM AppTabs",
    ["- Ẩn/hiện thẻ DOM thay vì gỡ bỏ hoàn toàn.", "- Giữ trọn vẹn state lọc và vị trí cuộn trang của Sale.", "- Giảm tải 80% số lần gọi API tải lại trang không cần thiết."]
);

// Slide 6: Single Entry Point (index.php) (Code Editor mockup)
let s6 = createBaseSlide("Cổng API Router Backend index.php", "Backend");
addCard(s6, 0.8, 1.4, 4.0, 3.6, "Cơ chế Route qua Action", [
    "- Mọi yêu cầu HTTP đổ về tệp backend/index.php duy nhất.",
    "- Phân loại luồng xử lý dựa trên tham số query action.",
    "- Quản lý CORS tập trung, chặn các truy cập ngoài danh sách cho phép."
]);
drawCodeEditorCard(s6, 5.0, 1.4, 4.2, 3.6, "index.php", [
    "<?php",
    "require_once 'bootstrap.php';",
    "$action = $_GET['action'] ?? '';",
    "switch($action) {",
    "  case 'lead_create':",
    "    requireAuth(['sales', 'admin']);",
    "    handleLeadCreate($conn);",
    "    break;",
    "  default:",
    "    sendResponse(404, 'Action not found');",
    "}"
]);

// Slide 7: Authentication Engine (requireAuth) (Code Editor mockup)
let s7 = createBaseSlide("Cơ Chế Xác Thực Người Dùng JWT", "Xác thực");
addCard(s7, 0.8, 1.4, 4.0, 3.6, "requireAuth Middleware", [
    "- Trích xuất Bearer Token từ tiêu đề Authorization.",
    "- Hỗ trợ lấy token từ query string cho các tiến trình kiểm thử nhanh.",
    "- Giải mã cấu trúc token để lấy định danh user và thời gian hết hạn."
]);
drawCodeEditorCard(s7, 5.0, 1.4, 4.2, 3.6, "auth_helper.php", [
    "function requireAuth($allowedRoles = []) {",
    "  $headers = getallheaders();",
    "  $auth = $headers['Authorization'] ?? '';",
    "  $token = str_replace('Bearer ', '', $auth);",
    "  $decoded = JWT::decode($token, SECRET_KEY);",
    "  if (!in_array($decoded->role, $allowedRoles)) {",
    "    sendResponse(403, 'Permission Denied');",
    "  }",
    "  return $decoded;",
    "}"
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

// Slide 9: Multi-Tenant Isolation (3-Column Feature Grid)
let s9 = createBaseSlide("Cô Lập Dữ Liệu Đa Khách Thuê (Multi-Tenant)", "Bảo mật");
addThreeColumnFeatureGrid(s9, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Lọc tenant_id Scoping",
        lines: [
            "- Mọi bảng ghi liên kết KHTN, user, config đều chứa trường tenant_id.",
            "- Backend tự động tiêm clause WHERE tenant_id = ? vào tất cả truy vấn SQL SQL."
        ]
    },
    {
        title: "Ngăn chặn truy cập chéo",
        lines: [
            "- Kiểm duyệt dữ liệu đầu vào chặn đứng hành vi chỉnh sửa param ID chéo tenant.",
            "- Trả lỗi 403 Forbidden ngay lập tức cho các action vi phạm ranh giới."
        ]
    },
    {
        title: "Hạ tầng dùng chung",
        lines: [
            "- Các tenant chia sẻ chung Schema và CSDL MySQL giúp tiết kiệm chi phí.",
            "- Sử dụng chỉ mục để phân tách dữ liệu nhanh chóng mà không cần nhiều CSDL."
        ]
    }
]);

// Slide 10: Tóm tắt phần 1 (Crimson Hero Slide)
let s10 = createCrimsonHeroSlide("KẾT LUẬN CHƯƠNG 1: KIẾN TRÚC & ĐỊNH TUYẾN", "Dựng nền tảng API PHP Router an toàn tuyệt đối với cơ chế bảo mật ba lớp và tăng tốc độ SPA bằng AppTabs giữ nguyên DOM.", "Kiến trúc lõi");
addCrimsonFeatures(s10, [
    { title: "Bảo mật 3 lớp", desc: "Kết hợp CORS whitelist -> requireAuth xác thực JWT -> tenant_id cô lập CSDL tuyệt đối." },
    { title: "AppTabs cache", desc: "Không unmount component, bảo vệ bộ lọc và trạng thái client, tối ưu 80% tài nguyên CPU." },
    { title: "Chuẩn hóa vai", desc: "Tự động dịch role, user_id và full_name để triệt tiêu lỗi Notice PHP làm gãy luồng API." }
]);

// Slide 11: Luồng lead đầu vào (Timeline Flow & Lead Tickets)
let s11 = createBaseSlide("Tiến Trình Xử Lý Lead Đầu Vào", "Chia Lead");
addTimelineFlow(s11, 0.8, 1.4, 8.8, 1.8, [
    { title: "Webhook nhận", desc: "POST lead thô từ Facebook/LP, normalize SĐT." },
    { title: "Persons Check", desc: "Tìm kiếm SĐT cũ, giữ nguyên chủ cũ nếu trùng." },
    { title: "getNext Sale", desc: "Xoay vòng Sale hợp lệ qua Roster ca trực." },
    { title: "Gán lead", desc: "Chuyển trạng thái assigned, đếm ngược 120s." }
]);
drawLeadTicketCard(s11, 0.8, 3.5, 4.2, 1.4, "Nguyễn Văn An", "0912345678", "Facebook Ads", "HOT", "Assigned");
drawLeadTicketCard(s11, 5.4, 3.5, 4.2, 1.4, "Phạm Thị Bình", "0987654321", "Landing Page", "WARM", "Duplicate");

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

// Slide 14: Gate 2: Selfie Check-in (Sale Cards mockup)
let s14 = createBaseSlide("Gate 2: Điểm Danh Selfie & Check-in Ca Trực", "5 Gates");
addCard(s14, 0.8, 1.4, 4.0, 3.6, "Rào chắn Check-in", [
    "- Sale ca trực ngày bắt buộc chụp ảnh selfie check-in approved.",
    "- Chưa approved check-in sẽ bị Gate chặn không nhận lead.",
    "- Tự động bỏ qua check-in với ca trực đêm (night_shift) đã duyệt."
]);
drawSaleProfileCard(s14, 5.0, 1.4, 2.0, 1.7, "Nguyễn Sale A", "Active", 8, 20);
drawSaleProfileCard(s14, 7.2, 1.4, 2.0, 1.7, "Trần Sale B", "Active", 19, 20);
drawSaleProfileCard(s14, 5.0, 3.3, 2.0, 1.7, "Lê Sale C", "Unchecked", 0, 20);
drawSaleProfileCard(s14, 7.2, 3.3, 2.0, 1.7, "Phạm Ca Đêm", "Night Shift", 5, 20);

// Slide 15: Gate 3: Vacation Mode & Status (Sale Cards mockup)
let s15 = createBaseSlide("Gate 3: Trạng Thế Sale & Nghỉ Phép", "5 Gates");
addCard(s15, 0.8, 1.4, 4.0, 3.6, "Vacation Mode & Leave", [
    "- Sale có thể bật chế độ tạm vắng (vacation_mode = 1) trên App.",
    "- Quét bảng leave_schedules tìm các lịch nghỉ phép đã đăng ký.",
    "- Sale vắng mặt hoặc đi gặp khách sẽ được tự động bỏ qua chia lead."
]);
drawSaleProfileCard(s15, 5.0, 1.4, 2.0, 1.7, "Hoàng Sale D", "Vacation", 12, 20);
drawSaleProfileCard(s15, 7.2, 1.4, 2.0, 1.7, "Vũ Sale E", "Leave", 0, 20);
drawSaleProfileCard(s15, 5.0, 3.3, 2.0, 1.7, "Đỗ Sale F", "Active", 4, 20);
drawSaleProfileCard(s15, 7.2, 3.3, 2.0, 1.7, "Mai Sale G", "Active", 15, 20);

// Slide 16: Gate 4: Backpressure Valve (Sale Cards & Lead Ticket mockup)
let s16 = createBaseSlide("Gate 4: Van Chống Ôm Lead (Backpressure)", "5 Gates");
addCard(s16, 0.8, 1.4, 4.0, 3.6, "Ngưỡng găm giữ lead", [
    "- Chặn chia lead nếu Sale giữ quá 5 lead chưa xử lý.",
    "- Thúc đẩy tốc độ tương tác lead dưới 15 phút đầu tiên.",
    "- Phản hồi nhanh giúp tăng 400% tỷ lệ chuyển đổi."
]);
drawSaleProfileCard(s16, 5.0, 1.4, 2.0, 1.7, "Bùi Sale H", "Blocked", 5, 5); 
drawSaleProfileCard(s16, 7.2, 1.4, 2.0, 1.7, "Ngô Sale I", "Active", 2, 5);
drawLeadTicketCard(s16, 5.0, 3.3, 4.2, 1.7, "Lê Hoàng Long", "0909090909", "Campaign A", "HOT", "Unassigned");

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

// Slide 18: Fallback Routing (3-Column Feature Grid)
let s18 = createBaseSlide("Định Tuyến Dự Phòng Khi Bị Chặn Toàn Bộ (Fallback)", "Chia Lead");
addThreeColumnFeatureGrid(s18, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Tình huống gãy luồng",
        lines: [
            "- Toàn bộ các Sale trong danh sách phân bổ đều bị chặn bởi 5 Protection Gates.",
            "- Hoặc hệ thống không phát hiện bất kỳ ca trực online nào hoạt động."
        ]
    },
    {
        title: "Gửi Email khẩn cấp",
        lines: [
            "- Kích hoạt cơ chế gửi thông tin lead thô qua Mailer dự phòng.",
            "- Gửi trực tiếp đến địa chỉ email khẩn cấp được cấu hình trên Campaign."
        ]
    },
    {
        title: "Chuyển tiếp Admin duyệt",
        lines: [
            "- Lead được chuyển trạng thái sang pending_manual.",
            "- Đưa vào hàng đợi Admin để phê duyệt thủ công và phân phối tay."
        ]
    }
]);

// Slide 19: Starvation Prevention (3-Column Feature Grid)
let s19 = createBaseSlide("Cơ Chế Chống Đói Lead Cho Sale Vắng Mặt", "Chia Lead");
addThreeColumnFeatureGrid(s19, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Tích lũy skipped_credit",
        lines: [
            "- Khi Sale vắng mặt (vacation_mode=1) hoặc nghỉ phép.",
            "- Hệ thống đếm số lượt phân bổ bị bỏ lỡ và cộng dồn vào skipped_credit."
        ]
    },
    {
        title: "Kích hoạt ưu tiên bù",
        lines: [
            "- Khi Sale quay lại hoạt động và điểm danh check-in thành công.",
            "- Hệ thống ưu tiên chia lead cho người có skipped_credit cao nhất trước."
        ]
    },
    {
        title: "Đảm bảo công bằng",
        lines: [
            "- Triệt tiêu tình trạng dồn dập lead cho Sale online liên tục.",
            "- Cân bằng cơ hội tiếp cận khách hàng tiềm năng cho cả đội ngũ."
        ]
    }
]);

// Slide 20: Tóm tắt phần 2 (Crimson Hero Slide)
let s20 = createCrimsonHeroSlide("KẾT LUẬN CHƯƠNG 2: 5 CỔNG KIỂM DUYỆT LEAD", "Thiết lập màng lọc thông minh, giám sát tự động độ sẵn sàng và hiệu năng tương tác của Sale để tối ưu hóa tỷ lệ chuyển đổi lead đầu vào.", "Phân phối thông minh");
addCrimsonFeatures(s20, [
    { title: "Selfie check-in", desc: "Ca ngày bắt buộc điểm danh selfie approved đầu ca để nhận lead; ca đêm/lễ duyệt đặc quyền." },
    { title: "Backpressure", desc: "Chốt chặn găm giữ quá 5 lead chưa xử lý, thúc đẩy tương tác phản hồi đầu tiên <15 phút." },
    { title: "Điểm bù credit", desc: "Tích lũy skipped_credit khi Sale đi gặp khách để bù lại lượng lead công bằng khi quay lại." }
]);

// ============================================================================
// PHẦN 3: ĐẶT CỌC & BỂ CỌC & CAPI (SLIDE 21 - 30)
// ============================================================================

// Slide 21: Giao dịch cọc (Pipeline Stepper & Native Line Chart)
let s21 = createBaseSlide("Quy Trình Đặt Cọc & Phê Duyệt Doanh Thu", "Đặt Cọc");
drawPipelineStepper(s21, 0.8, 1.4, 8.8, 0.4, 3); // Active at Đặt cọc
addCard(s21, 0.8, 2.0, 4.0, 3.0, "Thủ tục đặt cọc", [
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
    y: 2.0,
    w: 4.3,
    h: 3.0,
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

// Slide 24: Bể cọc trước doanh thu (Pipeline Stepper & Asymmetric Block)
let s24 = createBaseSlide("Hủy Cọc Khi Chưa Phát Sinh Doanh Thu", "Bể Cọc");
drawPipelineStepper(s24, 0.8, 1.4, 8.8, 0.4, 2); // Active reverts to Đã gặp
addAsymmetricStatBlock(s24, 0.8, 2.0, 8.8, 2.9,
    "Rớt 1 Cấp", "Hạ trạng thái & rớt nhiệt",
    "Trạng thái khách hàng bị hạ về Booking hoặc Đã Gặp. Bắt đầu chạy lại đồng hồ bảo mật 3 tháng.",
    "Lý do xử lý hạ trạng thái",
    [
        "- Công ty chưa thực nhận được bất kỳ dòng tiền thực tế nào từ giao dịch.",
        "- Đảm bảo lead có cơ hội tự động trả về kho dữ liệu chung (Databank) nếu hết hạn, giúp tối ưu nguồn lực Sale khác."
    ]
);

// Slide 25: Bể cọc sau doanh thu (Pipeline Stepper & Asymmetric Block)
let s25 = createBaseSlide("Hủy Cọc Khi Đã Có Doanh Thu Thực Tế", "Bể Cọc");
drawPipelineStepper(s25, 0.8, 1.4, 8.8, 0.4, 3); // Active locked at Đặt cọc
addAsymmetricStatBlock(s25, 0.8, 2.0, 8.8, 2.9,
    "Giữ Nguyên", "Trạng thái đặt cọc được giữ",
    "Person bắt buộc giữ nguyên trạng thái Đặt Cọc/Khách Hàng. Đồng hồ bảo mật bị khóa, lead không bao giờ trả về kho chung.",
    "Lý do xử lý giữ nguyên",
    [
        "- Công ty đã thu được ít nhất một phần phí môi giới (milestone đợt 1 approved).",
        "- Xác nhận đây là một khách hàng thực sự. Giữ nguyên chủ sở hữu để tiếp tục chăm sóc bán căn khác hoặc giữ mối quan hệ."
    ]
);

// Slide 26: Unit Switching (Đổi căn) (Timeline Flow)
let s26 = createBaseSlide("Luồng Nghiệp Vụ Đổi Căn Hộ Giao Dịch", "Đổi Căn");
addTimelineFlow(s26, 0.8, 1.5, 8.8, 3.3, [
    { title: "Đóng phiếu cọc cũ", desc: "Hủy phiếu đặt cọc cũ của căn A, ghi nhận lý do đổi căn và khóa hóa đơn." },
    { title: "Tạo phiếu cọc mới", desc: "Khởi tạo phiếu đặt cọc mới hoàn toàn cho căn B với các milestone mới." },
    { title: "Liên kết audit trail", desc: "Gắn ghi chú 'Đổi từ căn A' ở phiếu mới phục vụ thanh tra tài chính đối soát chéo." }
]);

// Slide 27: Financial Audit Trail (3-Column Feature Grid)
let s27 = createBaseSlide("Hệ Thống Ghi Nhật Ký Kiểm Toán Tài Chính (Audit)", "Audit Trail");
addThreeColumnFeatureGrid(s27, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Nhật ký chỉnh sửa",
        lines: [
            "- Toàn bộ các thao tác chỉnh sửa giá bán, chiết khấu đều được ghi log.",
            "- Lưu lại định danh Sale/Admin và timestamp thực thi chuẩn xác."
        ]
    },
    {
        title: "Đối soát hóa đơn",
        lines: [
            "- Tự động đồng bộ các đợt tiền approved sang bảng kế toán.",
            "- Phát hiện và cảnh báo sai lệch giữa báo cáo Sale và dòng tiền nổi."
        ]
    },
    {
        title: "Khóa sổ dữ liệu",
        lines: [
            "- Chặn đứng hoàn toàn quyền sửa đổi của Sale với phiếu đã duyệt.",
            "- Chỉ có tài khoản Kế toán trưởng được mở khóa điều chỉnh."
        ]
    }
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

// Slide 30: Tóm tắt phần 3 (Crimson Hero Slide)
let s30 = createCrimsonHeroSlide("KẾT LUẬN CHƯƠNG 3: TÀI CHÍNH & CAPI", "Bảo vệ dòng tiền thực thu thông qua kế toán đối soát, vết kiểm toán audit trail và connector trực tiếp Meta Conversion API.", "Tài chính & CAPI");
addCrimsonFeatures(s30, [
    { title: "Bể cọc phân nhánh", desc: "Hủy cọc trước doanh thu hạ cấp trả kho; hủy cọc sau doanh thu giữ nguyên cọc bảo vệ thực thu." },
    { title: "Unit switching", desc: "Hủy cọc cũ và mở cọc mới, gắn định danh link nguồn giữ trọn vẹn vết kiểm toán tài chính." },
    { title: "CAPI forward-only", desc: "Bắn tín hiệu 1 chiều từ CSDL, chặn gửi sự kiện hoàn trả giúp bảo vệ thuật toán học Meta." }
]);

// ============================================================================
// PHẦN 4: AI TRAINING & RAG SYSTEM (SLIDE 31 - 38)
// ============================================================================

// Slide 31: Introduction to AI RAG (Timeline Flow)
let s31 = createBaseSlide("Mô Hiện Tri Thức AI RAG Truy Xuất", "AI RAG");
addTimelineFlow(s31, 0.8, 1.5, 8.8, 3.3, [
    { title: "Nạp tài liệu", desc: "Quản trị viên đưa tài liệu PDF/Web dự án vào CRM qua AITrainingPanel." },
    { title: "Chunking & Vector", desc: "Tách câu theo dấu chấm câu, dùng gemini-embedding-001 sinh vector 768 chiều." },
    { title: "Bộ đệm Cache CSDL", desc: "Lưu trữ vector và text tương ứng vào ai_vector_cache để truy xuất chớp mắt." }
]);

// Slide 32: Vector Embeddings (Asymmetric Stat Block)
let s32 = createBaseSlide("Chỉ Số Bộ Đệm Vector Embeddings Cache", "AI RAG");
addAsymmetricStatBlock(s32, 0.8, 1.4, 8.8, 3.5,
    "90 %", "Tỷ lệ Hit Cache CSDL",
    "Tính mã băm MD5 cho chuỗi văn bản và đối soát trước trong bảng ai_vector_cache. Giảm 90% chi phí gọi API ngoài.",
    "Đặc tính cấu trúc Vector",
    [
        "- Sử dụng vector 768 chiều phản ánh ngữ nghĩa chính xác.",
        "- Thực hiện đối khớp Cosine Similarity trực tiếp bằng hàm PHP với độ trễ <5ms."
    ]
);

// Slide 33: RAG Architecture (Flowchart)
let s33 = createBaseSlide("Luồng Truy Xuất Ngữ Cảnh Tri Thức AI RAG", "AI RAG");
drawFlowStep(s33, 0.8, 1.8, 2.5, 2.5, "1", "Câu hỏi mới", "Người dùng nhập câu hỏi hoặc ghi chú lead mới đổ về hệ thống.");
drawFlowStep(s33, 3.65, 1.8, 2.5, 2.5, "2", "Cosine Match", "Đối soát tương đồng ngữ nghĩa trong PHP để tìm 3 đoạn tri thức phù hợp nhất.");
drawFlowStep(s33, 6.5, 1.8, 2.5, 2.5, "3", "LLM Answer", "Nhúng tri thức làm ngữ cảnh và gửi Gemini tạo câu trả lời chuẩn xác.", true);

// Slide 34: Semantic Search vs Keyword Matching (Split Comparison)
let s34 = createBaseSlide("Tìm Kiếm Ngữ Nghĩa vs Từ Khóa Truyền Thống", "AI RAG");
addSplitComparison(s34, 0.8, 1.4, 8.8, 3.5,
    "Tìm kiếm từ khóa truyền thống",
    ["- Khớp ký tự chính xác. Bỏ sót từ đồng nghĩa (ví dụ: chung cư vs căn hộ).", "- Sai lệch khi người dùng gõ sai chính tả nhẹ.", "- Trả về kết quả trống rỗng khi không trùng từ khóa."],
    "Tìm kiếm ngữ nghĩa (Vector Search)",
    ["- Đối soát khoảng cách vector, hiểu ý nghĩa ẩn sau câu chữ.", "- Khắc phục hoàn toàn lỗi viết tắt hoặc viết sai chính tả nhẹ.", "- Trích xuất chính xác ngữ cảnh phục vụ LLM sinh câu trả lời."]
);

// Slide 35: AI Training Interface (3-Column Feature Grid)
let s35 = createBaseSlide("Giao Diện Admin Huấn Luyện AI (Training Panel)", "AI RAG");
addThreeColumnFeatureGrid(s35, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Tài liệu đầu vào",
        lines: [
            "- Hỗ trợ upload tệp tri thức PDF, Docx và liên kết website dự án.",
            "- Quản lý phân loại tri thức theo dự án và khu vực địa lý."
        ]
    },
    {
        title: "Giám sát Chunking",
        lines: [
            "- Chia nhỏ văn bản theo ranh giới câu thông minh để giữ ngữ cảnh.",
            "- In danh sách các đoạn text kèm mã băm MD5."
        ]
    },
    {
        title: "Sandbox kiểm thử",
        lines: [
            "- Cung cấp bảng test trực tuyến, nhập câu hỏi chẩn đoán chớp mắt.",
            "- Hiển thị điểm số tương đồng Cosine của các đoạn tri thức."
        ]
    }
]);

// Slide 36: Screening Logic & Decisions (Lead Tickets mockup)
let s36 = createBaseSlide("Logic Sàng Lọc Lead Tự Động Bằng AI", "AI RAG");
addCard(s36, 0.8, 1.4, 4.0, 3.6, "Quyết định của AI", [
    "- AI đọc ghi chú tương tác ban đầu của lead.",
    "- Chấm điểm độ tự tin (Confidence Score) từ 0 đến 100%.",
    "- Tự động dán nhãn SPAM hoặc VALID dựa trên tri thức dự án."
]);
drawLeadTicketCard(s36, 5.0, 1.4, 4.2, 1.7, "Spam User A", "0900000000", "Meta Ads", "SPAM", "Flagged by AI");
drawLeadTicketCard(s36, 5.0, 3.3, 4.2, 1.7, "Lê Minh Triết", "0911222333", "Google Forms", "VALID", "Valid Lead");

// Slide 37: AI Error Fallbacks (Quadrant Card Grid)
let s37 = createBaseSlide("Cơ Chế Dự Phòng Lỗi Khi Gọi AI (Retry)", "AI RAG");
addGridCardQuad(s37, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Lỗi Rate Limit",
        lines: ["- Gặp lỗi 429 khi gọi API quá tải.", "- Hệ thống tự động hoãn (backoff) và thử lại sau 2 giây."]
    },
    {
        title: "Lỗi cấu trúc JSON",
        lines: ["- Phản hồi từ LLM bị gãy cấu trúc JSON.", "- Gọi phân tích lại, ép kiểu đầu ra qua JSON Schema."]
    },
    {
        title: "Lỗi mất mạng",
        lines: ["- Đứt kết nối đến server API Gemini.", "- Thử lại tối đa 3 lần trước khi đánh dấu lỗi."]
    },
    {
        title: "Duyệt thủ công",
        lines: ["- Nếu thử lại 3 lần vẫn hỏng.", "- Đẩy lead vào hàng đợi chờ Admin duyệt tay an toàn."]
    }
]);

// Slide 38: Tóm tắt phần 4 (Crimson Hero Slide)
let s38 = createCrimsonHeroSlide("KẾT LUẬN CHƯƠNG 4: HỆ THỐNG TRÍ TUỆ RAG", "Nạp tri thức tài liệu dự án, số hóa thông tin căn hộ thông qua Vector Embeddings và thuật toán tìm kiếm tương đồng ngữ nghĩa trong PHP.", "Trí tuệ RAG");
addCrimsonFeatures(s38, [
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

// Slide 40: Real-Time Webhook Receivers (Full Bleed Stat Header & Card)
let s40 = createBaseSlide("Tiếp Nhận Webhook Tức Thời Đầu Vào", "Liên kết");
addFullBleedStatHeader(s40, 0.8, 1.4, 8.8, 3.6, [
    { val: "POST", label: "HTTP Method" },
    { val: "JSON", label: "Payload Format" },
    { val: "200 OK", label: "Response Code" },
    { val: "< 20ms", label: "Queue Latency" }
], (slide, x, y, w, h) => {
    addCard(slide, x, y, w, h, "Cổng tiếp nhận webhook thô", [
        "- Nhận POST payload trực tiếp từ Facebook Ads Webhook hoặc Landing Page.",
        "- Ghi nhận ngay lập tức vào bảng leads thô để đảm bảo an toàn vết giao dịch.",
        "- Phản hồi mã HTTP 200 cực nhanh để tránh nghẽn luồng từ Meta Ads."
    ]);
});

// Slide 41: Two-Way Sync Conflict Resolution (Flowchart)
let s41 = createBaseSlide("Đối Soát Chống Lặp Đồng Bộ Hai Chiều", "Liên kết");
drawFlowStep(s41, 0.8, 1.8, 2.5, 2.5, "1", "Tính mã băm SHA256", "Tính mã băm cho dữ liệu mỗi dòng trên Google Sheets.");
drawFlowStep(s41, 3.65, 1.8, 2.5, 2.5, "2", "So sánh đối soát", "Lưu hash vào sheet_sync_records, chỉ đồng bộ nếu hash mới khác hash cũ.");
drawFlowStep(s41, 6.5, 1.8, 2.5, 2.5, "3", "Chống lặp vô hạn", "Bỏ qua các dòng chỉnh sửa sinh ra từ chính CRM cập nhật lên.", true);

// Slide 42: Chat App Command Centers (3-Column Feature Grid)
let s42 = createBaseSlide("Mô Hình Trung Tâm Điều Khiển Chatbot", "Điều khiển");
addThreeColumnFeatureGrid(s42, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Telegram Bot API",
        lines: [
            "- Kết nối trực tiếp máy chủ Telegram.",
            "- Lắng nghe tin nhắn nhóm quản trị qua Webhook bảo mật."
        ]
    },
    {
        title: "Zalo OA Webhook",
        lines: [
            "- Nhận sự kiện trò chuyện từ người dùng Zalo OA.",
            "- Xác minh chữ ký số số hóa từ Zalo OA gửi về."
        ]
    },
    {
        title: "Bảo mật Chat ID",
        lines: [
            "- Chỉ nhận và thực thi tin nhắn đến từ các ID chat đã whitelist.",
            "- Chặn đứng hoàn toàn hành vi gửi lệnh phá hoại từ bên ngoài."
        ]
    }
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

// Slide 46: Tóm tắt phần 5 (Crimson Hero Slide)
let s46 = createCrimsonHeroSlide("KẾT LUẬN CHƯƠNG 5: ĐỒNG BỘ & TRUNG TÂM LỆNH CHAT", "Tích hợp đa kênh thời gian thực thông qua đồng bộ bảng tính Google Sheets và bảng lệnh Chatbot Webhooks điều khiển quản trị trên Telegram/Zalo di động.", "Liên kết & Điều khiển");
addCrimsonFeatures(s46, [
    { title: "Mutex lock & hash", desc: "Khóa tệp cron_sync.lock và so khớp SHA256 chống lặp ghi đè vô hạn giữa CRM và Sheets." },
    { title: "Webhook instant", desc: "Tiếp nhận thô và phân loại ngầm lead thô LP/Meta trong <20ms, chặn đứng tỷ lệ trôi thất thoát lead." },
    { title: "Chat command console", desc: "Tập lệnh slash commands bảo mật token URL giúp Manager duyệt nhanh cọc/check-in trên di động." }
]);

// ============================================================================
// PHẦN 6: HÀNG ĐỢI BẤT ĐỒNG BỘ & DEVOPS (SLIDE 47 - 60)
// ============================================================================

// Slide 47: Bottleneck Analysis (Split Comparison)
let s47 = createBaseSlide("Tách nghẽn: Giao Tiếp Đồng Bộ vs Hàng Đợi", "Hàng Đợi");
addSplitComparison(s47, 0.8, 1.4, 8.8, 3.5,
    "Cách gọi API đồng bộ truyền thống",
    ["- Bắt tiến trình PHP chờ phản hồi HTTP từ server Zalo/Telegram.", "- Thời gian load trang bị kéo dài >5s, dễ timeout mất dữ liệu.", "- Cản trở luồng chính, gây thắt nút cổ chai khi lead đổ về nhiều."],
    "Giải pháp Hàng đợi bất đồng bộ",
    ["- Lưu payload tin nhắn vào CSDL zalo_queue/telegram_queue.", "- Trả kết quả JSON cho đối tác ngay lập tức trong <20ms.", "- Worker chạy ngầm độc lập gửi tin và tự động thử lại nếu lỗi."]
);

// Slide 48: Asynchronous Messaging (Flowchart)
let s48 = createBaseSlide("Mô Hiện Hàng Đợi Bất Đồng Bộ Hóa", "Hàng Đợi");
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

// Slide 52: Background Queue Worker (3-Column Feature Grid)
let s52 = createBaseSlide("Cơ Chế Vận Hành Hàng Đợi Chạy Ngầm (Worker)", "Hàng Đợi");
addThreeColumnFeatureGrid(s52, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Quét cron định kỳ",
        lines: [
            "- Được thiết lập chạy ngầm liên tục mỗi phút để xử lý queue.",
            "- Giới hạn batch size mỗi lần quét để bảo vệ tài nguyên CPU."
        ]
    },
    {
        title: "Tự động Retry lỗi",
        lines: [
            "- Thử lại tối đa 3 lần khi tin nhắn gặp lỗi ngắt mạng.",
            "- Tự động giãn cách thời gian giữa các lần thử để tăng tỷ lệ gửi."
        ]
    },
    {
        title: "Purge & Dọn dẹp log",
        lines: [
            "- Tự động purge dọn dẹp các bản ghi sent/failed đã lưu trên 30 ngày.",
            "- Tối ưu bộ nhớ bảng ghi giúp CSDL Staging không bị phình to."
        ]
    }
]);

// Slide 53: Real-time Lead Countdown (Asymmetric Stat Block & Lead Ticket)
let s53 = createBaseSlide("Đồng Hồ Bảo Mật & Phản Hồi Real-Time", "Hàng Đợi");
addAsymmetricStatBlock(s53, 0.8, 1.4, 8.8, 3.5,
    "120s", "Thời gian phản hồi khẩn cấp",
    "Đồng hồ đếm ngược kích hoạt ngay khi tin nhắn báo lead gửi thành công ngầm. Bắt buộc Sale phải click nhận trong 2p.",
    "Cơ chế bảo vệ thời gian",
    [
        "- Loại bỏ hoàn toàn sai lệch thời gian do trễ kết nối mạng gọi API ngoài.",
        "- Nếu quá 120s không tương tác, cron tự động thu hồi (Recall) và chuyển lead cho Sale tiếp theo."
    ]
);

// Slide 54: The Testing Harness (Quadrant Card Grid)
let s54 = createBaseSlide("Bản Đồ Thành Phần Khung Kiểm Thử Tích Hợp", "DevOps");
addGridCardQuad(s54, 0.8, 1.4, 8.8, 3.6, [
    {
        title: "Khởi tạo môi trường CSDL",
        lines: ["- test_bootstrap.php chuẩn bị sẵn kết nối $conn & $pdo.", "- Giúp chạy test tức thì mà không cần khai báo lại database."]
    },
    {
        title: "Nạp sẵn hàm kiểm thử",
        lines: ["- Tích hợp bộ hàm chẩn đoán: assertTest(), assertDbField().", "- Xuất báo cáo tóm tắt tổng số ca pass/fail ở cuối trang."]
    },
    {
        title: "Kiểm thử logic chia lead",
        lines: ["- test_rotation_audit.php mô phỏng roster, check-in, vacation.", "- Tự động khôi phục lại trạng thái cũ sau khi hoàn tất test."]
    },
    {
        title: "Quét cú pháp SQL",
        lines: ["- Quét tĩnh các tệp tin backend để tìm câu lệnh không an toàn.", "- Chặn đứng lỗi cú pháp truy vấn trước khi deploy lên staging."]
    }
]);

// Slide 55: Unified Testing Environment (Full Bleed Stat Header & Code Editor)
let s55 = createBaseSlide("Môi Trường Kiểm Thử Nhất Quán", "DevOps");
addFullBleedStatHeader(s55, 0.8, 1.4, 8.8, 3.6, [
    { val: "$conn", label: "MySQLi Global" },
    { val: "$pdo", label: "PDO Global" },
    { val: "Mock Sale", label: "CSDL Row Mock" },
    { val: "Auto rollback", label: "DB Transactions" }
], (slide, x, y, w, h) => {
    drawCodeEditorCard(slide, x, y, w, h, "test_rotation_audit.php", [
        "require_once __DIR__ . '/test_bootstrap.php';",
        "try {",
        "  $conn->begin_transaction();",
        "  $testLeadId = mockCreateLead($conn);",
        "  $saleId = getNextConsultantInRound($conn, $testLeadId);",
        "  assertTest($saleId > 0, 'getNextConsultant returned valid Sale ID');",
        "  assertDbField($conn, 'leads', 'id', $testLeadId, 'status', 'assigned');",
        "} finally {",
        "  $conn->rollback(); // Clean data after test",
        "}"
    ]);
});

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

// Slide 57: Staging Database Verification (Full Bleed Stat Header & Table)
let s57 = createBaseSlide("Đối Soát Cấu Trúc Cơ Sở Dữ Liệu Staging", "DevOps");
addFullBleedStatHeader(s57, 0.8, 1.4, 8.8, 3.6, [
    { val: "exec_db_query", label: "Cổng truy vấn" },
    { val: "Rule 8 Check", label: "Đối soát từ xa" },
    { val: "unified_schema", label: "Schema master file" },
    { val: "0% Schema error", label: "Mức sai sót" },
], (slide, x, y, w, h) => {
    addGridTable(slide, x, y, w, h,
        ["Nhiệm vụ đối soát", "Công cụ thực thi", "Mô tả hành động", "Ràng buộc nghiệp vụ"],
        [
            ["Quét schema Staging", "exec_db_query.php", "Quét trực tiếp cấu trúc bảng thực tế từ xa", "Chạy trước khi deploy code"],
            ["Kiểm tra kiểu dữ liệu", "test_bootstrap.php", "So khớp kiểu dữ liệu và độ dài cột", "Không có sai lệch"],
            ["Khóa ngoại constraints", "MySQL query schema", "Xác thực khóa ngoại bảng cọc và queue", "Duy trì tính toàn vẹn"]
        ]
    );
});

// Slide 58: Static Query Scan (Code Editor mockup)
let s58 = createBaseSlide("Quét Lỗi Cú Pháp Truy Vấn Tĩnh", "DevOps");
addCard(s58, 0.8, 1.4, 4.0, 3.6, "Công cụ quét SQL Scan", [
    "- Tự động quét toàn bộ mã nguồn PHP để tìm kiếm các từ khóa SQL không hợp lệ.",
    "- Phát hiện các câu lệnh không tương thích với cấu hình chế độ MariaDB Staging.",
    "- Tìm ra các truy vấn SQL viết sai cú pháp trước khi chạy thực tế."
]);
drawCodeEditorCard(s58, 5.0, 1.4, 4.2, 3.6, "sql_scanner.php", [
    "$sql = \"SELECT * FROM consultants WHERE status = '$status'\";",
    "// [WARNING] SQL injection hazard detected!",
    "// Correct usage:",
    "$stmt = $pdo->prepare('SELECT * FROM consultants WHERE status = ?');",
    "$stmt->execute([$status]);",
    "$res = $stmt->fetchAll();"
]);

// Slide 59: Git Integration & Deployment (Timeline Flow)
let s59 = createBaseSlide("Quy Trình Triển Khai Deploy Song Song", "DevOps");
addTimelineFlow(s59, 0.8, 1.5, 8.8, 3.3, [
    { title: "Kích hoạt Deploy", desc: "Manager gõ lệnh deploy chính thức, khởi chạy script build backend." },
    { title: "Nâng cấp Staging", desc: "Build code mới lên server Staging, chạy lệnh di chuyển schema database tự động." },
    { title: "Git Commit & Push", desc: "Thực hiện add, commit và push lên main branch đồng bộ mã nguồn gốc." }
]);

// Slide 60: Conclusion & Roadmap (Crimson Hero Slide)
let s60 = createCrimsonHeroSlide("LỘ TRÌNH PHÁT TRIỂN & NÂNG CẤP HỆ THỐNG", "Kế hoạch nâng cấp và mở rộng khả năng tối ưu hóa chuyển đổi, tương tác tự động ở quy mô lớn cho Rich Land CRM.", "Roadmap");
addCrimsonFeatures(s60, [
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
        if (err.code === 'EBUSY') {
            console.warn("⚠️ File chính bị khóa. Đang lưu sang file dự phòng v2...");
            pptx.writeFile({ fileName: "RichLand_System_Architecture_Presentation_v2.pptx" })
                .then(fileName => {
                    console.log(`\n=================================================`);
                    console.log(`✅ THÀNH CÔNG (DỰ PHÒNG): Đã tạo file ${fileName}`);
                    console.log(`=================================================`);
                })
                .catch(err2 => {
                    console.error("❌ LỖI NGHIÊM TRỌNG KHI XUẤT FILE:", err2);
                });
        } else {
            console.error("❌ LỖI KHI XUẤT FILE:", err);
        }
    });
