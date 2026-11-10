/**
 * Follow-up view helpers shared by the page, the row renderer and the modal.
 */
import { OWNERS, FU_TYPES, PRIORITIES, REMINDERS, FU_DEFAULTS } from '@/config/constants';
import { avatarTone, tone, RED, INK } from '@/lib/color';
import { DAY, range, dLabel, tLabel } from '@/lib/date';
import { calendarLink } from './calendarLink';
import { initials } from '@/lib/format';

export const EMPTY_FF = { q: '', type: '', owner: '', priority: '', meet: '', date: 'all', from: '', to: '' };

export const TYPE_NAMES = Object.keys(FU_TYPES);

/** Sales owner with avatar colours (unknown id → "Unassigned"). */
export function ownerOf(id) {
  const o = OWNERS.find((x) => x.id === id) || { id: '', name: 'Unassigned', h: 265 };
  return { ...o, ini: initials(o.name), ...avatarTone(o.h) };
}

export const typeHue = (t) => FU_TYPES[t] ?? 265;
export const prioHue = (p) => PRIORITIES[p] ?? 220;

/** Soft type tag colours. */
export const typeTone = (t) => tone(typeHue(t));
/** Priority pill colours (slightly darker text than the generic tone). */
export const prioTone = (p) => {
  const h = prioHue(p);
  return { bg: `oklch(0.95 0.035 ${h})`, fg: `oklch(0.45 0.13 ${h})` };
};

export const remindLabel = (r) => (REMINDERS.find((x) => x[0] === +r) || [0, '—'])[1];

export const isOverdue = (f, now) => !f.done && f.due < now;

/** Status tabs in display order with their predicates. */
export const FU_TABS = [
  { key: 'today', label: 'Today', test: (f, T) => !f.done && f.due >= T && f.due < T + DAY },
  { key: 'upcoming', label: 'Upcoming', test: (f, T) => !f.done && f.due >= T + DAY },
  { key: 'overdue', label: 'Overdue', test: (f, T, now) => !f.done && f.due < now },
  { key: 'completed', label: 'Completed', test: (f) => f.done },
  { key: 'all', label: 'All', test: () => true },
];
export const tabTest = (key) => (FU_TABS.find((t) => t.key === key) || FU_TABS[4]).test;

/** Apply the shared follow-up filter bar (`ff`) — original `fb`. */
export function filterFollowUps(fus, ff, leadMap) {
  const rg = range(ff.date, ff.from, ff.to);
  const q = (ff.q || '').trim().toLowerCase();
  return fus.filter((f) =>
    (!rg || (f.due >= rg[0] && f.due < rg[1])) &&
    (!ff.type || f.type === ff.type) &&
    (!ff.owner || f.owner === ff.owner) &&
    (!ff.priority || f.prio === ff.priority) &&
    (!ff.meet || (ff.meet === 'yes') === !!f.meet) &&
    (!q || `${f.title} ${leadMap[f.leadId] ? leadMap[f.leadId].company : ''}`.toLowerCase().includes(q)));
}

export const hasActiveFilters = (ff) => !!(ff.q || ff.type || ff.owner || ff.priority || ff.meet || ff.date !== 'all');

/** Modal defaults per type as strings: [dur, remind, meet]. */
export const typeDefaults = (t) => {
  const d = FU_DEFAULTS[t] || FU_DEFAULTS.Meeting;
  return { dur: String(d[0]), remind: String(d[1]), meet: d[2] };
};

/** "3pm" / "3:30pm" for calendar chips. */
export const shortTime = (label) => label.replace(':00', '').replace(' ', '').toLowerCase();

/**
 * Derive everything a follow-up row displays (port of the original `fuRow`).
 * Exported so other features can reuse the same labels without the markup.
 */
export function describeFollowUp(f, lead, now = Date.now()) {
  const od = isOverdue(f, now);
  return {
    lead,
    company: lead ? lead.company : 'Internal',
    owner: ownerOf(f.owner),
    type: typeTone(f.type),
    prio: prioTone(f.prio),
    overdue: od,
    dueDate: (od ? 'Overdue · ' : '') + dLabel(f.due),
    dueTime: tLabel(f.due),
    durLabel: f.dur ? ` · ${f.dur} min` : '',
    dueColor: od ? RED : INK,
    remindLabel: remindLabel(f.remind),
    calUrl: calendarLink(f, lead),
  };
}

