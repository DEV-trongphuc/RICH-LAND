/**
 * taskBodyParser.ts
 * Tiện ích bóc tách JSON an toàn và phục hồi định dạng văn bản cho các công việc trong RICH LAND.
 */

export interface ParsedChecklistItem {
  id?: string;
  title?: string;
  text: string;
  checked: boolean;
  done?: boolean;
  due_date?: string;
  assignee_id?: any;
  notified_sla?: boolean;
}

export interface ParsedTaskBody {
  description: string;
  pureDescription: string;
  checklist: ParsedChecklistItem[];
  links: any[];
  internal_type: string;
  scope: string;
  recurrence: any;
  project_id: any;
  campaign_id: any;
  team_id: any;
  due_sla_notified: boolean;
  subtask_sla_notified: boolean;
  rawMeta: Record<string, any>;
}

/**
 * Xử lý ngắt dòng, xuống đoạn tự động cho nội dung tiếng Việt bị dính liền chữ
 */
export function formatVietnameseDescription(rawText: string | null | undefined): string {
  if (!rawText) return '';

  let text = String(rawText).trim();

  // 1. Nếu text vô tình bị bọc trong chuỗi JSON (ví dụ "{\"due_sla_notified\":...}"), thử giải nén
  while (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed.erp_task?.description ?? parsed.description ?? parsed.body;
        if (typeof candidate === 'string') {
          text = candidate.trim();
        } else {
          break;
        }
      } else {
        break;
      }
    } catch {
      try {
        const sanitized = text.replace(/(\\)?([\r\n])/g, (match, slash, nl) => {
          return slash ? match : (nl === '\r' ? '\\r' : '\\n');
        });
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed === 'object') {
          const candidate = parsed.erp_task?.description ?? parsed.description ?? parsed.body;
          if (typeof candidate === 'string') {
            text = candidate.trim();
            continue;
          }
        }
      } catch {
        const descMatch = text.match(/"description":\s*"((?:[^"\\]|\\.)*)"/s);
        if (descMatch && descMatch[1]) {
          try {
            text = JSON.parse(`"${descMatch[1]}"`).trim();
          } catch {
            text = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
          }
        }
      }
      break;
    }
  }

  // Loại bỏ các cờ và mảnh JSON thô còn sót lại
  text = text.replace(/\{"due_sla_notified":\s*(?:true|false)[^}]*\}/gi, '');
  text = text.replace(/\{"subtask_sla_notified":\s*(?:true|false)[^}]*\}/gi, '');
  text = text.replace(/,?\s*"checklist":\s*\[[\s\S]*?\](?=,|}|\s*$)/gi, '');
  text = text.replace(/,?\s*"links":\s*\[[\s\S]*?\](?=,|}|\s*$)/gi, '');
  text = text.replace(/,?\s*"due_sla_notified":\s*(?:true|false)/gi, '');
  text = text.replace(/,?\s*"subtask_sla_notified":\s*(?:true|false)/gi, '');
  text = text.replace(/,?\s*"internal_type":\s*"[^"]*"/gi, '');
  text = text.replace(/,?\s*"scope":\s*"[^"]*"/gi, '');
  text = text.replace(/,?\s*"recurrence":\s*\{[\s\S]*?\}(?=,|}|\s*$)/gi, '');
  text = text.replace(/,?\s*"misa_stt":\s*(?:"[^"]*"|\d+)/gi, '');
  text = text.replace(/\[MISA_IMPORT\]/g, '');
  text = text.replace(/Project:\s*ALL IN ONE\s*-\s*VẬN HÀNH/gi, '');
  text = text.replace(/^[\s,{}]+/, '').replace(/[\s,{}]+$/, '');

  // 2. Tách trước các emoji đề mục phổ biến: 🎯, 📚, 🎥, 👉, 📌, 💡, ❗, 📞, ✅, ❌, ⚠️, 🔹, 🔸, ⭐, 🔥
  const emojiRegex = /([^\n\r\s])(\s*)([🎯📚🎥👉📌💡❗📞✅❌⚠️🔹🔸⭐🔥])/gu;
  text = text.replace(emojiRegex, '$1\n\n$3');

  // 3. Tách trước các từ khóa đề mục phổ biến khi dính liền văn bản trước đó
  const sectionKeywords = [
    'Ví dụ:', 'Ví dụ:', 'Lưu ý:', 'Lưu ý:', 'Ghi chú:', 'Ghi chú:',
    'Mục tiêu:', 'Mục tiêu:', 'Nhiệm vụ:', 'Nhiệm vụ:', 'Yêu cầu:', 'Yêu cầu:',
    'Dự định:', 'Dự định:', 'Dùng để:', 'Dùng để:', 'Mà để:', 'Mà để:',
    'Insight chính:', 'Hàm ý:', 'Hàm ý:', 'Quan điểm quan trọng:',
    'Áp dụng cách:', 'Sau đó xem lại:', 'Mỗi người cần:', 'Mỗi người cần:',
    'Nhấn mạnh:', 'Nhán mạnh:', 'Phản ứng từ khách hàng:', 'Thực tế phản hồi:',
    'Tự nhìn lại bản thân:', 'Không phải để:', 'Kỹ năng:', 'Kỹ năng:'
  ];

  for (const kw of sectionKeywords) {
    const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp(`([^\\n\\r])(\\s*)(${kwEscaped})`, 'gu');
    text = text.replace(kwRegex, '$1\n\n$3');
  }

  // 4. Tách sau dấu hai chấm ':' của đề mục nếu dính liền với nội dung sau
  text = text.replace(/(Ví dụ:|Ví dụ:|Lưu ý:|Lưu ý:|Ghi chú:|Ghi chú:|Dùng để:|Mà để:|Dự định:|Áp dụng cách:|Hàm ý:)([A-ZÀ-ỸĐa-zà-ỹđ0-9🎯📚🎥👉📌💡❗📞])/gu, '$1\n$2');

  // 5. Tách ngày tháng năm dính liền chữ hoa
  text = text.replace(/(\b\d{1,2}\/\d{1,2}\/\d{4})([A-ZÀ-ỸĐ])/gu, '$1\n$2');

  // 6. Tách sau dấu câu chấm, chấm than, chấm hỏi nếu dính liền với chữ hoa bắt đầu câu mới
  text = text.replace(/([^0-9A-Za-zÀ-ỸĐà-ỹđ]|^|[a-zà-ỹđ]{2,})([.!?])([A-ZÀ-ỸĐ])/gu, (match, prefix, punc, nextChar) => {
    if (prefix.toLowerCase().endsWith('tp') || prefix.toLowerCase().endsWith('ths') || prefix.toLowerCase().endsWith('ts')) {
      return match;
    }
    return `${prefix}${punc}\n${nextChar}`;
  });

  // 7. Thêm khoảng trắng sau dấu phẩy nếu dính liền chữ
  text = text.replace(/([a-zà-ỹđA-ZÀ-ỸĐ0-9]),([a-zà-ỹđA-ZÀ-ỸĐ0-9])/gu, '$1, $2');

  // 8. Chuẩn hóa nhiều dòng trắng liên tiếp thành tối đa 2 dòng trắng
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Chuyển đổi văn bản thuần có ngắt dòng thành HTML an toàn với thẻ <p> hoặc <br/>
 */
export function convertTextToHtmlParagraphs(text: string): string {
  if (!text) return '';
  if (text.includes('<p>') || text.includes('<br>') || text.includes('<br/>')) {
    return text;
  }

  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map(p => {
      const lineWithBreaks = p.trim().replace(/\n/g, '<br/>');
      return `<p>${lineWithBreaks}</p>`;
    })
    .join('');
}

/**
 * Bóc tách activities.body một cách toàn diện và an toàn
 */
export function parseTaskBody(rawBody: string | null | undefined): ParsedTaskBody {
  const result: ParsedTaskBody = {
    description: '',
    pureDescription: '',
    checklist: [],
    links: [],
    internal_type: 'task',
    scope: 'team',
    recurrence: { pattern: 'none', weekly_days: [], monthly_day: 1, days_interval: 3, last_generated: '' },
    project_id: null,
    campaign_id: null,
    team_id: null,
    due_sla_notified: false,
    subtask_sla_notified: false,
    rawMeta: {}
  };

  if (!rawBody) return result;

  let currentStr = String(rawBody).trim();
  let parsedJson: any = null;

  while (currentStr.startsWith('{') && currentStr.endsWith('}')) {
    try {
      const p = JSON.parse(currentStr);
      if (p && typeof p === 'object') {
        parsedJson = p;
        if (p.erp_task && typeof p.erp_task === 'object') {
          Object.assign(result.rawMeta, p.erp_task);
        }
        Object.assign(result.rawMeta, p);

        if (p.due_sla_notified !== undefined) result.due_sla_notified = Boolean(p.due_sla_notified);
        if (p.erp_task?.due_sla_notified !== undefined) result.due_sla_notified = Boolean(p.erp_task.due_sla_notified);
        if (p.subtask_sla_notified !== undefined) result.subtask_sla_notified = Boolean(p.subtask_sla_notified);
        if (p.erp_task?.subtask_sla_notified !== undefined) result.subtask_sla_notified = Boolean(p.erp_task.subtask_sla_notified);

        const innerDesc = p.erp_task?.description ?? p.description;
        if (typeof innerDesc === 'string') {
          currentStr = innerDesc.trim();
        } else {
          break;
        }
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (parsedJson) {
    const meta = parsedJson.erp_task || parsedJson;
    if (meta.internal_type) result.internal_type = meta.internal_type;
    if (meta.scope) result.scope = meta.scope;
    if (meta.recurrence) result.recurrence = meta.recurrence;
    if (Array.isArray(meta.checklist)) {
      result.checklist = meta.checklist.map((item: any) => ({
        ...item,
        text: item.text || item.title || '',
        checked: Boolean(item.checked || item.done)
      }));
    }
    if (Array.isArray(meta.links)) result.links = meta.links;
    if (meta.project_id) result.project_id = meta.project_id;
    if (meta.campaign_id) result.campaign_id = meta.campaign_id;
    if (meta.team_id) result.team_id = meta.team_id;
  }

  // Trích xuất link đính kèm dạng text thuần nếu có
  const matchLink = currentStr.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m);
  if (matchLink && matchLink[1]) {
    const extractedUrl = matchLink[1].trim();
    if (extractedUrl && !result.links.some(l => (typeof l === 'string' ? l : l.url) === extractedUrl)) {
      result.links.push({ label: 'Tài liệu đính kèm', title: 'Tài liệu đính kèm', url: extractedUrl, is_file: true });
    }
    currentStr = currentStr.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
  }

  // Trích xuất danh sách tệp đính kèm dạng bullet hoặc pattern file name (url)
  const fileRegex = /([^\n\r(•]+)\s*\((https?:\/\/[^\s)]+|\/backend\/[^\s)]+|uploads\/[^\s)]+)\)/gi;
  for (const m of currentStr.matchAll(fileRegex)) {
    const rawName = m[1].replace(/^[•\-\s]+/, '').trim();
    const rawUrl = m[2].trim();
    if (rawUrl && !result.links.some(l => (typeof l === 'string' ? l : (l.url || l.href)) === rawUrl)) {
      result.links.push({
        label: rawName || rawUrl.split('/').pop() || 'Tệp đính kèm',
        name: rawName || rawUrl.split('/').pop() || 'Tệp đính kèm',
        url: rawUrl,
        is_file: true
      });
    }
  }
  currentStr = currentStr.replace(/\[Tài liệu đính kèm[^\]]*\]:[\s\S]*$/gi, '').trim();

  // Phục hồi ngắt dòng và định dạng văn bản
  const formatted = formatVietnameseDescription(currentStr);
  result.description = formatted;
  result.pureDescription = formatted;

  return result;
}

/**
 * Trích xuất mô tả ngắn gọn, sạch sẽ cho thẻ công việc ở Bàn làm việc
 */
export function extractCleanCardDescription(rawBody: string | null | undefined): string {
  if (!rawBody) return '';
  const parsed = parseTaskBody(rawBody);
  let desc = parsed.pureDescription || parsed.description || '';

  desc = desc.replace(/<[^>]*>/g, ' ');
  desc = desc.replace(/\s+/g, ' ').trim();

  desc = desc.replace(/,?\s*"(?:checklist|links|due_sla_notified|subtask_sla_notified|internal_type|scope|recurrence|misa_stt)":[^,}]*/gi, '');
  desc = desc.replace(/\{"[^"]+":[^}]+\}/g, '').trim();
  desc = desc.replace(/\{"due_sla_notified":\s*(?:true|false)[^}]*\}/gi, '');
  desc = desc.replace(/\{"subtask_sla_notified":\s*(?:true|false)[^}]*\}/gi, '');
  desc = desc.replace(/^[\s,{}]+|[\s,{}]+$/g, '').trim();

  return desc;
}

/**
 * Tính toán tiến độ thực tế chính xác của công việc (dựa trên DB progress hoặc checklist hoàn thành)
 */
export function getTaskEffectiveProgress(task: any): number {
  if (!task) return 0;
  if (task.status === 'done' || task.status === 'completed') return 100;
  if (Number(task.progress) >= 100) return 100;

  if (task.body) {
    const parsed = parseTaskBody(task.body);
    const checklistTotal = parsed.checklist?.length || 0;
    if (checklistTotal > 0) {
      const checklistDone = parsed.checklist.filter((c: any) => c.done || c.checked).length;
      return Math.round((checklistDone / checklistTotal) * 100);
    }
  }
  return Number(task.progress) || 0;
}

/**
 * Xác định chính xác một công việc đã hoàn thành hay chưa (100% checklist, 100% progress, hoặc status = done)
 */
export function isTaskEffectivelyDone(task: any): boolean {
  if (!task) return false;
  if (task.status === 'done' || task.status === 'completed') return true;
  if (Number(task.progress) >= 100) return true;
  return getTaskEffectiveProgress(task) >= 100;
}

/**
 * Tự động nhận diện công việc cá nhân
 */
export function isTaskPersonalForUser(task: any, currentUserId: number | string | null | undefined): boolean {
  if (!task || !currentUserId) return false;
  const uid = Number(currentUserId);
  if (uid <= 0) return false;

  const taskUid = Number(task.user_id || 0);
  const taskCreatedBy = Number(task.created_by || 0);

  if (taskUid !== uid && taskCreatedBy !== uid) {
    return false;
  }

  const tagsStr = String(task.tags || '').toLowerCase();
  if (tagsStr.includes('personal_task') || tagsStr.includes('ca_nhan') || tagsStr.includes('personal') || task.scope === 'personal') {
    return true;
  }

  if (task.participant_ids) {
    const pIds = String(task.participant_ids).split(',').map(s => Number(s.trim())).filter(id => id > 0 && id !== uid);
    if (pIds.length > 0) return false;
  }

  if (Number(task.require_approval) === 1) {
    const approverId = Number(task.approver_id || 0);
    if (approverId > 0 && approverId !== uid) return false;
  }

  if (task.body && typeof task.body === 'string' && task.body.includes('"assignee_id"')) {
    const parsed = parseTaskBody(task.body);
    if (parsed.checklist && parsed.checklist.length > 0) {
      const hasOtherSubAssignee = parsed.checklist.some((c: any) => {
        const cAssignee = Number(c.assignee_id || 0);
        return cAssignee > 0 && cAssignee !== uid;
      });
      if (hasOtherSubAssignee) return false;
    }
  }

  if (task.related_type && ['contact', 'deal', 'company'].includes(task.related_type)) {
    return false;
  }
  if (task.scope === 'company' || task.scope === 'all') {
    return false;
  }

  return true;
}
