/**
 * Reliable file download utilities.
 *
 * IMPORTANT: Browser download security requires that the <a>.click() call
 * happens synchronously within the user gesture (click event) call stack.
 * Using async/await between the click handler and the actual download will
 * break the user gesture chain and cause the browser to silently block
 * the download.
 *
 * Rules:
 *  - downloadFromDataUrl: synchronous (atob → Blob, no fetch)
 *  - downloadFromUrl: synchronous <a href=url>.click() for same-origin
 */

import { withBasePath } from './url';

/**
 * Trigger a browser download by creating a temporary <a> element.
 * Must be called synchronously within a user gesture to work reliably.
 */
function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.style.display = 'none';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  // Small delay before cleanup so the browser can initiate the download.
  setTimeout(() => {
    document.body.removeChild(a);
    // Revoke only if it's a blob URL
    if (href.startsWith('blob:')) {
      URL.revokeObjectURL(href);
    }
  }, 3000);
}

/**
 * Download a file from an API endpoint (same-origin URL).
 * Synchronous — directly navigates the <a> to the server URL.
 * The server's Content-Disposition: attachment header triggers download.
 */
export function downloadFromUrl(url: string, filename: string): void {
  const fullUrl = url.startsWith('http') ? url : withBasePath(url);
  triggerDownload(fullUrl, filename);
}

/**
 * Download a data-URL (e.g. from html-to-image / canvas) as a file.
 * Synchronously converts the data URL to a Blob URL to avoid
 * browser data-URL size limits AND preserve the user gesture chain.
 */
export function downloadFromDataUrl(dataUrl: string, filename: string): void {
  // Parse "data:[<mediatype>][;base64],<data>"
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return;

  const header = dataUrl.slice(0, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const isBase64 = header.includes(';base64');

  let blob: Blob;
  if (isBase64) {
    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = new Blob([decodeURIComponent(data)], { type: mime });
  }

  const blobUrl = URL.createObjectURL(blob);
  triggerDownload(blobUrl, filename);
}
