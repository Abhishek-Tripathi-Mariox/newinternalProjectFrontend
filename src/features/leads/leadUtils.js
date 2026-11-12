import { QUOTE_STATUS } from '@/config/constants';
import { getLeadStatusNames, leadHue } from '@/store/masters';
import { avatarTone, tone, toneStrong } from '@/lib/color';
import { getOwners } from '@/store/owners';

/** Accepts either a DOM event or a raw value (UI-kit inputs may emit either). */
export const val = (x) => (x && typeof x === 'object' && 'target' in x ? x.target.value : x);

/** Owner display info (port of the original `owner(id)`). */
export function ownerOf(id) {
  const o = getOwners().find((x) => x.id === id) || { id, name: 'Unassigned', h: 265 };
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


