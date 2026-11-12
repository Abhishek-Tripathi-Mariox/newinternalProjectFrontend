/**
 * Documents & attachments.
 *
 * Stored docs keep the store shape `{id, name, size, type, at, kind, url}` where `url` is the API
 * download path (`/api/v1/documents/:id/download`). Those need the access token, so opening /
 * downloading / thumbnails fetch the blob with auth and use an object URL.
 *
 * Files picked in a form before the entity exists are "pending": `{name, size, type, at, kind,
 * url: blob:…, file}` — `file` is the browser File, uploaded by the store action after saving.
 */
import { useEffect, useState } from 'react';
import { api, ms, request } from './client';
import { docKind, MAX_FILE } from '@/domain/files';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

/** API document DTO → store attachment. */
export const fromApiDoc = (d) => ({
  id: d.id, name: d.name, size: d.size, type: d.mime || '', at: ms(d.createdAt), kind: d.kind || 'Other', url: d.url,
});

/** True when the doc's url is an authenticated API path (not a local blob/data URL). */
export const isApiUrl = (url) => !!url && (url.startsWith(BASE) || url.startsWith('/api/'));

/** A doc picked in a form but not uploaded yet. */
export const isPending = (d) => !!(d && d.file);

/**
 * FileList / File[] → pending attachments (no upload yet). Files over 10 MB are skipped.
 * @returns {{atts: object[], skipped: number}}
 */
export function pendingFiles(list) {
  const files = Array.from(list || []).filter((f) => typeof File !== 'undefined' && f instanceof File);
  const ok = files.filter((f) => f.size <= MAX_FILE);
  const now = Date.now();
  const atts = ok.map((f, i) => ({ name: f.name, size: f.size, type: f.type || '', at: now + i, kind: docKind(f.name), url: URL.createObjectURL(f), file: f }));
  return { atts, skipped: files.length - ok.length };
}

/**
 * Upload pending attachments to `path` (e.g. `/projects/PR-101/documents`). Files are grouped by
 * kind (the endpoint takes one `kind` per request) unless `withKind` is false. Returns the
 * server's response for each request (doc arrays for projects / CRs, the bug detail for bugs).
 */
export async function uploadPending(path, atts, { withKind = true } = {}) {
  const list = (atts || []).filter(isPending);
  if (!list.length) return [];
  const groups = new Map();
  list.forEach((a) => {
    const k = withKind ? a.kind || 'Other' : '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a.file);
  });
  const out = [];
  for (const [kind, files] of groups) {
    // max 10 files per request
    for (let i = 0; i < files.length; i += 10) {
      out.push(await api.upload(path, files.slice(i, i + 10), kind ? { kind } : {}));
    }
  }
  return out;
}

/**
 * Bring an entity's saved docs in line with an edited list: delete removed docs, update changed
 * kinds and upload pending files to `uploadPath`. Returns the upload responses.
 */
export async function syncDocs(uploadPath, oldDocs, nextDocs) {
  const keep = new Map((nextDocs || []).filter((d) => d.id).map((d) => [d.id, d]));
  const jobs = [];
  (oldDocs || []).forEach((d) => {
    if (!d.id) return;
    const n = keep.get(d.id);
    if (!n) jobs.push(api.del(`/documents/${d.id}`));
    else if ((n.kind || 'Other') !== (d.kind || 'Other')) jobs.push(api.patch(`/documents/${d.id}`, { kind: n.kind }));
  });
  await Promise.all(jobs);
  return uploadPending(uploadPath, nextDocs);
}

/* ───────────── Authenticated blobs ───────────── */

const cache = new Map(); // api url → Promise<objectURL>

/** Fetch an API file with auth and return an object URL (cached for the session). */
export function blobUrl(url) {
  if (!isApiUrl(url)) return Promise.resolve(url);
  if (!cache.has(url)) {
    const path = url.startsWith(BASE) ? url.slice(BASE.length) : url.replace(/^\/api\/v\d+/, '');
    const p = request('GET', path, { raw: true })
      .then((res) => res.blob())
      .then((b) => URL.createObjectURL(b));
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url);
}

/** Save a document to disk. Resolves false when it failed. */
export async function downloadDoc(doc) {
  if (!doc || !doc.url) return false;
  try {
    const href = await blobUrl(doc.url);
    const a = document.createElement('a');
    a.href = href;
    a.download = doc.name || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/** Open a document in a new tab (the tab is opened synchronously so pop-up blockers allow it). */
export async function openDoc(doc) {
  if (!doc || !doc.url) return false;
  if (!isApiUrl(doc.url)) {
    window.open(doc.url, '_blank', 'noopener');
    return true;
  }
  const w = window.open('', '_blank');
  try {
    const href = await blobUrl(doc.url);
    if (w) w.location.href = href;
    else window.open(href, '_blank');
    return true;
  } catch {
    if (w) w.close();
    return false;
  }
}

/** Displayable URL for a doc (thumbnails): local URLs as-is, API files fetched with auth. */
export function useFileUrl(doc, enabled = true) {
  const url = doc && doc.url;
  const api$ = enabled && isApiUrl(url);
  const [state, setState] = useState({ key: null, src: '' });
  useEffect(() => {
    if (!api$) return undefined;
    let live = true;
    blobUrl(url).then((src) => { if (live) setState({ key: url, src }); }).catch(() => {});
    return () => { live = false; };
  }, [api$, url]);
  if (!enabled || !url) return '';
  if (!api$) return url;
  return state.key === url ? state.src : '';
}
