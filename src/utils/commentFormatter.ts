/**
 * commentFormatter.ts
 * Standardizes comment bodies, cleans up legacy emoji file attachments,
 * and renders document attachments in structured, beautiful single-row badges.
 */

export const getFileBadgeInfo = (filename: string): { label: string; cls: string } => {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return { label: 'PDF', cls: 'badge-pdf' };
  if (['doc', 'docx'].includes(ext)) return { label: 'DOCX', cls: 'badge-docx' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'XLSX', cls: 'badge-xlsx' };
  if (['ppt', 'pptx'].includes(ext)) return { label: 'PPTX', cls: 'badge-pptx' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { label: 'ZIP', cls: 'badge-zip' };
  if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext)) return { label: 'IMG', cls: 'badge-img' };
  return { label: ext.toUpperCase() || 'FILE', cls: 'badge-default' };
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DOWNLOAD_ICON_SVG = `<span class="file-doc-action-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>`;

/**
 * Transforms raw comment body into rich HTML with sanitized badges and single-row file attachments.
 */
export function formatCommentBody(body?: string): string {
  if (!body) return '';

  let html = String(body);

  // 1. Transform existing <a class="comment-attachment-chip"...>
  html = html.replace(/<a([^>]*?class=["'][^"']*?comment-attachment-chip[^"']*?["'][^>]*?)>([\s\S]*?)<\/a>/gi, (match, attrs, innerContent) => {
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    const dataUrlMatch = attrs.match(/data-file-url=["']([^"']*)["']/i);
    const dataNameMatch = attrs.match(/data-file-name=["']([^"']*)["']/i);

    let url = dataUrlMatch ? dataUrlMatch[1] : (hrefMatch ? hrefMatch[1] : '#');
    let fileName = dataNameMatch ? dataNameMatch[1] : '';

    if (!fileName) {
      const textOnly = innerContent.replace(/<[^>]*>/g, '').trim();
      const fnMatch = textOnly.match(/([a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9\s\(\)]+\.[a-zA-Z0-9]{2,5})/);
      if (fnMatch) {
        fileName = fnMatch[1].trim();
      } else {
        fileName = textOnly.replace(/^[📕📄📊📝📦🖼️📎\s]+/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    }

    let sizeText = '';
    const sizeMatch = innerContent.match(/\(([0-9.]+\s*(?:B|KB|MB|GB))\)/i);
    if (sizeMatch) {
      sizeText = `(${sizeMatch[1]})`;
    }

    const { label, cls } = getFileBadgeInfo(fileName || 'file');

    return `<div class="comment-attachment-chip-row"><a href="${url}" data-file-url="${url}" data-file-name="${fileName}" download="${fileName}" target="_blank" rel="noopener noreferrer" class="comment-attachment-chip" title="Tải về / Mở: ${fileName}"><span class="file-doc-badge ${cls}">${label}</span><span class="file-doc-name">${fileName}</span>${sizeText ? `<span class="file-doc-size">${sizeText}</span>` : ''}${DOWNLOAD_ICON_SVG}</a></div>`;
  });

  // 2. Transform legacy plain text with emoji files
  const emojiFileRegex = /([📕📄📊📝📦🖼️📎])\s*([a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9\.\s]+\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|png|jpg|jpeg|webp))(?:\s*\(([0-9.]+\s*(?:B|KB|MB|GB))\))?/gi;
  html = html.replace(emojiFileRegex, (match, emoji, fileName, ext, size) => {
    const cleanFileName = fileName.trim();
    const { label, cls } = getFileBadgeInfo(cleanFileName);
    const sizeText = size ? `(${size.trim()})` : '';
    return `<div class="comment-attachment-chip-row"><span class="comment-attachment-chip"><span class="file-doc-badge ${cls}">${label}</span><span class="file-doc-name">${cleanFileName}</span>${sizeText ? `<span class="file-doc-size">${sizeText}</span>` : ''}</span></div>`;
  });

  return html;
}
