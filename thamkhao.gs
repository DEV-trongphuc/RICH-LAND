function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var type = data.type || "unknown";
    var email = data.email || "";
    var name = data.name || "Quý khách";
    var slug = data.slug || "";
    
    // Ghi dữ liệu vào sheet "meta"
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("meta");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("meta");
      sheet.appendRow(["Timestamp", "Type", "Email", "Name", "Slug", "Extra Info"]);
    }
    sheet.appendRow([new Date(), type, email, name, slug, JSON.stringify(data)]);
    
    // Gửi email dựa trên loại
    if(email) {
      if (type === "register") {
        sendTrialEmail(email, name, slug, data.expires_at);
      } else if (type === "renewal") {
        sendRenewalRequestEmail(email, name, slug, data.plan);
      } else if (type === "upgrade") {
        sendUpgradeSuccessEmail(email, name, slug, data.expires_at, data.add_days);
      } else if (type === "invite") {
        sendInvitationEmail(email, data.inviter_email, slug, data.role);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Đã xử lý email" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("OK");
}

function _getBaseHtml(title, subtitle, contentHtml) {
  return `
  <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f5f9; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 20px; text-align: center;">
          <img src="https://domation.vercel.app/imgs/ICON.png" alt="DOMATION" style="width: 60px; height: 60px; object-fit: contain; margin: 0 auto 12px; display: block;" />
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 900; letter-spacing: 2px; text-align: center;">DOMATION</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 8px 0 0; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">Hệ Thống Dashboard Meta Ads Report</p>
      </div>
      <!-- Content -->
      <div style="padding: 40px 30px;">
          <h2 style="color: #0f172a; font-size: 22px; margin-top: 0; margin-bottom: 24px;">${title}</h2>
          ${contentHtml}
      </div>
      <!-- Footer -->
      <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
              © 2026 Domation Ecosystem. All rights reserved.<br/>
              Email này được gửi tự động từ hệ thống quản trị DOMATION.
          </p>
      </div>
  </div>
  `;
}

function sendTrialEmail(recipient, name, slug, expiresAt) {
  var subject = "DOMATION - Cảm ơn bạn đã đăng ký sử dụng hệ thống báo cáo!";
  var content = `
    <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
        Chào <strong>${name}</strong>,<br><br>
        Cảm ơn Quý khách đã tin tưởng và đăng ký trải nghiệm nền tảng báo cáo tự động <strong>DOMATION</strong>. Hệ thống đã thiết lập thành công Workspace của bạn.
    </p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
        <p style="color: #0f172a; font-size: 16px; margin: 0 0 10px 0; font-weight: bold; line-height: 1.6;">
            Thông tin Workspace:
        </p>
        <ul style="color: #334155; font-size: 15px; margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>ID/Slug: <strong style="color: #0f172a;">${slug}</strong></li>
            <li>Đường dẫn: <a href="https://meta.domation.net/${slug}" style="color: #2563eb; text-decoration: none;">https://meta.domation.net/${slug}</a></li>
            <li>Hết hạn vào: <strong style="color: #ef4444;">${expiresAt}</strong></li>
        </ul>
    </div>
    
    <p style="color: #64748b; font-size: 15px; line-height: 1.7;">
        Quý khách đang trong thời gian dùng thử hệ thống. Hãy xem xét nâng cấp lên gói trả phí để có thể tiếp tục truy cập và sử dụng lâu dài, tránh bị gián đoạn dữ liệu báo cáo.
    </p>
    
    <div style="text-align: center; margin-top: 40px;">
        <a href="https://meta.domation.net/${slug}" target="_blank" style="background-color: #f59e0b; background-image: linear-gradient(to right, #f59e0b, #ea580c); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(245,158,11,0.3);">
            Truy Cập Workspace Của Bạn
        </a>
    </div>
  `;
  
  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: _getBaseHtml("Kính chào Quý khách,", "", content),
    name: "DOMATION TEAM"
  });
}

function sendRenewalRequestEmail(recipient, name, slug, plan) {
  var subject = "DOMATION - Xác nhận yêu cầu gia hạn gói dịch vụ";
  var planName = plan === "1_year" ? "Gói 1 Năm" : "Gói 1 Tháng";
  
  var content = `
    <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
        Chào <strong>${name}</strong>,<br><br>
        Hệ thống đã ghi nhận yêu cầu đăng ký / gia hạn gói dịch vụ từ Workspace <strong>${slug}</strong>.
    </p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; margin: 30px 0; border-radius: 12px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 10px 0; line-height: 1.6;">
            Gói dịch vụ yêu cầu: <strong style="color: #0284c7; font-size: 18px;">${planName}</strong>
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.6; font-style: italic;">
            "Admin của DOMATION sẽ sớm liên hệ với bạn qua số Zalo bạn đã cung cấp để hướng dẫn thanh toán và kích hoạt gói ngay lập tức."
        </p>
    </div>
    
    <p style="color: #64748b; font-size: 15px; line-height: 1.7;">
        Cảm ơn bạn đã luôn tin tưởng và đồng hành cùng hệ thống báo cáo tự động của chúng tôi. Nếu có thắc mắc gấp, vui lòng phản hồi lại email này.
    </p>
  `;
  
  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: _getBaseHtml("Kính chào Quý khách,", "", content),
    name: "DOMATION ADMIN"
  });
}

function sendUpgradeSuccessEmail(recipient, name, slug, expiresAt, addDays) {
  var subject = "DOMATION - Gia hạn dịch vụ thành công!";
  var durationStr = addDays >= 365 ? "1 năm" : (addDays == 30 ? "1 tháng" : (addDays + " ngày"));
  
  var content = `
    <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
        Chào <strong>${name}</strong>,<br><br>
        Tin vui cho bạn! Admin hệ thống vừa xử lý thành công yêu cầu nâng cấp gói dịch vụ cho Workspace <strong>${slug}</strong> của bạn.
    </p>
    
    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
        <h3 style="color: #065f46; font-size: 18px; margin: 0 0 15px 0;">Thông tin gia hạn:</h3>
        <ul style="color: #047857; font-size: 15px; margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>Thời gian cộng thêm: <strong style="color: #064e3b;">${durationStr}</strong></li>
            <li>Trạng thái tài khoản: <strong style="color: #059669;">ĐÃ KÍCH HOẠT (ACTIVE)</strong></li>
            <li>Hạn sử dụng mới: <strong style="color: #064e3b;">${expiresAt}</strong></li>
        </ul>
    </div>
    
    <p style="color: #64748b; font-size: 15px; line-height: 1.7;">
        Bây giờ hệ thống của bạn sẽ hoạt động hoàn toàn bình thường. Mọi luồng dữ liệu API từ Meta sẽ tiếp tục được lấy và tự động hóa hàng ngày.
    </p>
    
    <div style="text-align: center; margin-top: 40px;">
        <a href="https://meta.domation.net/${slug}" target="_blank" style="background-color: #10b981; background-image: linear-gradient(to right, #34d399, #059669); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(16,185,129,0.3);">
            Vào Trang Quản Trị Của Bạn
        </a>
    </div>
  `;
  
  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: _getBaseHtml("Kính chào Quý khách,", "", content),
    name: "DOMATION TEAM"
  });
}

function sendInvitationEmail(recipient, inviterEmail, slug, role) {
  var subject = "DOMATION - Bạn được mời tham gia Workspace";
  var username = recipient.split('@')[0];
  var roleLabel = "Thành viên / Viewer";
  if (role === "admin") {
    roleLabel = "Quản trị viên / Admin";
  } else if (role === "editor") {
    roleLabel = "Biên tập viên / Editor";
  }
  
  var content = `
    <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
        Chào <strong>${username}</strong>,<br><br>
        Admin <strong>${inviterEmail}</strong> vừa gửi lời mời bạn tham gia vào Workspace <strong>${slug}</strong> trên hệ thống báo cáo tự động DOMATION.
    </p>
    
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 24px; margin: 30px 0; border-radius: 0 12px 12px 0;">
        <p style="color: #92400e; font-size: 16px; margin: 0 0 10px 0; font-weight: bold; line-height: 1.6;">
            Bạn đã được cấp quyền truy cập để xem dữ liệu báo cáo:
        </p>
        <ul style="color: #b45309; font-size: 15px; margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>ID Workspace: <strong style="color: #78350f;">${slug}</strong></li>
            <li>Đường dẫn truy cập: <a href="https://meta.domation.net/${slug}" style="color: #ea580c; text-decoration: none;">https://meta.domation.net/${slug}</a></li>
            <li>Vai trò: <strong style="color: #78350f;">${roleLabel}</strong></li>
        </ul>
    </div>
    
    <p style="color: #64748b; font-size: 15px; line-height: 1.7;">
        Truy cập ngay vào đường dẫn bên dưới để xem báo cáo Realtime từ nền tảng Meta Ads. Đừng quên đăng nhập bằng tài khoản Google (email này) để hệ thống nhận diện bạn nhé.
    </p>
    
    <div style="text-align: center; margin-top: 40px;">
        <a href="https://meta.domation.net/${slug}" target="_blank" style="background-color: #f59e0b; background-image: linear-gradient(to right, #f59e0b, #ea580c); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(245,158,11,0.3);">
            Truy Cập Workspace
        </a>
    </div>
  `;
  
  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: _getBaseHtml(`Kính chào ${username},`, "", content),
    name: "DOMATION TEAM"
  });
}