// scratch/test_sunday_monday.js

// The schedule config JSON shown in the user's screenshot:
// Thursday, Friday, Saturday: Active 08:00 - 17:30
// Sunday: Closed (Nghi)
// Monday: Active 08:00 - 17:30
const workSchedule = {
  "1": { active: true, start: "08:00", end: "17:30" },  // Monday (Thứ 2)
  "2": { active: true, start: "08:00", end: "17:30" },  // Tuesday
  "3": { active: true, start: "08:00", end: "17:30" },  // Wednesday
  "4": { active: true, start: "08:00", end: "17:30" },  // Thursday
  "5": { active: true, start: "08:00", end: "17:30" },  // Friday
  "6": { active: true, start: "08:00", end: "17:30" },  // Saturday
  "7": { active: false, start: "08:00", end: "17:30" }  // Sunday (Chủ Nhật - OFF / Nghi)
};

/**
 * JS equivalent of isConsultantInWorkHours
 */
function isConsultantInWorkHours(timeStr, start, end, schedule, mockDayOfWeek) {
  timeStr = (timeStr || "").trim();
  const timeMatch = timeStr.match(/^(\d{2}:\d{2})/);
  if (timeMatch) {
    timeStr = timeMatch[1];
  } else {
    timeStr = "12:00";
  }

  if (schedule) {
    const dayOfWeekStr = String(mockDayOfWeek); // date('N') equivalent (1 to 7)
    if (schedule[dayOfWeekStr]) {
      const dayConfig = schedule[dayOfWeekStr];
      const active = dayConfig.hasOwnProperty('active') ? Boolean(dayConfig.active) : false;
      if (!active) {
        return false; // Closed today
      }
      start = dayConfig.start || "00:00";
      end = dayConfig.end || "23:59";
    }
  }

  start = (start || "00:00").trim();
  end = (end || "23:59").trim();

  const startMatch = start.match(/^(\d{2}:\d{2})/);
  start = startMatch ? startMatch[1] : "00:00";

  const endMatch = end.match(/^(\d{2}:\d{2})/);
  end = endMatch ? endMatch[1] : "23:59";

  if (start === "00:00" && end === "23:59") {
    return true;
  }
  if (start === end) {
    return true;
  }

  if (start < end) {
    return (timeStr >= start && timeStr <= end);
  } else {
    // Crosses midnight
    return (timeStr >= start || timeStr <= end);
  }
}

console.log("=== THỬ NGHIỆM MÔ PHỎNG HỆ THỐNG GIAO TỰ ĐỘNG ===");
console.log("Thiết lập: Chủ Nhật tắt (Nghỉ), Thứ Hai bật (Hoạt động từ 08:00 đến 17:30)\n");

console.log("--- KỊCH BẢN 1: Lead mới đổ về vào ngày CHỦ NHẬT (Mock Day = 7) ---");
const sundayTimes = ["00:05", "08:30", "12:00", "14:15", "17:30", "23:59"];
sundayTimes.forEach(time => {
  const result = isConsultantInWorkHours(time, "08:00", "17:30", workSchedule, 7);
  console.log(`Thời gian: Chủ Nhật ${time} | Trong giờ làm việc? ${result ? "CÓ (Giao ngay)" : "KHÔNG"} => Trạng thái Lead: ${result ? "assigned" : "pending_work_hours (Chờ giờ làm việc)"}`);
});

console.log("\n--- KỊCH BẢN 2: Cronjob kiểm tra và giải phóng Lead vào sáng THỨ HAI (Mock Day = 1) ---");
const mondayTimes = [
  "07:30", // Trước giờ làm việc
  "07:59", // Sát giờ làm việc
  "08:00", // Bắt đầu ca làm việc
  "08:05", // Trong ca làm việc
  "12:00", // Trong ca làm việc
  "17:30", // Kết thúc ca làm việc
  "17:31", // Sau ca làm việc
];
mondayTimes.forEach(time => {
  const result = isConsultantInWorkHours(time, "08:00", "17:30", workSchedule, 1);
  console.log(`Thời gian: Thứ Hai ${time} | Trong giờ làm việc? ${result ? "CÓ (Giải phóng)" : "KHÔNG"} => Trạng thái: ${result ? "ĐÃ GIAO & GỬI THÔNG BÁO" : "Tiếp tục CHỜ"}`);
});
