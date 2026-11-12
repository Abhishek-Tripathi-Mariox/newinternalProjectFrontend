/**
 * HTTP client for the Mariox Portal API.
 *
 * - Access token lives in memory only (never localStorage); the refresh token is an httpOnly
 *   cookie the browser sends to /auth/* automatically.
 * - On 401 the client refreshes once (concurrent requests share one refresh) and retries.
 * - Errors are thrown as ApiError with the server's message (already in the UI's wording).
 */
const BASE = import.meta.env.VITE_API_URL || '/api/v1';

let accessToken = null;
let refreshing = null;
let onSessionExpired = () => {};

export const setAccessToken = (t) => { accessToken = t || null; };
export const getAccessToken = () => accessToken;
/** Called when refresh fails (signed out elsewhere / expired) — the store clears the session. */
export const onExpired = (fn) => { onSessionExpired = fn; };

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Refresh the access token using the refresh cookie. Returns the new session or null. */
export async function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        // 204 = no refresh cookie (signed out); 401 = expired / revoked session.
        if (!r.ok || r.status === 204) return null;
        const body = await r.json();
        setAccessToken(body.data.accessToken);
        return body.data;
      })
      .catch(() => null)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

function buildUrl(path, query) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.set(k, v);
    });
  }
  return url.toString();
}

async function parse(res) {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json();
  return res.text();
}

/**
 * request('GET', '/leads', { query, body, form, raw })
 * - body → JSON, form → FormData (uploads), raw → return the fetch Response (downloads)
 * Returns the parsed envelope `{ data, meta }` (or text for HTML/CSV).
 */
export async function request(method, path, { query, body, form, raw, retry = true } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server — check your connection and try again');
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const s = await refreshSession();
    if (s) return request(method, path, { query, body, form, raw, retry: false });
    onSessionExpired();
  }
  if (raw && res.ok) return res;

  const data = await parse(res);
  if (!res.ok) {
    const e = (data && data.error) || {};
    const msg = e.code === 'VALIDATION_ERROR' && Array.isArray(e.details) && e.details[0]
      ? `${e.details[0].message}`
      : e.message || `Request failed (${res.status})`;
    throw new ApiError(res.status, e.code || 'HTTP_ERROR', msg, e.details);
  }
  return data;
}

export const api = {
  get: (path, query) => request('GET', path, { query }).then((r) => r && r.data),
  /** GET returning { data, meta } (lists). */
  page: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }).then((r) => r && r.data),
  patch: (path, body) => request('PATCH', path, { body }).then((r) => r && r.data),
  put: (path, body) => request('PUT', path, { body }).then((r) => r && r.data),
  del: (path) => request('DELETE', path).then((r) => r && r.data),
  upload: (path, files, extra = {}) => {
    const form = new FormData();
    Array.from(files || []).forEach((f) => form.append('files', f));
    Object.entries(extra).forEach(([k, v]) => form.append(k, v));
    return request('POST', path, { form }).then((r) => r && r.data);
  },
  /** Raw text (HTML print views). */
  text: (path, query) => request('GET', path, { query }),
};

/**
 * Fetch every page of a list endpoint (pageSize 100) and return all rows.
 * Used by the bootstrap loaders — the UI computes its views from full collections.
 */
export async function getAll(path, query = {}) {
  const first = await request('GET', path, { query: { ...query, page: 1, pageSize: 100 } });
  const rows = first.data || [];
  const pages = (first.meta && first.meta.pageCount) || 1;
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) =>
      request('GET', path, { query: { ...query, page: i + 2, pageSize: 100 } })));
    rest.forEach((r) => rows.push(...(r.data || [])));
  }
  return rows;
}

/** Download a file / CSV from an authenticated endpoint and save it. */
export async function download(path, query, filename) {
  const res = await request('GET', path, { query, raw: true });
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || (m ? decodeURIComponent(m[1]) : 'download');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Open an authenticated HTML print view (quotes, CR approvals) in a new tab. Returns false if pop-ups are blocked. */
export async function openPrint(path) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const html = await api.text(path);
  w.document.write(typeof html === 'string' ? html : '');
  w.document.close();
  setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
  return true;
}

/** Parse an ISO timestamp to ms (null-safe). */
export const ms = (iso) => (iso ? new Date(iso).getTime() : null);
/** Parse a 'YYYY-MM-DD' calendar day to the local start-of-day ms the UI uses. */
export const dayMs = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime() : null);
/** Local start-of-day ms → 'YYYY-MM-DD'. */
export const toDay = (t) => {
  if (t == null) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** ms → ISO string. */
export const iso = (t) => (t == null ? null : new Date(t).toISOString());
