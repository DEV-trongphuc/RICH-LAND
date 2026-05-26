/**
 * DOMATION CRM - Google Apps Script Two-Way Synchronization Script
 * 
 * HƯỚNG DẪN CẤU HÌNH:
 * 1. Mở trang Google Sheet của bạn.
 * 2. Vào Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa mọi mã nguồn cũ và dán toàn bộ đoạn mã này vào.
 * 4. Nhấn nút "Triển khai" (Deploy) ở góc phải trên -> "Triển khai mới" (New deployment).
 * 5. Chọn loại triển khai là "Ứng dụng web" (Web app).
 * 6. Cấu hình cấu hình ứng dụng web:
 *    - Thực thi dưới danh nghĩa: "Tôi" (Me / tài khoản Google của bạn).
 *    - Ai có quyền truy cập: "Mọi người" (Anyone - Bắt buộc để CRM có thể kết nối).
 * 7. Nhấn "Triển khai" (Deploy), cấp quyền truy cập nếu Google yêu cầu.
 * 8. Copy đường dẫn "URL ứng dụng web" (Web app URL) nhận được.
 * 9. Dán URL này vào thiết lập Kết nối Sheets trong CRM (nút Sửa -> bật Đồng bộ 2 chiều hoặc trang Đồng bộ 2 chiều Tổng).
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "Yêu cầu không chứa dữ liệu" });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet_name || "";
    
    var searchColPhone = payload.search_col_phone || "";
    var searchValPhone = payload.search_val_phone ? normalizePhone(payload.search_val_phone) : "";
    
    var searchColEmail = payload.search_col_email || "";
    var searchValEmail = payload.search_val_email ? payload.search_val_email.trim().toLowerCase() : "";
    
    var allowInsert = payload.allow_insert === true;
    var updates = payload.updates || {};
    
    if (!searchValPhone && !searchValEmail) {
      return createJsonResponse({ status: "error", message: "Thiếu thông tin khóa tìm kiếm (SĐT hoặc Email)" });
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet;
    
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
    }
    if (!sheet) {
      sheet = ss.getSheets()[0]; // Lấy sheet đầu tiên nếu không khớp tên
    }
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Không tìm thấy Sheet phù hợp" });
    }
    
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    
    // Nếu sheet hoàn toàn trống
    if (lastRow < 1 || lastColumn < 1) {
      // Viết hàng tiêu đề mặc định
      var defaultHeaders = ["Thời gian", "Nguồn", "Vòng", "Sale phụ trách", "Họ tên", "Số điện thoại", "Email", "Ghi chú", "Trạng thái"];
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      SpreadsheetApp.flush();
      lastRow = 1;
      lastColumn = defaultHeaders.length;
    }
    
    // Đọc hàng tiêu đề (Headers)
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    
    // Tìm vị trí cột khóa SĐT và Email
    var colPhoneIdx = -1;
    var colEmailIdx = -1;
    var columnIndexes = {};
    
    for (var i = 0; i < headers.length; i++) {
      var headerName = (headers[i] || "").toString().trim();
      columnIndexes[headerName] = i + 1; // 1-based index
      
      if (searchColPhone && headerName.toLowerCase() === searchColPhone.toLowerCase()) {
        colPhoneIdx = i + 1;
      }
      if (searchColEmail && headerName.toLowerCase() === searchColEmail.toLowerCase()) {
        colEmailIdx = i + 1;
      }
    }
    
    // Nếu tiêu đề tìm kiếm chưa tồn tại, tự động thêm vào cột mới
    if (colPhoneIdx === -1 && searchColPhone) {
      lastColumn++;
      sheet.getRange(1, lastColumn).setValue(searchColPhone);
      headers.push(searchColPhone);
      columnIndexes[searchColPhone] = lastColumn;
      colPhoneIdx = lastColumn;
    }
    if (colEmailIdx === -1 && searchColEmail) {
      lastColumn++;
      sheet.getRange(1, lastColumn).setValue(searchColEmail);
      headers.push(searchColEmail);
      columnIndexes[searchColEmail] = lastColumn;
      colEmailIdx = lastColumn;
    }
    
    // Kiểm tra xem tất cả các cột trong `updates` có tiêu đề chưa, nếu chưa thì thêm mới
    for (var colName in updates) {
      if (!columnIndexes[colName]) {
        lastColumn++;
        sheet.getRange(1, lastColumn).setValue(colName);
        headers.push(colName);
        columnIndexes[colName] = lastColumn;
      }
    }
    
    // Đọc toàn bộ dữ liệu để tìm kiếm (nếu có dữ liệu dòng 2 trở đi)
    var targetRowIndex = -1; // 2-based index thực tế trên Sheet
    if (lastRow >= 2) {
      var dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
      var rows = dataRange.getValues();
      
      for (var r = 0; r < rows.length; r++) {
        var currentRow = rows[r];
        var matched = false;
        
        // So khớp số điện thoại
        if (colPhoneIdx > 0 && searchValPhone) {
          var cellPhone = normalizePhone(currentRow[colPhoneIdx - 1]);
          if (cellPhone && cellPhone === searchValPhone) {
            matched = true;
          }
        }
        
        // So khớp email nếu số điện thoại chưa khớp hoặc bị thiếu
        if (!matched && colEmailIdx > 0 && searchValEmail) {
          var cellEmail = (currentRow[colEmailIdx - 1] || "").toString().trim().toLowerCase();
          if (cellEmail && cellEmail === searchValEmail) {
            matched = true;
          }
        }
        
        if (matched) {
          targetRowIndex = r + 2; // +2 vì index trong mảng là 0-based và bỏ qua header
          break; // Chỉ cập nhật dòng đầu tiên tìm thấy
        }
      }
    }
    
    var isNewRow = false;
    if (targetRowIndex === -1) {
      if (!allowInsert) {
        return createJsonResponse({ 
          status: "error", 
          message: "Không tìm thấy dòng tương ứng với SĐT: " + searchValPhone + " hoặc Email: " + searchValEmail 
        });
      } else {
        targetRowIndex = lastRow + 1;
        isNewRow = true;
      }
    }
    
    // Đọc dòng hiện tại hoặc khởi tạo dòng mới
    var rowValues = [];
    if (isNewRow) {
      for (var k = 0; k < lastColumn; k++) {
        rowValues.push("");
      }
      // Gán sẵn các khóa tìm kiếm cho dòng mới
      if (colPhoneIdx > 0 && searchValPhone) {
        rowValues[colPhoneIdx - 1] = payload.search_val_phone; // Giữ nguyên định dạng gốc của SĐT
      }
      if (colEmailIdx > 0 && searchValEmail) {
        rowValues[colEmailIdx - 1] = payload.search_val_email;
      }
    } else {
      rowValues = sheet.getRange(targetRowIndex, 1, 1, lastColumn).getValues()[0];
    }
    
    // Cập nhật các cột được chỉ định vào mảng
    var updateCount = 0;
    for (var colName in updates) {
      var colIdx = columnIndexes[colName];
      if (colIdx) {
        rowValues[colIdx - 1] = updates[colName];
        updateCount++;
      }
    }
    
    // Ghi toàn bộ dòng dữ liệu
    sheet.getRange(targetRowIndex, 1, 1, lastColumn).setValues([rowValues]);
    
    // Force spreadsheet to flush and write immediately
    SpreadsheetApp.flush();
    
    // Read the fully updated display values of the row to calculate identical hash in CRM
    var updatedRowValues = sheet.getRange(targetRowIndex, 1, 1, lastColumn).getDisplayValues()[0];
    var formattedRowValues = updatedRowValues.map(function(val) {
      return (val !== null && val !== undefined) ? val.toString().trim() : "";
    });
    var formattedHeaders = headers.map(function(h) {
      return (h !== null && h !== undefined) ? h.toString().trim() : "";
    });
    
    return createJsonResponse({ 
      status: "success", 
      message: (isNewRow ? "Thêm mới thành công dòng " : "Cập nhật thành công dòng ") + targetRowIndex + " (" + updateCount + " cột)",
      row_values: formattedRowValues,
      headers: formattedHeaders
    });
    
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("OK");
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Chuẩn hóa số điện thoại: loại bỏ dấu cách, ký tự đặc biệt, chuyển đổi 84 -> 0
 */
function normalizePhone(phone) {
  if (!phone) return "";
  var clean = phone.toString().replace(/[\s\-\.\+\(\)]/g, "");
  if (clean.indexOf("84") === 0) {
    clean = "0" + clean.substr(2);
  }
  return clean;
}
