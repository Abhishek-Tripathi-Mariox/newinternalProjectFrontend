/** Change-request row model shared by the CR tab table and the project drawer cards (original `crRow`). */
import { AMBER, BLUE, RED, projectColor } from '@/lib/color';
import { dLabel } from '@/lib/date';
import { hh, money, pctW } from '@/lib/format';
import { CR_STATUS } from '@/config/constants';
import { CR_LIVE, badgeTone, crStatusLabel } from './view';

/**
 * @param c   change request
 * @param ctx { PRJ, MSS, g, isPM(project), tasks, crMoney(c), avatar(id) }
 */
export function crView(c, { PRJ, MSS, g, isPM, tasks, crMoney, avatar }) {
  const p = PRJ[c.p];
  const pm = !!p && isPM(p);
  const sepMs = c.ms && MSS[c.ms] && MSS[c.ms].cr;
  const used = sepMs ? g(`ms:${c.ms}`).all : null;
  const u = used != null && c.hours ? used / c.hours : 0;
  const nd = (c.docs || []).length;
  const mo = crMoney(c);
  const live = CR_LIVE.includes(c.status);
  const tk = (tasks || []).filter((t) => t.cr === c.id);
  const team = (c.team || []).map(avatar);
  const pr = live && mo.profit != null ? mo.profit : mo.estProfit;
  const mg = c.amount ? Math.round((pr / c.amount) * 100) : 0;
  const st = badgeTone(CR_STATUS[c.status] ?? 265);

  return {
    c,
    id: c.id,
    title: c.title,
    project: (p && p.name) || '—',
    color: projectColor(p),
    status: crStatusLabel(c.status),
    sBg: st.bg,
    sFg: st.fg,
    hours: hh(c.hours),
    amount: money(c.amount || 0),
    days: c.days ? `+${c.days}d` : '—',
    by: c.by === 'Client' ? c.reqBy || (p && p.client) || 'Client' : `Internal · ${c.reqBy || ''}`,
    raised: dLabel(c.raised),
    docs: nd ? `${nd} file${nd > 1 ? 's' : ''}` : '',
    hasUsed: used != null,
    used: used != null ? `${hh(used)} of ${hh(c.hours)} used` : '',
    barW: pctW(u),
    barBg: mo.over ? RED : mo.near ? AMBER : BLUE,
    track: used == null && c.ms ? `Hours added to ${(MSS[c.ms] || {}).name || 'milestone'}` : '',
    note: c.note || '',
    over: mo.over,
    overL: mo.over ? `${hh(mo.used - c.hours)} over the estimate` : '',
    near: mo.near,
    nearL: mo.near ? `Close to the estimate · ${hh(c.hours - mo.used)} left` : '',
    moneyL:
      live && mo.cost != null
        ? `Cost so far ${money(mo.cost)} · profit ${money(pr)} (${mg}%)`
        : `Est. cost ${money(mo.estCost)} · est. profit ${money(pr)} (${mg}%)`,
    profitColor: pr < 0 ? RED : mg < 20 ? 'oklch(0.5 0.12 70)' : 'oklch(0.42 0.12 150)',
    team: team.slice(0, 5),
    tasksL: tk.length
      ? `${tk.length} task${tk.length > 1 ? 's' : ''} · ${tk.filter((t) => t.st !== 'Done').length} open`
      : (c.tasks || []).length
        ? `${(c.tasks || []).length} tasks planned`
        : '',
    sigL: c.sig ? `Signed by ${c.sig.name} · ${dLabel(c.sig.at)}` : '',
    isDraft: pm && c.status === 'Draft',
    isSent: pm && c.status === 'Sent to client',
    isApproved: pm && c.status === 'Approved',
    isProg: pm && c.status === 'In progress',
  };
}
