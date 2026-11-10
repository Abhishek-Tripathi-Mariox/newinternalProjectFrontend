import { OWNERS, QUOTE_STATUS } from '@/config/constants';
import { getLeadStatusNames, leadHue } from '@/store/masters';
import { avatarTone, tone, toneStrong } from '@/lib/color';
import { downloadCsv } from '@/lib/download';

/** Accepts either a DOM event or a raw value (UI-kit inputs may emit either). */
export const val = (x) => (x && typeof x === 'object' && 'target' in x ? x.target.value : x);

/** Owner display info (port of the original `owner(id)`). */
export function ownerOf(id) {
  const o = OWNERS.find((x) => x.id === id) || { id, name: 'Unassigned', h: 265 };
  return { id: o.id, name: o.name, h: o.h, ini: o.name.split(' ').map((w) => w[0]).join(''), ...avatarTone(o.h) };
}

/** Status tone (port of the original `st(k)`). */
export const statusTone = (k) => tone(leadHue(k));

export const quoteTone = (status) => toneStrong(QUOTE_STATUS[status] ?? 265);

export const sumValue = (list) => list.reduce((a, l) => a + (l.value || 0), 0);

export const isOpenLead = (l) => l.status !== 'Won' && l.status !== 'Lost';

export const statusOrder = (k) => getLeadStatusNames().indexOf(k);

/** Empty lead filter (original "Clear filters"). */
export const EMPTY_LF = { q: '', date: 'all', from: '', to: '', owner: '', source: '', service: '', status: '', flag: '' };

const isoDay = (x) => new Date(x).toISOString().slice(0, 10);

/**
 * Download leads as CSV (port of `exportLeadsCsv`). Returns the flash message.
 * @param {object[]} list leads
 * @param {Record<string,number>} scoreOf
 * @param {Record<string,number>} touch last-contact timestamps
 */
export function exportLeadsCsv(list, scoreOf, touch) {
  const cols = ['ID', 'Company', 'Contact', 'Email', 'Phone', 'Service', 'Source', 'Owner', 'Stage', 'Value (INR)', 'Score', 'Created', 'Last contact'];
  const rows = list.map((l) => [
    l.id, l.company, l.contact, l.email, l.phone, l.service, l.source, ownerOf(l.owner).name, l.status, l.value,
    scoreOf[l.id], isoDay(l.created), isoDay(touch[l.id] ?? l.created),
  ]);
  downloadCsv([cols, ...rows], `mariox-leads-${isoDay(Date.now())}.csv`, { bom: true });
  return `Exported ${list.length} leads to CSV`;
}
