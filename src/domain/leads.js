import { DAY } from '@/lib/date';
import { getLeadStatusNames } from '@/store/masters';

/** Lead scoring, freshness and duplicate detection (from the prototype's _rv). */

/** Stage weight in the lead score. */
const STAGE_SCORE = { New: 5, Contacted: 15, Qualified: 25, 'Proposal Sent': 30, Negotiation: 35, Won: 40, Lost: 0 };
/** Source weight in the lead score (others: 3). */
/**
 * Stage weight for any stage, including ones added from the app: unknown stages are
 * interpolated by pipeline position between the nearest known stages around them
 * (e.g. a stage between Qualified and Negotiation scores between 25 and 35).
 */
export function stageScore(status, names = getLeadStatusNames()) {
  if (status in STAGE_SCORE) return STAGE_SCORE[status];
  const order = names.filter((k) => k !== 'Lost');
  const i = order.indexOf(status);
  if (i < 0) return 0;
  let a = i - 1;
  while (a >= 0 && !(order[a] in STAGE_SCORE)) a--;
  let b = i + 1;
  while (b < order.length && !(order[b] in STAGE_SCORE)) b++;
  const lo = a >= 0 ? STAGE_SCORE[order[a]] : 0;
  const hi = b < order.length ? STAGE_SCORE[order[b]] : STAGE_SCORE.Won;
  const from = a >= 0 ? a : -1;
  const to = b < order.length ? b : order.length;
  return Math.round(lo + ((hi - lo) * (i - from)) / (to - from));
}
const SOURCE_SCORE = { Referral: 10, Website: 7, Clutch: 7, LinkedIn: 6, 'Google Ads': 5, Upwork: 4 };

/** Last 10 digits of a phone (if at least 8), else ''. */
export const normPhone = (p) => {
  const x = (p || '').replace(/\D/g, '').slice(-10);
  return x.length >= 8 ? x : '';
};
export const normCompany = (c) => (c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const normEmail = (e) => (e || '').trim().toLowerCase();

export const isOpenLead = (l) => l.status !== 'Won' && l.status !== 'Lost';

/** Soft pill colours for a score. */
export function scorePill(n) {
  const t = n >= 65 ? [35, 0.06] : n >= 40 ? [85, 0.06] : [265, 0.015];
  return { bg: `oklch(0.95 ${t[1]} ${t[0]})`, fg: `oklch(0.45 ${t[1] * 2.2} ${t[0]})` };
}

/**
 * Derived lead insights.
 * @returns {{touch, scoreOf, nextOf, dupOf, daysSince, isOpen, isHot, isStale, scorePill}}
 *  - touch[id]: last contact time (created, activity, or completed follow-up)
 *  - nextOf[id]: next open follow-up
 *  - dupOf[id]: {otherId: 'email & phone'} reasons
 */
export function leadInsights({ leads, fus, staleDays = 7, now = Date.now() }) {
  const nextOf = {};
  fus.forEach((f) => {
    if (!f.done && f.leadId && (!nextOf[f.leadId] || f.due < nextOf[f.leadId].due)) nextOf[f.leadId] = f;
  });

  const touch = {};
  leads.forEach((l) => {
    let t = l.created;
    (l.acts || []).forEach((a) => { if (a.t > t) t = a.t; });
    touch[l.id] = t;
  });
  fus.forEach((f) => {
    if (f.done && f.due <= now && touch[f.leadId] !== undefined && f.due > touch[f.leadId]) touch[f.leadId] = f.due;
  });

  const daysSince = (id) => Math.max(0, Math.floor((now - touch[id]) / DAY));
  const staleN = staleDays || 7;

  const scoreOf = {};
  const names = getLeadStatusNames();
  leads.forEach((l) => {
    const dd = daysSince(l.id);
    scoreOf[l.id] = l.status === 'Lost' ? 0 : Math.min(100, Math.round(
      Math.min(30, ((l.value || 0) / 15e5) * 30) + stageScore(l.status, names)
      + (dd <= 2 ? 20 : dd <= 7 ? 12 : dd <= 14 ? 5 : 0) + (SOURCE_SCORE[l.source] || 3) + (nextOf[l.id] ? 5 : 0),
    ));
  });

  const isHot = (l) => isOpenLead(l) && scoreOf[l.id] >= 65;
  const isStale = (l) => isOpenLead(l) && daysSince(l.id) >= staleN;

  const dupOf = {};
  const grp = (f, why) => {
    const g = {};
    leads.forEach((l) => {
      const k = f(l);
      if (k) (g[k] = g[k] || []).push(l);
    });
    Object.values(g).forEach((a) => {
      if (a.length > 1) a.forEach((l) => a.forEach((o) => {
        if (o !== l) {
          const x = (dupOf[l.id] = dupOf[l.id] || {});
          x[o.id] = x[o.id] ? `${x[o.id]} & ${why}` : why;
        }
      }));
    });
  };
  grp((l) => normEmail(l.email), 'email');
  grp((l) => normPhone(l.phone), 'phone');
  grp((l) => normCompany(l.company), 'company name');

  return { touch, scoreOf, nextOf, dupOf, daysSince, isOpen: isOpenLead, isHot, isStale, scorePill };
}

/** Up to 3 existing leads that look like the lead being entered (lead modal warning). */
export function findDuplicateLeads(form, leads, excludeId) {
  return leads.filter((l) => l.id !== excludeId && (
    (normEmail(form.email) && normEmail(l.email) === normEmail(form.email))
    || (normPhone(form.phone) && normPhone(l.phone) === normPhone(form.phone))
    || (normCompany(form.company).length > 2 && normCompany(l.company) === normCompany(form.company))
  )).slice(0, 3);
}

/** Google Calendar "add event" URL for a follow-up (original cal()). */
export function calendarUrl(f, l) {
  const z = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const det = [f.notes, f.meet ? `Google Meet: ${f.meet}` : '', l ? `Lead: ${l.company} (${l.contact})` : ''].filter(Boolean).join('\n');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(f.title + (l ? ` · ${l.company}` : ''))}`
    + `&dates=${z(f.due)}/${z(f.due + (f.dur || 30) * 6e4)}&details=${encodeURIComponent(det)}`
    + (f.meet ? `&location=${encodeURIComponent(f.meet)}` : '') + (f.attendees ? `&add=${encodeURIComponent(f.attendees)}` : '');
}
