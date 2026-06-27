/**
 * Chuyển đổi số thành chữ tiếng Việt (hỗ trợ tối đa 9999 tỷ)
 */
export const numberToText = (number: number | string): string => {
  return numberToVietnameseText(number);
};

export const numberToVietnameseText = (number: number | string): string => {
  if (number === "" || number === null || number === undefined) return "";
  
  const str = String(number).replace(/,/g, "");
  const n = parseInt(str);
  
  if (isNaN(n) || n === 0) return "";
  if (n > 9999999999999) return "Số quá lớn (vượt quá 9999 tỷ)";

  const defaultNumbers = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  
  const readThreeDigits = (num: number, showZeroHundred: boolean): string => {
    let res = "";
    const hundred = Math.floor(num / 100);
    const ten = Math.floor((num % 100) / 10);
    const unit = num % 10;

    if (hundred > 0) {
      res += defaultNumbers[hundred] + " trăm ";
    } else if (showZeroHundred) {
      res += "không trăm ";
    }

    if (ten > 0) {
      if (ten === 1) res += "mười ";
      else res += defaultNumbers[ten] + " mươi ";
    } else if (hundred > 0 || showZeroHundred) {
      if (unit > 0) res += "lẻ ";
    }

    if (unit > 0) {
      if (ten > 1 && unit === 1) res += "mốt";
      else if (ten > 0 && unit === 5) res += "lăm";
      else res += defaultNumbers[unit];
    }

    return res;
  };

  const units = ["", " nghìn", " triệu", " tỷ"];
  let res = "";
  let tempN = n;

  const groups: number[] = [];
  while (tempN > 0) {
    groups.push(tempN % 1000);
    tempN = Math.floor(tempN / 1000);
  }

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    const groupText = readThreeDigits(group, i < groups.length - 1);
    
    if (groupText.trim() !== "") {
      const pos = i % 3; // 0: unit/billion, 1: thousand, 2: million
      const billionGroup = Math.floor(i / 3);
      
      let unitName = units[pos];
      for(let j=0; j<billionGroup; j++) unitName += " tỷ";

      res += groupText + unitName + " ";
    }
  }

  res = res.trim();
  if (res === "") return "";
  
  // Capitalize first letter
  res = res.charAt(0).toUpperCase() + res.slice(1);
  return res + " đồng";
};
