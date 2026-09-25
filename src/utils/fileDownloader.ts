/**
 * src/utils/fileDownloader.ts
 * Utility to download files with automatic WebP -> JPG format conversion.
 */

export function isWebpFile(fileNameOrUrl: string): boolean {
  if (!fileNameOrUrl) return false;
  const clean = fileNameOrUrl.split('?')[0].toLowerCase();
  return clean.endsWith('.webp') || clean.includes('.webp');
}

export async function convertWebpBlobToJpgBlob(blob: Blob, quality = 0.92): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error('Image failed to load for canvas conversion: ' + e));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const jpgBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });

    if (!jpgBlob) throw new Error('Canvas toBlob failed');
    return jpgBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function convertUrlToJpgBlob(url: string, quality = 0.92): Promise<Blob> {
  let fetchUrl = url;
  try {
    const response = await fetch(fetchUrl, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      return await convertWebpBlobToJpgBlob(blob, quality);
    }
  } catch (fetchErr) {
    console.warn('Fetch failed for image, falling back to direct Image loader:', fetchErr);
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = fetchUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const jpgBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  if (!jpgBlob) throw new Error('Canvas conversion to JPG failed');
  return jpgBlob;
}

function resolveFetchableUrl(url: string): string {
  let resolvedUrl = url;
  if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://') && !resolvedUrl.startsWith('blob:')) {
    const apiBase = (import.meta.env.VITE_API_URL || '/backend').replace(/\/$/, '');
    const cleanPath = resolvedUrl.replace(/^\/?(backend\/)?/, '');
    resolvedUrl = `${apiBase}/${cleanPath}`;
  }
  return resolvedUrl;
}

export async function downloadFileWithName(url: string, originalFileName: string): Promise<void> {
  if (!url) return;

  const isCloudOrExternal = 
    /drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be/i.test(url) ||
    (/^https?:\/\//i.test(url) && !url.includes('/uploads/') && !url.includes(window.location.host));

  if (isCloudOrExternal) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  let cleanName = (originalFileName || '').trim();
  cleanName = cleanName.replace(/\s*\(\s*[\d.]+\s*(?:KB|MB|GB|Bytes|B|b)\s*\)$/i, '').trim();

  if (!cleanName) {
    cleanName = url.split('/').pop()?.split('?')[0] || 'tai-ve';
  }

  const urlExt = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1];
  const nameExt = cleanName.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (!nameExt && urlExt) {
    cleanName = `${cleanName}.${urlExt}`;
  }

  if (isWebpFile(cleanName) || isWebpFile(url)) {
    return downloadFileWithWebpToJpg(url, cleanName);
  }

  const fetchUrl = resolveFetchableUrl(url);

  try {
    const res = await fetch(fetchUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return;
    }
  } catch (err) {
    console.warn('Blob fetch failed, falling back to server download-file endpoint:', err);
  }

  const token = localStorage.getItem('token') || '';
  const backendBase = (import.meta.env.VITE_API_URL || '/backend').replace(/\/$/, '');
  const downloadEndpoint = `${backendBase}/api.php?action=download-file&url=${encodeURIComponent(url)}&name=${encodeURIComponent(cleanName)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadEndpoint;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadFileWithWebpToJpg(url: string, originalFileName: string): Promise<void> {
  if (!url) return;

  const isWebp = isWebpFile(originalFileName) || isWebpFile(url);

  if (!isWebp) {
    return downloadFileWithName(url, originalFileName);
  }

  const jpgFileName = originalFileName.replace(/\.webp$/i, '.jpg');

  try {
    const jpgBlob = await convertUrlToJpgBlob(url, 0.92);
    const downloadUrl = URL.createObjectURL(jpgBlob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = jpgFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 15000);
  } catch (err) {
    console.error('Lỗi khi chuyển đổi WebP sang JPG:', err);
    return downloadFileWithName(url, jpgFileName);
  }
}

export function initAttachmentDownloadInterceptor(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__attachmentDownloadInterceptorInit) return;
  (window as any).__attachmentDownloadInterceptorInit = true;

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const chip = target.closest<HTMLElement>('.comment-attachment-chip, a[data-file-url], a[data-file-name], .task-attachment-item, [data-attachment-download], a.attachment-link, a.download-link');
    if (!chip) return;

    if (target.closest('button.btn-delete-link, button.remove-chip, button.btn-remove, [data-remove-attachment], a.btn-external-link')) return;

    if (chip.classList.contains('task-attachment-item') && !target.closest('.btn-download-link, [data-attachment-download]')) {
      const testUrl = chip.getAttribute('data-file-url') || chip.getAttribute('href') || '';
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf)($|\?)/i.test(testUrl)) {
        return;
      }
    }

    const fileUrl = chip.getAttribute('data-file-url') || chip.getAttribute('href');
    if (!fileUrl || fileUrl === '#' || fileUrl.startsWith('javascript:')) return;

    e.preventDefault();
    e.stopPropagation();

    let fileName = chip.getAttribute('data-file-name') || chip.getAttribute('download') || '';
    if (!fileName || fileName === 'true') {
      const spans = Array.from(chip.querySelectorAll('span'));
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        if (text && !text.startsWith('(') && text.length > 2) {
          fileName = text;
          break;
        }
      }
    }

    if (!fileName) {
      const fullText = chip.textContent || '';
      fileName = fullText.replace(/\s*\(\s*[\d.]+\s*(?:KB|MB|GB|Bytes|B|b)\s*\)/i, '').trim();
    }

    downloadFileWithName(fileUrl, fileName);
  }, true);
}
