/** CSV helpers for the lead import: parsing, header mapping and the sample file. */

/** Parse CSV text (RFC 4180: quotes, "" escapes, commas / newlines inside quotes, CRLF, BOM). */
export function parseCsv(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

/** Accepted header names (lower-case, spaces / punctuation ignored) → field. */
const HEADERS = {
  company: ['company', 'companyname', 'organisation', 'organization', 'business'],
  contact: ['contact', 'contactperson', 'contactname', 'name', 'person', 'fullname'],
  email: ['email', 'emailaddress', 'mail'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'whatsapp', 'contactnumber'],
  services: ['services', 'service', 'requirement', 'requirements'],
  source: ['source', 'leadsource'],
  owner: ['owner', 'assignedto', 'salesperson', 'assignee'],
  status: ['status', 'stage'],
  value: ['value', 'dealvalue', 'amount', 'budget', 'expectedvalue'],
  notes: ['notes', 'note', 'remarks', 'comments', 'description'],
};
const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z]/g, '');

/** Map header cells to fields → { map: [field|null per column], missing: [required fields not found] }. */
export function mapHeaders(header) {
  const map = header.map((h) => {
    const n = norm(h);
    return Object.keys(HEADERS).find((f) => HEADERS[f].includes(n)) || null;
  });
  const missing = ['company', 'contact'].filter((f) => !map.includes(f));
  return { map, missing };
}

/** Data rows → objects with every field (strings). */
export function toRows(dataRows, map) {
  return dataRows.map((cells) => {
    const o = { company: '', contact: '', email: '', phone: '', services: '', source: '', owner: '', status: '', value: '', notes: '' };
    map.forEach((f, i) => { if (f && cells[i] != null) o[f] = String(cells[i]).trim(); });
    return o;
  });
}

export const SAMPLE_HEADER = ['Company', 'Contact', 'Email', 'Phone', 'Services', 'Source', 'Owner', 'Status', 'Value', 'Notes'];

/** Sample rows that use this portal's own services / sources / owners / stages. */
export function sampleRows({ services = [], sources = [], owners = [], stages = [] }) {
  const sv = (i) => services[i] || services[0] || 'Mobile App';
  return [
    SAMPLE_HEADER,
    ['Nova Labs Pvt Ltd', 'Asha Verma', 'asha@novalabs.in', '+91 98765 43210', `${sv(0)}; ${sv(1)}`, sources[0] || 'Website', owners[0] || '', stages[0] || 'New', '150000', 'Met at the startup expo'],
    ['Green Leaf Foods', 'Rahul Mehta', 'rahul@greenleaf.com', '+91 91234 56789', sv(1), sources[1] || sources[0] || 'Referral', owners[1] || owners[0] || '', stages[1] || stages[0] || 'New', '80000', 'Needs a quote by Friday'],
  ];
}
