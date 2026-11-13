/**
 * Pure view helpers shared by the Projects feature (tabs, drawer, modals).
 * Everything here mirrors the original prototype's pv() helpers 1:1.
 */
import { GREEN, MUTED, PRIMARY } from '@/lib/color';
import { PROJECT_STATUS, TASK_STATUS } from '@/config/constants';

export const STATUS_KEYS = Object.keys(PROJECT_STATUS);
export const ACTIVE_STATUSES = ['Running', 'On hold', 'Planning'];
export const CR_LIVE = ['Approved', 'In progress', 'Done'];
export const LINK_RE = /^https?:\/\//i;
export const NEUTRAL_DOT = 'oklch(0.7 0.01 265)';
/** Shared Projects filter defaults (pj.f) — "Clear filters" resets to this. */
export const DEFAULT_PROJECT_FILTER = {
  q: '', date: 'week', from: '', to: '', status: '', team: '', member: '', project: '',
  start: '', startFrom: '', startTo: '', due: '', dueFrom: '', dueTo: '',
};
export const PORTAL_HOST = 'clients.marioxsoftware.com/p/';

/** Read a value from either an input event or a raw value (UI kit inputs may pass either). */
export const val = (x) => (x && typeof x === 'object' && 'target' in x ? x.target.value : x);

/** CR / approval badge colours for a hue. */
export const badgeTone = (h = 265) => ({ bg: `oklch(0.95 0.04 ${h})`, fg: `oklch(0.42 0.13 ${h})` });

export const crStatusLabel = (s) => (s === 'Sent to client' ? 'Waiting for client' : s);

export const taskColor = (k) => `oklch(0.62 0.15 ${TASK_STATUS[k] ?? 265})`;

export const msOverdue = (m, T) => m.status !== 'Done' && m.due < T;

/** Numbered milestone badge colours: done → green, current → primary, else neutral. */
export const msBadge = (m, current) => ({
  bg: m.status === 'Done' ? GREEN : current ? PRIMARY : 'oklch(0.94 0.005 85)',
  fg: m.status === 'Done' || current ? '#fff' : MUTED,
});

/** "3 days" / "1 day" style pluralisation used by the original labels. */
export const nDays = (n, one = ' day', many = ' days') => n + (n === 1 ? one : many);
