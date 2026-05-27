import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshCw } from 'lucide-react';
import { CustomModal } from './ui/CustomModal';
import { CustomSelect } from './ui/CustomSelect';
import { Avatar } from './ui/Avatar';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';

const beautifyPhone = (phoneStr: string): string => {
  if (!phoneStr) return '';
  let cleaned = phoneStr.trim().replace(/[\s\.\-\(\)]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && (cleaned.length === 11 || cleaned.length === 12)) {
    cleaned = '0' + cleaned.slice(2);
  } else if (cleaned.length === 9 && /^[1-9]/.test(cleaned)) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
};

const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

const getDeduplicatedNotes = (notes: string[]): string => {
  if (notes.length === 0) return '';

  const trimmedNotes = notes.map(n => n.trim()).filter(n => n.length > 0);
  if (trimmedNotes.length === 0) return '';

  const normalize = (str: string): string => {
    return removeAccents(str)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const deduplicated: string[] = [];

  const sortedNotes = [...new Set(trimmedNotes)].sort((a, b) => {
    return normalize(b).length - normalize(a).length;
  });

  for (const note of sortedNotes) {
    const norm = normalize(note);
    if (!norm) {
      if (note.trim() && !deduplicated.includes(note.trim())) {
        deduplicated.push(note.trim());
      }
      continue;
    }

    const isRedundant = deduplicated.some(acceptedNote => {
      const normAccepted = normalize(acceptedNote);
      return normAccepted.includes(norm);
    });

    if (!isRedundant) {
      deduplicated.push(note);
    }
  }

  const finalNotes = trimmedNotes.filter(originalNote => {
    const originalNorm = normalize(originalNote);
    return deduplicated.some(keepNote => {
      return originalNote === keepNote || (originalNorm && normalize(keepNote) === originalNorm);
    });
  });

  const uniqueFinalNotes: string[] = [];
  finalNotes.forEach(n => {
    if (!uniqueFinalNotes.includes(n)) {
      uniqueFinalNotes.push(n);
    }
  });

  return uniqueFinalNotes.join(' - ');
};

export const QuickAddLeadModal = () => {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [consultants, setConsultants] = useState<{ id: number; name: string; status: string; avatar?: string }[]>([]);
  const [manualData, setManualData] = useState({ name: '', phone: '', email: '', source: '', type: '', note: '' });
  const [quickInput, setQuickInput] = useState('');
  const [previewCons, setPreviewCons] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [overrideConsId, setOverrideConsId] = useState<string>('');
  const [showOverrideSelector, setShowOverrideSelector] = useState(false);
  const [compensateSkipped, setCompensateSkipped] = useState(true);
  const [existingSources, setExistingSources] = useState<string[]>([]);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);

  const previewTimerRef = useRef<any>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const handleQuickInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuickInput(val);
    if (!val.trim()) return;

    let phone = '';
    let email = '';
    let name = '';
    let source = '';
    let type = '';
    let note = '';
    const extraNotes: string[] = [];

    const extractPhone = (text: string): string => {
      const phoneRegex = /(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/g;
      const matches = text.match(phoneRegex);
      if (matches && matches.length > 0) {
        return beautifyPhone(matches[0]);
      }
      const broaderRegex = /\+?\d[\d\s\.\-\(\)]{7,14}\d/g;
      const broaderMatches = text.match(broaderRegex);
      if (broaderMatches) {
        for (const m of broaderMatches) {
          const digits = m.replace(/\D/g, '');
          if (digits.length >= 9 && digits.length <= 12) {
            return beautifyPhone(m);
          }
        }
      }
      return '';
    };

    const extractEmail = (text: string): string => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = text.match(emailRegex);
      return matches && matches.length > 0 ? matches[0] : '';
    };

    const hasNonNameNoise = (text: string): boolean => {
      const cleanLower = text.trim().toLowerCase();
      const nonNamePhrases = [
        'chưa gọi', 'tìm hiểu', 'liên thông', 'cần tư vấn', 'tư vấn', 'đăng ký',
        'lớp học', 'khóa học', 'mua nhà', 'thuê nhà', 'chung cư', 'căn hộ',
        'đất nền', 'biệt thự', 'bao nhiêu', 'inbox', 'comment', 'nhắn tin',
        'đã học', 'tiếng anh', 'cử nhân', 'thông tin', 'ngày'
      ];
      if (nonNamePhrases.some(phrase => cleanLower.includes(phrase))) {
        return true;
      }

      const nonNameWords = [
        'facebook', 'fb', 'zalo', 'tiktok', 'google', 'gg', 'youtube', 'yt', 'ads', 'messenger', 'mess', 'web', 'website', 'landing', 'ldp', 'ad', 'link',
        'lớp', 'học', 'khóa', 'giá', 'inbox', 'ib', 'comment', 'cmt', 'chat', 'sđt', 'sdt', 'phone', 'email', 'hotline',
        'cử', 'nhân', 'tiếng', 'anh', 'b2'
      ];
      const nameWords = cleanLower.split(/\s+/);
      if (nameWords.some(w => nonNameWords.includes(w))) {
        return true;
      }
      return false;
    };

    const isLikelyName = (text: string): boolean => {
      const clean = text.trim();
      const words = clean.split(/\s+/);
      if (words.length < 2 || words.length > 5) return false;

      const VN_LETTERS = "a-zA-ZàáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳýỷỹỵÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲÝỶỸỴ";
      const lettersRegex = new RegExp('^[' + VN_LETTERS + '\\s\\.]+$');
      if (!lettersRegex.test(clean)) return false;

      return !hasNonNameNoise(clean);
    };

    const isSourceKeyword = (text: string): boolean => {
      const cleanLower = text.trim().toLowerCase();
      const sourceKeywords = ['facebook', 'fb', 'zalo', 'mess', 'messenger', 'google', 'gg', 'tiktok', 'ads', 'web', 'website', 'landing', 'ldp', 'youtube', 'yt'];
      return sourceKeywords.some(keyword => cleanLower === keyword || cleanLower === keyword + ' ads' || cleanLower === 'ads ' + keyword || cleanLower.includes(keyword + '_ads') || cleanLower.includes(keyword + '-ads'));
    };

    const normalizeSource = (text: string): string => {
      const segLower = text.toLowerCase();
      if (segLower.includes('fb') || segLower.includes('facebook')) return 'Facebook';
      if (segLower.includes('zalo')) return 'Zalo';
      if (segLower.includes('mess')) return 'Messenger';
      if (segLower.includes('google') || segLower.includes('gg')) return 'Google';
      if (segLower.includes('tiktok')) return 'Tiktok';
      if (segLower.includes('youtube') || segLower.includes('yt')) return 'Youtube';
      return text.trim();
    };

    const isExcludedFromType = (text: string): boolean => {
      const cleanLower = text.trim().toLowerCase();
      const exclusionKeywords = [
        'bằng cấp', 'tốt nghiệp', 'đã học', 'học lực', 'trình độ', 'chứng chỉ', 'đã có bằng',
        'giúp em', 'giuap em', 'nhé', 'nha', 'liền', 'ngay', 'tư vấn liền', 'tư vấn ngay', 'tư vấn giúp', 'tư vấn em',
        'gọi lại', 'gọi điện', 'gọi lúc', 'gọi ảnh', 'gọi cho', 'gọi họ', 'gọi em', 'gọi mình', 'call',
        'sđt', 'số điện thoại', 'hotline', 'timestamp', 'lúc', 'giờ', 'sáng', 'chiều', 'tối', 'ngày',
        'chưa hỏi', 'chưa gọi', 'nhắc lại', 'nhắc nhở', 'liên hệ', 'bận', 'không nghe', 'nghe máy',
        'inbox', 'ib', 'comment', 'cmt', 'chat', 'mess', 'messenger', 'zalo', 'facebook', 'fb'
      ];
      return exclusionKeywords.some(keyword => cleanLower.includes(keyword));
    };

    const isQualificationSegment = (text: string): boolean => {
      const cleanLower = text.trim().toLowerCase();
      const qualKeywords = [
        'bằng cấp', 'tốt nghiệp', 'đã học', 'học lực', 'trình độ', 'chứng chỉ', 'đã có bằng', 'đang theo học'
      ];
      return qualKeywords.some(keyword => cleanLower.includes(keyword));
    };

    const typeKeywordsList = [
      'msc', 'mba', 'dba', 'bba', 'master', 'thạc sĩ', 'thạc sỹ', 'cử nhân',
      'liên thông', 'lớp 10', 'đại học', 'cao đẳng', 'trung cấp', 'văn bằng 2', 'vb2',
      'ngôn ngữ anh', 'tiếng anh', 'ielts', 'giao tiếp', 'toeic',
      'lập trình', 'fullstack', 'web', 'python', 'data', 'cntt', 'công nghệ thông tin', 'luật',
      'du học', 'định cư',
      'chung cư', 'căn hộ', 'nhà phố', 'đất nền', 'biệt thự'
    ];

    const isTypeKeyword = (text: string): boolean => {
      if (isExcludedFromType(text)) return false;

      const cleanText = text.replace(/^(?:chương trình|program|loại|type|nhu cầu)\s*[:=]\s*/i, '').trim();

      if (cleanText.split(/\s+/).length > 6 || cleanText.length > 30) return false;

      const cleanLower = cleanText.toLowerCase();
      return typeKeywordsList.some(keyword => cleanLower.includes(keyword));
    };

    const findTypeKeywordInSegment = (seg: string): string | null => {
      if (isQualificationSegment(seg)) return null;

      const cleanLower = seg.toLowerCase();
      for (const kw of typeKeywordsList) {
        const idx = cleanLower.indexOf(kw);
        if (idx !== -1) {
          if (idx > 0) {
            const charBefore = cleanLower[idx - 1];
            if (/[a-z0-9à-ỹđ]/i.test(charBefore)) {
              continue;
            }
          }
          const endIdx = idx + kw.length;
          if (endIdx < cleanLower.length) {
            const charAfter = cleanLower[endIdx];
            if (/[a-z0-9à-ỹđ]/i.test(charAfter)) {
              continue;
            }
          }
          return seg.substring(idx, idx + kw.length);
        }
      }
      return null;
    };

    const splitIntoSubSegments = (seg: string): string[] => {
      const urls: string[] = [];
      let tempSeg = seg.replace(/https?:\/\/[^\s]+/gi, (match) => {
        urls.push(match);
        return `__URL_PLACEHOLDER_${urls.length - 1}__`;
      });

      const emails: string[] = [];
      tempSeg = tempSeg.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
        emails.push(match);
        return `__EMAIL_PLACEHOLDER_${emails.length - 1}__`;
      });

      const phones: string[] = [];
      const phoneRegex = /(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/g;
      tempSeg = tempSeg.replace(phoneRegex, (match) => {
        phones.push(match);
        return `__PHONE_PLACEHOLDER_${phones.length - 1}__`;
      });

      const parts = tempSeg.split(/\s*[,.;]\s*/);

      return parts.map(part => {
        let restored = part;
        urls.forEach((url, idx) => {
          restored = restored.replace(`__URL_PLACEHOLDER_${idx}__`, url);
        });
        emails.forEach((email, idx) => {
          restored = restored.replace(`__EMAIL_PLACEHOLDER_${idx}__`, email);
        });
        phones.forEach((phoneNum, idx) => {
          restored = restored.replace(`__PHONE_PLACEHOLDER_${idx}__`, phoneNum);
        });
        return restored.trim();
      }).filter(p => p.length > 0);
    };

    const isSamePhone = (segPhone: string, extractedPhone: string): boolean => {
      const cleanSeg = segPhone.replace(/\D/g, '');
      const cleanExtracted = extractedPhone.replace(/\D/g, '');
      if (!cleanSeg || !cleanExtracted) return false;
      return cleanSeg.slice(-9) === cleanExtracted.slice(-9);
    };

    const hasSubstantialText = (seg: string, phoneStr: string): boolean => {
      let temp = seg;
      if (phoneStr) {
        const rawPhoneMatch = seg.match(/(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/);
        if (rawPhoneMatch) {
          temp = temp.replace(rawPhoneMatch[0], '');
        } else {
          temp = temp.replace(phoneStr, '');
        }
      }
      const letters = temp.replace(/[^a-zA-Zà-ỹÀ-ỸđĐ]/g, '');
      return letters.length > 2;
    };

    // --- STRATEGY 1: JSON / Loose JS Object ---
    let parsedJSON: any = null;
    const trimmedVal = val.trim();
    if (trimmedVal.startsWith('{') && trimmedVal.includes('}')) {
      try {
        parsedJSON = JSON.parse(trimmedVal);
      } catch (e) {
        try {
          const cleanJSONStr = trimmedVal
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
            .replace(/'/g, '"');
          parsedJSON = JSON.parse(cleanJSONStr);
        } catch (err) {
          // ignore
        }
      }
    }

    if (parsedJSON && typeof parsedJSON === 'object') {
      const keys = Object.keys(parsedJSON);
      keys.forEach(k => {
        const keyLower = k.toLowerCase();
        const valStr = String(parsedJSON[k]).trim();
        if (/^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang)$/i.test(keyLower)) {
          name = valStr;
        } else if (/^(sđt|sdt|đt|dt|phone|điện thoại|tel)$/i.test(keyLower)) {
          phone = beautifyPhone(valStr);
        } else if (/^(email|mail)$/i.test(keyLower)) {
          email = valStr;
        } else if (/^(nguồn|nguon|source|kênh|kenh)$/i.test(keyLower)) {
          source = normalizeSource(valStr);
        } else if (/^(loại|loai|type|nhu cầu|nhu cau)$/i.test(keyLower)) {
          type = valStr;
        } else if (/^(ghi chú|ghi chu|note|nội dung)$/i.test(keyLower)) {
          extraNotes.push(valStr);
        } else {
          extraNotes.push(`${k}: ${valStr}`);
        }
      });
      note = getDeduplicatedNotes(extraNotes);

      setManualData({
        name: name || manualData.name,
        phone: phone || manualData.phone,
        email: email || manualData.email,
        source: source || manualData.source,
        type: type || manualData.type,
        note: note || manualData.note,
      });
      return;
    }

    // --- STRATEGY 2: Excel / Google Sheets Copy-Paste with tabs (\t) ---
    if (val.includes('\t')) {
      const lines = val.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        const keyRegex = /^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang|sđt|sdt|đt|dt|phone|điện thoại|tel|email|mail|nguồn|nguon|source|kênh|kenh|loại|loai|type|nhu cầu|nhu cau|ghi chú|ghi chu|note|nội dung|số điện thoại|so dien thoai|họ và tên|ho va ten|địa chỉ email|dia chi email|lớp|lop|khóa học|khoa hoc|tình trạng|tinh trang|học vấn|hoc van|tiếng anh|tieng anh|chương trình|chuong trinh|khách note|khach note)$/i;

        let kvLinesCount = 0;
        let totalTabLines = 0;
        lines.forEach(line => {
          if (line.includes('\t')) {
            totalTabLines++;
            const parts = line.split('\t');
            if (parts.length >= 2 && keyRegex.test(parts[0].trim())) {
              kvLinesCount++;
            }
          }
        });

        let isVerticalTabList = false;
        if (totalTabLines > 0) {
          if (lines.length === 1) {
            const parts = lines[0].split('\t');
            if (parts.length === 2) {
              const k = parts[0].trim();
              const v = parts[1].trim();
              if (keyRegex.test(k) && !keyRegex.test(v)) {
                isVerticalTabList = true;
              }
            }
          } else {
            if (kvLinesCount >= Math.min(2, totalTabLines)) {
              isVerticalTabList = true;
            }
          }
        }

        if (isVerticalTabList) {
          lines.forEach(line => {
            if (line.includes('\t')) {
              const parts = line.split('\t');
              const k = parts[0].trim();
              const v = parts.slice(1).join('\t').trim();
              if (!v) return;

              const kLower = k.toLowerCase();
              if (/^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang|họ và tên|ho va ten)$/i.test(kLower)) {
                name = v;
              } else if (/^(sđt|sdt|đt|dt|phone|điện thoại|tel|số điện thoại|so dien thoai)$/i.test(kLower)) {
                phone = beautifyPhone(v);
              } else if (/^(email|mail|địa chỉ email|dia chi email)$/i.test(kLower)) {
                email = v;
              } else if (/^(nguồn|nguon|source|kênh|kenh)$/i.test(kLower)) {
                source = normalizeSource(v);
              } else if (/^(loại|loai|type|nhu cầu|nhu cau|lớp|lop|khóa học|khoa hoc|chương trình|chuong trinh)$/i.test(kLower)) {
                type = v;
              } else if (/^(ghi chú|ghi chu|note|nội dung|tình trạng|tinh trang)$/i.test(kLower)) {
                extraNotes.push(v);
              } else {
                extraNotes.push(`${k}: ${v}`);
              }
            } else {
              extraNotes.push(line);
            }
          });

          note = getDeduplicatedNotes(extraNotes);

          setManualData({
            name: name.trim() || manualData.name,
            phone: beautifyPhone(phone) || manualData.phone,
            email: email.trim() || manualData.email,
            source: source.trim() || manualData.source,
            type: type.trim() || manualData.type,
            note: note.trim() || manualData.note,
          });
          return;
        }

        const firstLineCells = lines[0].split('\t').map(c => c.trim().toLowerCase());
        const isHeader = firstLineCells.some(cell =>
          /^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang|sđt|sdt|đt|dt|phone|điện thoại|tel|email|mail|nguồn|nguon|source|kênh|kenh|loại|loai|type|nhu cầu|nhu cau|ghi chú|ghi chu|note|nội dung|số điện thoại|so dien thoai|họ và tên|ho va ten|địa chỉ email|dia chi email|lớp|lop|khóa học|khoa hoc|tình trạng|tinh trang)$/i.test(cell)
        );

        let dataLine = lines[0];
        let headerLine = '';
        if (isHeader && lines.length > 1) {
          headerLine = lines[0];
          dataLine = lines[1];
        } else if (lines.length > 1) {
          headerLine = lines[0];
          dataLine = lines[1];
        }

        const dataCells = dataLine.split('\t').map(c => c.trim());

        if (headerLine) {
          const headers = headerLine.split('\t').map(c => c.trim().toLowerCase());
          headers.forEach((h, idx) => {
            const cellVal = dataCells[idx] || '';
            if (!cellVal) return;

            if (/^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang|họ và tên|ho va ten)$/.test(h)) {
              name = cellVal;
            } else if (/^(sđt|sdt|đt|dt|phone|điện thoại|tel|số điện thoại|so dien thoai)$/.test(h)) {
              phone = beautifyPhone(cellVal);
            } else if (/^(email|mail|địa chỉ email|dia chi email)$/.test(h)) {
              email = cellVal;
            } else if (/^(nguồn|nguon|source|kênh|kenh)$/.test(h)) {
              source = normalizeSource(cellVal);
            } else if (/^(loại|loai|type|nhu cầu|nhu cau|lớp|lop|khóa học|khoa hoc)$/.test(h)) {
              type = cellVal;
            } else if (/^(ghi chú|ghi chu|note|nội dung|tình trạng|tinh trang)$/.test(h)) {
              extraNotes.push(cellVal);
            } else {
              extraNotes.push(cellVal);
            }
          });
          note = getDeduplicatedNotes(extraNotes);
        } else {
          email = extractEmail(val);
          phone = extractPhone(val);

          dataCells.forEach(cell => {
            if (!cell) return;
            const cleanCell = cell.replace(/[\s\.\-\(\)]/g, '');
            if (phone && (cleanCell.includes(phone) || phone.includes(cleanCell))) return;
            if (email && cell.toLowerCase().includes(email.toLowerCase())) return;

            if (/https?:\/\/[^\s]+/i.test(cell)) {
              extraNotes.push(cell);
              if (cell.toLowerCase().includes('facebook.com') && !source) {
                source = 'Facebook';
              }
            } else if (isSourceKeyword(cell)) {
              source = normalizeSource(cell);
            } else if (isLikelyName(cell)) {
              name = cell;
            } else if (isTypeKeyword(cell)) {
              type = cell;
            } else {
              extraNotes.push(cell);
            }
          });
          note = getDeduplicatedNotes(extraNotes);
        }

        setManualData({
          name: name || manualData.name,
          phone: phone || manualData.phone,
          email: email || manualData.email,
          source: source || manualData.source,
          type: type || manualData.type,
          note: note || manualData.note,
        });
        return;
      }
    }

    // --- STRATEGY 3: Inline Key-Value Pairs (e.g. key: value, key: value) ---
    const kvInlineRegex = /(họ tên|ho ten|tên|ten|name|khách hàng|khach hang|sđt|sdt|đt|dt|phone|điện thoại|tel|email|mail|nguồn|nguon|source|kênh|kenh|loại|loai|type|nhu cầu|nhu cau|ghi chú|ghi chu|note|nội dung)\s*[:=]\s*([^,;\n\t]+)/gi;
    const kvMatches = [...val.matchAll(kvInlineRegex)];
    if (kvMatches.length >= 2) {
      kvMatches.forEach(match => {
        const label = match[1].toLowerCase();
        const value = match[2].trim();
        if (/^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang)$/.test(label)) {
          name = value;
        } else if (/^(sđt|sdt|đt|dt|phone|điện thoại|tel)$/.test(label)) {
          phone = beautifyPhone(value);
        } else if (/^(email|mail)$/.test(label)) {
          email = value;
        } else if (/^(nguồn|nguon|source|kênh|kenh)$/.test(label)) {
          source = normalizeSource(value);
        } else if (/^(loại|loai|type|nhu cầu|nhu cau)$/.test(label)) {
          type = value;
        } else if (/^(ghi chú|ghi chu|note|nội dung)$/.test(label)) {
          extraNotes.push(value);
        }
      });

      let remainingText = val;
      kvMatches.forEach(match => {
        remainingText = remainingText.replace(match[0], '');
      });
      const urls: string[] = [];
      remainingText = remainingText.replace(/https?:\/\/[^\s]+/gi, (m) => {
        urls.push(m);
        return `__URL_PLACEHOLDER_${urls.length - 1}__`;
      });
      remainingText = remainingText.replace(/[\s,;\-\|•]+/g, ' ').trim();
      urls.forEach((url, idx) => {
        remainingText = remainingText.replace(`__URL_PLACEHOLDER_${idx}__`, url);
      });
      if (remainingText) {
        extraNotes.push(remainingText);
      }
      note = getDeduplicatedNotes(extraNotes);

      setManualData({
        name: name || manualData.name,
        phone: phone || manualData.phone,
        email: email || manualData.email,
        source: source || manualData.source,
        type: type || manualData.type,
        note: note || manualData.note,
      });
      return;
    }

    // --- STRATEGY 4: Multi-line Key-Value Block ---
    const lines = val.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const kvBlockRegex = /^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang|sđt|sdt|đt|dt|phone|điện thoại|tel|email|mail|nguồn|nguon|source|kênh|kenh|loại|loai|type|nhu cầu|nhu cau|ghi chú|ghi chu|note|nội dung)\s*[:=]\s*(.+)$/i;
    let isKeyValuePairBlock = false;
    lines.forEach(line => {
      if (kvBlockRegex.test(line)) {
        isKeyValuePairBlock = true;
      }
    });

    if (isKeyValuePairBlock) {
      lines.forEach(line => {
        const match = line.match(kvBlockRegex);
        if (match) {
          const label = match[1].toLowerCase();
          const value = match[2].trim();

          if (/^(họ tên|ho ten|tên|ten|name|khách hàng|khach hang)$/.test(label)) {
            name = value;
          } else if (/^(sđt|sdt|đt|dt|phone|điện thoại|tel)$/.test(label)) {
            phone = beautifyPhone(value);
          } else if (/^(email|mail)$/.test(label)) {
            email = value;
          } else if (/^(nguồn|nguon|source|kênh|kenh)$/.test(label)) {
            source = normalizeSource(value);
          } else if (/^(loại|loai|type|nhu cầu|nhu cau)$/.test(label)) {
            type = value;
          } else if (/^(ghi chú|ghi chu|note|nội dung)$/.test(label)) {
            extraNotes.push(value);
          }
        } else {
          extraNotes.push(line);
        }
      });
      note = getDeduplicatedNotes(extraNotes);

      setManualData({
        name: name || manualData.name,
        phone: phone || manualData.phone,
        email: email || manualData.email,
        source: source || manualData.source,
        type: type || manualData.type,
        note: note || manualData.note,
      });
      return;
    }

    // --- STRATEGY 5: Delimited List or Conversational Paragraph ---
    let segments: string[] = [];
    segments = val
      .split(/\s*(?:\r?\n| - | \| | – | — | • |;|\s\.\s)\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (segments.length > 1) {
      let nameAssigned = false;
      let typeAssigned = false;

      email = extractEmail(val);
      phone = extractPhone(val);

      const firstSeg = segments[0];
      if (firstSeg) {
        if (isLikelyName(firstSeg)) {
          name = firstSeg;
          nameAssigned = true;
        } else {
          const VN_LOWER = "a-zàáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳýỷỹỵ";
          const startNameRegex = new RegExp('^\\s*([A-ZÀ-ỸđĐ][' + VN_LOWER + ']+(?:\\s+[A-ZÀ-ỸđĐ][' + VN_LOWER + ']+){1,3})\\b');
          const match = firstSeg.match(startNameRegex);
          if (match && isLikelyName(match[1])) {
            name = match[1].trim();
            nameAssigned = true;
          }
        }
      }

      const allSegments: string[] = [];
      segments.forEach(seg => {
        const subSegs = splitIntoSubSegments(seg);
        allSegments.push(...subSegs);
      });

      // Pass 1: Extract name, source, and short/exact type keywords
      allSegments.forEach(seg => {
        const cleanSeg = seg.replace(/[\s\.\-\(\)]/g, '');
        const isPhoneSeg = phone && (cleanSeg.includes(phone) || phone.includes(cleanSeg) || seg.replace(/\D/g, '').includes(phone) || isSamePhone(seg, phone));

        if (isPhoneSeg || (email && seg.toLowerCase().includes(email.toLowerCase())) || /https?:\/\/[^\s]+/i.test(seg)) {
          return;
        }

        if (isSourceKeyword(seg)) {
          source = normalizeSource(seg);
          return;
        }

        let cleanSegForName = seg;
        if (nameAssigned && name) {
          cleanSegForName = cleanSegForName.replace(new RegExp(name, 'gi'), '').trim();
        }

        if (!nameAssigned && isLikelyName(seg)) {
          name = seg;
          nameAssigned = true;
          return;
        }

        const labeledType = seg.match(/^(?:chương trình|program|loại|type|nhu cầu|nguyện vọng)\s*[:=]\s*(.+)$/i);
        if (labeledType) {
          const candidate = labeledType[1].trim();
          if (candidate && !isExcludedFromType(candidate) && typeKeywordsList.some(kw => candidate.toLowerCase().includes(kw))) {
            type = candidate;
            typeAssigned = true;
            return;
          }
        }

        if (!typeAssigned && isTypeKeyword(cleanSegForName)) {
          type = cleanSegForName.replace(/^(?:chương trình|program|loại|type|nhu cầu)\s*[:=]\s*/i, '').trim();
          typeAssigned = true;
          return;
        }
      });

      // Pass 2: Fallbacks and long type keywords extraction
      allSegments.forEach(seg => {
        const cleanSeg = seg.replace(/[\s\.\-\(\)]/g, '');
        const isPhoneSeg = phone && (cleanSeg.includes(phone) || phone.includes(cleanSeg) || seg.replace(/\D/g, '').includes(phone) || isSamePhone(seg, phone));

        if (isPhoneSeg) {
          if (!hasSubstantialText(seg, phone)) {
            return;
          }
          const rawPhoneMatch = seg.match(/(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/);
          if (rawPhoneMatch) {
            seg = seg.replace(rawPhoneMatch[0], '').replace(/^[\s\-\.,;:]+|[\s\-\.,;:]+$/g, '').trim();
          } else {
            seg = seg.replace(phone, '').replace(/^[\s\-\.,;:]+|[\s\-\.,;:]+$/g, '').trim();
          }
        }

        if (email && seg.toLowerCase().includes(email.toLowerCase())) {
          if (seg.toLowerCase() === email.toLowerCase()) return;
          seg = seg.replace(email, '').replace(/^[\s\-\.,;:]+|[\s\-\.,;:]+$/g, '').trim();
        }

        if (/https?:\/\/[^\s]+/i.test(seg)) {
          extraNotes.push(seg);
          if (seg.toLowerCase().includes('facebook.com') && !source) {
            source = 'Facebook';
          }
          return;
        }

        if (isSourceKeyword(seg)) {
          return;
        }

        let cleanSegForNotes = seg;
        if (nameAssigned && name) {
          if (seg.trim() === name.trim()) return;
          cleanSegForNotes = cleanSegForNotes.replace(name, '').trim();
        }

        if (typeAssigned && (type === seg || seg.toLowerCase().includes(type.toLowerCase()))) {
          return;
        }

        if (cleanSegForNotes.length === 0) return;

        if (!typeAssigned) {
          const extractedType = findTypeKeywordInSegment(cleanSegForNotes);
          if (extractedType) {
            type = extractedType;
            typeAssigned = true;
            extraNotes.push(cleanSegForNotes);
            return;
          }
        }

        if (!typeAssigned) {
          const labeledType = cleanSegForNotes.match(/^(?:chương trình|program|loại|type|nhu cầu|nguyện vọng)\s*[:=]\s*(.+)$/i);
          if (labeledType) {
            const candidate = labeledType[1].trim();
            if (candidate && !isExcludedFromType(candidate)) {
              type = candidate;
              typeAssigned = true;
              return;
            }
          }
        }

        if (!nameAssigned && !hasNonNameNoise(cleanSegForNotes) && cleanSegForNotes.split(/\s+/).length >= 2 && cleanSegForNotes.split(/\s+/).length <= 4) {
          name = cleanSegForNotes;
          nameAssigned = true;
          return;
        }

        if (nameAssigned && !typeAssigned && !isExcludedFromType(cleanSegForNotes) && cleanSegForNotes.split(/\s+/).length <= 5) {
          type = cleanSegForNotes.replace(/^(?:chương trình|program|loại|type|nhu cầu)\s*[:=]\s*/i, '').trim();
          typeAssigned = true;
          return;
        }

        extraNotes.push(cleanSegForNotes);
      });

      note = getDeduplicatedNotes(extraNotes);
    } else {
      const text = segments[0] || val;
      email = extractEmail(text);
      phone = extractPhone(text);

      const namePatterns = /(?:mình là|tên là|họ tên|tên:?|khách hàng:?|tên em là|tên mình là|anh|chị)\s*([A-ZÀ-ỸđĐ][a-zà-ỹ]*(\s+[A-ZÀ-ỸđĐ][a-zà-ỹ]*){1,4})/i;
      const nameMatch = text.match(namePatterns);
      if (nameMatch) {
        name = nameMatch[1].trim();
      } else {
        const VN_UPPER = "A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲÝỶỸỴ";
        const VN_LOWER = "a-zàáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳýỷỹỵ";
        const capitalizedWordPattern = new RegExp('[' + VN_UPPER + '][' + VN_LOWER + ']*(?:\\s+[' + VN_UPPER + '][' + VN_LOWER + ']*){1,3}', 'g');
        const matches = text.match(capitalizedWordPattern);
        if (matches) {
          for (const m of matches) {
            if (isLikelyName(m)) {
              name = m;
              break;
            }
          }
        }
      }

      const matchedType = typeKeywordsList.find(kw => text.toLowerCase().includes(kw) && !isExcludedFromType(text));
      if (matchedType) {
        type = matchedType;
      } else {
        const typePatterns = /(?:nhu cầu|tìm hiểu|loại|đăng ký|muốn mua|quan tâm|muốn học|cần tư vấn|tư vấn về)\s*([a-zà-ỹ0-9\s]+?)(?:\.|,|thông tin|sđt|email|facebook|zalo|$)/i;
        const typeMatch = text.match(typePatterns);
        if (typeMatch && !isExcludedFromType(typeMatch[1])) {
          type = typeMatch[1].trim();
        }
      }

      const urlRegex = /https?:\/\/[^\s]+/gi;
      const urls = text.match(urlRegex);
      if (urls) {
        urls.forEach(u => {
          extraNotes.push(u);
          if (u.toLowerCase().includes('facebook.com') && !source) {
            source = 'Facebook';
          }
        });
      }

      let cleanedNote = text;
      if (name) cleanedNote = cleanedNote.replace(name, '');
      if (nameMatch) cleanedNote = cleanedNote.replace(nameMatch[0], '');
      if (phone) {
        const rawPhoneMatch = text.match(/(?:\+?84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/);
        if (rawPhoneMatch) cleanedNote = cleanedNote.replace(rawPhoneMatch[0], '');
      }
      if (email) cleanedNote = cleanedNote.replace(email, '');
      if (urls) {
        urls.forEach(u => {
          cleanedNote = cleanedNote.replace(u, '');
        });
      }

      typeKeywordsList.forEach(kw => {
        cleanedNote = cleanedNote.replace(new RegExp(kw, 'gi'), '');
      });

      cleanedNote = cleanedNote
        .replace(/(?:mình là|tên là|họ tên|tên:?|khách hàng:?|tên em là|tên mình là|nhu cầu|tìm hiểu|loại|đăng ký|muốn mua|quan tâm|muốn học|cần tư vấn|tư vấn|số điện thoại|sđt|sdt|email|mail|ở|tại|và có|nhé|nha|với)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      cleanedNote = cleanedNote.replace(/^[\s\-\.,;]+|[\s\-\.,;]+$/g, '');
      if (cleanedNote) {
        extraNotes.unshift(cleanedNote);
      }
      note = getDeduplicatedNotes(extraNotes);
    }

    if (!source) {
      if (val.toLowerCase().includes('facebook') || val.toLowerCase().includes('fb.com')) {
        source = 'Facebook';
      } else if (val.toLowerCase().includes('zalo')) {
        source = 'Zalo';
      } else if (val.toLowerCase().includes('google') || val.toLowerCase().includes('gg')) {
        source = 'Google';
      } else if (val.toLowerCase().includes('tiktok')) {
        source = 'Tiktok';
      } else if (val.toLowerCase().includes('youtube') || val.toLowerCase().includes('yt')) {
        source = 'Youtube';
      }
    }

    setManualData({
      name: name.trim() || manualData.name,
      phone: beautifyPhone(phone) || manualData.phone,
      email: email.trim() || manualData.email,
      source: source.trim() || manualData.source,
      type: type.trim() || manualData.type,
      note: note.trim() || manualData.note,
    });
  };

  // Load consultants list
  const fetchConsultants = async () => {
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) {
        setConsultants(json.data);
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  // Load unique sources list
  const fetchSources = async () => {
    try {
      const json = await fetchAPI('get_unique_sources');
      if (json.success) {
        setExistingSources(json.data || []);
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const handleSelectSource = (src: string) => {
    setManualData(prev => ({ ...prev, source: src }));
    setShowSourceSuggestions(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchConsultants();
      fetchSources();
    }
  }, [isOpen]);

  // Click outside to close source suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceRef.current && !sourceRef.current.contains(event.target as Node)) {
        setShowSourceSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to open event
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-quick-add-lead', handleOpen);
    return () => window.removeEventListener('open-quick-add-lead', handleOpen);
  }, []);

  // Debounce routing preview
  useEffect(() => {
    if (!isOpen) return;

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    if (manualData.phone.length < 8 && !manualData.email) {
      setPreviewCons(null);
      setOverrideConsId('');
      return;
    }

    previewTimerRef.current = setTimeout(async () => {
      setIsPreviewing(true);
      try {
        const json = await fetchAPI('preview_routing', {
          method: 'POST',
          body: JSON.stringify({ data: manualData })
        });
        if (json.success) {
          setPreviewCons(json);
        }
      } catch (e: any) {
        // ignore preview network error
      }
      setIsPreviewing(false);
    }, 500);

  }, [manualData, isOpen]);

  const handleManualSubmit = async () => {
    if (!manualData.phone && !manualData.email) {
      toast.error(t('Vui lòng nhập SĐT hoặc Email'));
      return;
    }
    setIsSubmittingManual(true);
    try {
      const payload = {
        data: manualData,
        override_round_id: previewCons?.round_id,
        override_consultant_id: overrideConsId ? Number(overrideConsId) : null,
        compensate_skipped: compensateSkipped,
        skipped_consultant_id: previewCons?.consultant?.consultant_id
      };

      const json = await fetchAPI('manual_insert_lead', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (json.success) {
        toast.success(json.message || t('Thêm thành công!'));
        setIsOpen(false);
        // Reset form
        setManualData({ name: '', phone: '', email: '', source: '', type: '', note: '' });
        setQuickInput('');
        setPreviewCons(null);
        setOverrideConsId('');
        setShowOverrideSelector(false);
        setCompensateSkipped(true);
        // Trigger table refresh
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(json.message || t('Thêm thất bại'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSubmittingManual(false);
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setQuickInput('');
        setShowOverrideSelector(false);
      }}
      title={t("Thêm Data Thủ Công")}
      width="650px"
    >
      <div style={{ padding: '0 0 1.25rem 0', background: 'transparent' }}>
        {/* Dán nhanh thông tin */}
        <div style={{
          marginBottom: '1.25rem',
          padding: '12px 14px',
          background: theme === 'dark' ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(237, 216, 252, 0.05) 100%)' : 'linear-gradient(135deg, #f5f3ff 0%, #edd8fc 100%)',
          borderRadius: '12px',
          border: theme === 'dark' ? '1px dashed rgba(168, 85, 247, 0.4)' : '1px dashed #c084fc',
          boxShadow: theme === 'dark' ? 'none' : '0 2px 8px rgba(192, 132, 252, 0.08)'
        }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', letterSpacing: '0.5px' }}>
            AI VIP PROMAX ULTRA
          </label>
          <textarea
            className="form-input"
            rows={2}
            style={{
              resize: 'none',
              fontSize: '0.8125rem',
              lineHeight: 1.4,
              background: theme === 'dark' ? 'var(--color-bg)' : 'white',
              border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #ddd6fe',
              borderRadius: '8px',
              padding: '8px 10px',
              width: '100%',
              outline: 'none',
              transition: 'border-color 0.2s',
              color: theme === 'dark' ? 'var(--color-text)' : 'inherit'
            }}
            placeholder={t("Ví dụ: Trần Văn Hiền - 0364200518 - tìm hiểu liên thông - Chưa hỏi được gì - FB_Ads")}
            value={quickInput}
            onChange={handleQuickInputChange}
          />
        </div>

        <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Họ tên')}</label>
            <input className="form-input" placeholder={t("VD: Nguyễn Văn A")} value={manualData.name} onChange={e => setManualData({ ...manualData, name: e.target.value })} />
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Số điện thoại (*)')}</label>
            <input className="form-input" placeholder="VD: 0912345678" value={manualData.phone} onChange={e => setManualData({ ...manualData, phone: beautifyPhone(e.target.value) })} />
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Email</label>
            <input className="form-input" placeholder="VD: email@gmail.com" value={manualData.email} onChange={e => setManualData({ ...manualData, email: e.target.value })} />
          </div>
          <div ref={sourceRef} style={{ position: 'relative' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Nguồn (Source)')}</label>
            <input
              className="form-input"
              placeholder="VD: FB_Ads"
              value={manualData.source}
              onChange={e => setManualData({ ...manualData, source: e.target.value })}
              onFocus={() => setShowSourceSuggestions(true)}
            />
            {showSourceSuggestions && (
              (() => {
                const filtered = existingSources.filter(src =>
                  src.toLowerCase().includes((manualData.source || '').toLowerCase())
                );
                if (filtered.length === 0) return null;
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: theme === 'dark' ? 'var(--color-surface)' : 'white',
                      border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}
                  >
                    {filtered.map((src, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSource(src)}
                        style={{
                          padding: '8px 12px',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          color: theme === 'dark' ? 'var(--color-text)' : '#1e293b',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme === 'dark' ? 'var(--color-bg)' : '#f5f3ff';
                          e.currentTarget.style.color = '#7c3aed';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = theme === 'dark' ? 'var(--color-text)' : '#1e293b';
                        }}
                      >
                        {src}
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Loại (Type)')}</label>
            <input className="form-input" placeholder={t("VD: Mua nhà")} value={manualData.type} onChange={e => setManualData({ ...manualData, type: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Ghi chú')}</label>
            <textarea className="form-input" rows={3} style={{ resize: 'vertical', minHeight: '80px', lineHeight: 1.5, padding: '10px 12px' }} placeholder={t("Ghi chú thêm (Hỗ trợ nhiều dòng)...")} value={manualData.note} onChange={e => setManualData({ ...manualData, note: e.target.value })} />
          </div>
        </div>

        <div style={{ background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', padding: '1rem', borderRadius: 12, border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #e2e8f0', marginTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <RefreshCw size={16} className={isPreviewing ? "spin" : ""} color="var(--color-primary)" /> Live Preview
          </h4>

          {isPreviewing ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{t('Đang kiểm tra...')}</div>
          ) : !previewCons ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{t('Nhập SĐT hoặc Email để xem trước vòng chia.')}</div>
          ) : previewCons.round_id === null ? (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.8125rem', fontWeight: 600 }}>{t('Không khớp với luật chia nào. (Data sẽ lưu trạng thái Chưa phân bổ)')}</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  {t('Sẽ rơi vào Vòng:')} <strong style={{ color: 'var(--color-primary)', marginLeft: 4 }}>{previewCons.consultant?.round_name || t('Vòng ') + previewCons.round_id}</strong>
                  {previewCons.is_fallback && (
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', background: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', color: theme === 'dark' ? '#f87171' : '#ef4444', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Vòng mặc định (Fallback)
                    </span>
                  )}
                </div>
              </div>

              <div style={{ background: theme === 'dark' ? 'var(--color-surface)' : 'white', padding: '12px', borderRadius: 12, border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #e2e8f0', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Dòng 1: Sale dự kiến nhận */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar src={previewCons.consultant?.avatar} name={previewCons.consultant?.name || '?'} size={32} />
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Sale dự kiến nhận')}</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{previewCons.consultant?.name || t('Không có TVV hoạt động')}</div>
                    </div>
                  </div>

                  {!showOverrideSelector && !overrideConsId && (
                    <button
                      type="button"
                      onClick={() => setShowOverrideSelector(true)}
                      style={{
                        background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc',
                        border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme === 'dark' ? 'var(--color-surface)' : '#f1f5f9';
                        e.currentTarget.style.borderColor = theme === 'dark' ? 'var(--color-text-muted)' : '#94a3b8';
                        e.currentTarget.style.color = theme === 'dark' ? 'var(--color-text)' : '#334155';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = theme === 'dark' ? 'var(--color-bg)' : '#f8fafc';
                        e.currentTarget.style.borderColor = theme === 'dark' ? 'var(--color-border)' : '#cbd5e1';
                        e.currentTarget.style.color = theme === 'dark' ? 'var(--color-text-muted)' : '#64748b';
                      }}
                    >
                      Chỉ định Sale khác
                    </button>
                  )}
                </div>

                {(showOverrideSelector || !!overrideConsId) && (
                  <>
                    <hr style={{ border: 0, borderTop: '1px dashed var(--color-border)', margin: 0 }} />
                    {/* Dòng 2: Chỉ định Sale nhận (Override) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {(() => {
                        const selectedForceCons = consultants.find(c => String(c.id) === overrideConsId);
                        return (
                          <>
                            <Avatar src={selectedForceCons?.avatar} name={selectedForceCons?.name || '?'} size={32} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Chỉ định Sale nhận (Ép lượt)')}</div>
                              <div style={{ maxWidth: 240 }}>
                                <CustomSelect
                                  options={[
                                    { value: '', label: t('-- Chọn để ép (Override) --') },
                                    ...consultants
                                      .filter(c => !previewCons?.consultant || String(c.id) !== String(previewCons.consultant.consultant_id))
                                      .map(c => ({
                                        value: c.id.toString(),
                                        label: c.name + (c.status === 'leave' ? ` (${t('Nghỉ phép')})` : Number(c.vacation_mode) === 1 ? ` (${t('Tạm ngưng')})` : c.status === 'inactive' ? ` (${t('Nghỉ việc')})` : ''),
                                        avatar: c.avatar,
                                        disabled: c.status !== 'active' || Number(c.vacation_mode) === 1,
                                        disabledType: 'sale' as const
                                      }))
                                  ]}
                                  showAvatars={true}
                                  value={overrideConsId}
                                  onChange={val => setOverrideConsId(val.toString())}
                                  width="100%"
                                  direction="up"
                                />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                * Nếu bạn chọn ép (Override), người được chọn sẽ nhận Data này bất kể tỷ lệ vòng xoay.
              </div>

              {showOverrideSelector && previewCons.consultant && (
                <div style={{ marginTop: 12, padding: '12px 16px', background: theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : '#fefce8', border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid #fef08a', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.8125rem', color: theme === 'dark' ? '#fbbf24' : '#854d0e', fontWeight: 600 }}>
                      Tự động bù 1 lượt cho <strong style={{ color: theme === 'dark' ? '#f59e0b' : '#713f12' }}>{previewCons.consultant?.name}</strong> ở lượt tiếp theo
                    </div>
                    <div
                      className={`custom-toggle ${compensateSkipped ? 'active' : ''}`}
                      onClick={() => setCompensateSkipped(!compensateSkipped)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '1rem', background: theme === 'dark' ? 'var(--color-surface)' : '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', position: 'sticky', bottom: '-1.5rem', margin: '0 -1.5rem -1.5rem -1.5rem', zIndex: 10 }}>
        <button className="btn outline" onClick={() => setIsOpen(false)}>{t('Hủy')}</button>
        <button className="btn primary" onClick={handleManualSubmit} disabled={isSubmittingManual || (!manualData.phone && !manualData.email)} style={{ background: 'var(--color-primary)' }}>
          {isSubmittingManual ? t('Đang lưu...') : t('Lưu & Giao Data')}
        </button>
      </div>
    </CustomModal>
  );
};
