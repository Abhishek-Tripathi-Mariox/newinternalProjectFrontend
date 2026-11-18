import { fileSize } from '@/lib/format';
import { dLabel } from '@/lib/date';

/** Attachment meta line: size · added date · storage note. */
export const docMeta = (a) =>
  fileSize(a.size || 0) + (a.at ? ` · added ${dLabel(a.at)}` : '') + (a.url ? '' : ' · name only (too large to store)');

export const docSummary = (docs = []) =>
  docs.length
    ? `${docs.length} file${docs.length > 1 ? 's' : ''} · ${[...new Set(docs.map((d) => d.kind || 'Other'))].join(', ')}`
    : 'No files yet';

export const extOf = (name = '') => (name.split('.').pop() || 'file').toUpperCase().slice(0, 4);

/** True when a link starts with http(s)://. */
export const isValidUrl = (u = '') => /^https?:\/\//i.test(u.trim());
