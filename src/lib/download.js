/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

/** Build and download a CSV (with BOM so Excel reads UTF-8). */
export function downloadCsv(rows, filename, { bom = true } = {}) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  downloadBlob(new Blob([(bom ? '﻿' : '') + csv], { type: 'text/csv' }), filename);
}

/** Open a new window with HTML and print it. Returns false if pop-ups are blocked. */
export function printHtml(html) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

export const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
