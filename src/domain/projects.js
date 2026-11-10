import { PROJECT_STATUS, PROJECT_PERIOD_PRESETS, TEAM_COST } from '@/config/constants';
import { DAY, NOON, sod, range, fd, dateTime } from '@/lib/date';
import { INK, RED, tone, avatarTone } from '@/lib/color';
import { escapeHtml as esc, printHtml } from '@/lib/download';
import { hh, inr } from '@/lib/format';

/** Current milestone id of a project: first not-Done (by n), else the last; '' if none. */
export function curMs(milestones, pid) {
  const a = milestones.filter((m) => m.p === pid).sort((x, y) => x.n - y.n);
  return ((a.find((m) => m.status !== 'Done') || a[a.length - 1]) || {}).id || '';
}

/** Default CR hourly rate for a project: contract value / base budget, rounded to 50 (else 1500). */
export function crRate(milestones, p) {
  const b = milestones.filter((m) => m.p === p.id && !m.cr).reduce((x, m) => x + (+m.alloc || 0), 0);
  return b && p.value ? Math.round(p.value / b / 50) * 50 : 1500;
}

/** Internal hourly cost of a member. */
export function costOf(members, id) {
  const m = (members || []).find((x) => x.id === id) || {};
  return +m.cost || TEAM_COST[m.team] || 700;
}

/**
 * Money picture of a change request.
 * @returns {{used, cost, estCost, estProfit, profit, over, near}} used/cost/profit null until it has its own milestone
 */
export function crMoney(c, { logs = [], milestones = [], members = [] }) {
  const ls = c.ms ? logs.filter((l) => l.ms === c.ms) : [];
  const sep = c.ms && milestones.some((m) => m.id === c.ms && m.cr);
  const used = sep ? ls.reduce((x, l) => x + l.h, 0) : null;
  const cost = sep ? ls.reduce((x, l) => x + l.h * costOf(members, l.m), 0) : null;
  const tk = c.tasks || [];
  const tH = tk.reduce((x, t) => x + (+t.h || 0), 0);
  const avg = tk.length && tH
    ? tk.reduce((x, t) => x + (+t.h || 0) * costOf(members, t.a), 0) / tH
    : (c.team || []).length ? c.team.reduce((x, id) => x + costOf(members, id), 0) / c.team.length : 700;
  const estCost = c.hours * avg;
  return {
    used, cost, estCost, estProfit: (c.amount || 0) - estCost, profit: cost != null ? (c.amount || 0) - cost : null,
    over: used != null && used > c.hours, near: used != null && used >= c.hours * 0.9 && used <= c.hours,
  };
}

/**
 * Printable CR approval record.
 * @returns {boolean} false when pop-ups are blocked — flash 'Allow pop-ups to download the approval PDF'.
 */
export function printCr(c, { projects = [], members = [] }) {
  const p = projects.find((x) => x.id === c.p) || {};
  const d = (x) => (x ? dateTime(x) : '—');
  const sig = c.sig || {};
  const nm = (id) => (members.find((x) => x.id === id) || {}).name || '—';
  let hsh = 0;
  `${c.id}|${sig.name || ''}|${sig.at || ''}|${c.amount}`.split('').forEach((ch) => { hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; });
  const ref = `MX-${c.id.replace(/\W/g, '')}-${hsh.toString(36).toUpperCase()}`;
  const tasks = (c.tasks || []).map((t) => `<tr><td>${esc(t.t)}</td><td>${esc(nm(t.a))}</td><td class=r>${+t.h || 0}h</td></tr>`).join('');
  const hist = (c.hist || []).map((x) => `<tr><td style="white-space:nowrap">${d(x.t)}</td><td>${esc(x.text)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${c.id} approval · ${esc(p.client)}</title><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap" rel="stylesheet"><style>body{font:13px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#1d2230;margin:48px}h1{font-size:24px;margin:2px 0 0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#667;margin:28px 0 6px}table{width:100%;border-collapse:collapse}td,th{padding:8px 6px;border-bottom:1px solid #e4e4e8;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#667;border-bottom:1.5px solid #1d2230}.r{text-align:right}.m{color:#667}.top{display:flex;justify-content:space-between;gap:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.grid div{background:#f5f5f2;border-radius:8px;padding:10px 12px}.grid b{display:block;font-size:16px}.sig{border:1.5px solid #1d2230;border-radius:10px;padding:18px 20px;margin-top:10px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}.sn{font-family:Caveat,cursive;font-size:34px;line-height:1.1}@media print{body{margin:18px}}</style></head><body>`
    + `<div class=top><div><div class=m>CHANGE REQUEST · APPROVAL RECORD</div><h1>${esc(c.title)}</h1><div class=m>${esc(p.name)} · ${esc(p.client)}</div></div><div class=r><b>${c.id}</b><br><span class=m>Mariox Software</span></div></div>`
    + `<div class=grid><div><span class=m>Estimated hours</span><b>${c.hours}h</b></div><div><span class=m>Rate</span><b>${inr(c.rate)}/h</b></div><div><span class=m>Change value</span><b>${inr(c.amount)}</b></div><div><span class=m>Timeline impact</span><b>${c.days ? `+${c.days} days` : 'None'}</b></div></div>`
    + `<h2>Scope</h2><div>${esc(c.desc || '—')}</div>${tasks ? `<h2>Work breakdown</h2><table><thead><tr><th>Task</th><th>Assigned to</th><th class=r>Hours</th></tr></thead><tbody>${tasks}</tbody></table>` : ''}`
    + `<h2>Approval</h2><div class=sig><div><div class=m>Approved by</div><div class=sn>${esc(sig.name || '—')}</div><div>${esc(sig.name || '')}${sig.title ? `, ${esc(sig.title)}` : ''} · ${esc(p.client)}</div></div><div><div class=m>Date & time</div><b>${d(sig.at || c.decidedAt)}</b><div class=m style="margin-top:8px">Method</div><b>${esc(sig.via || '—')}</b>${sig.note ? `<div class=m style="margin-top:8px">Comment</div>${esc(sig.note)}` : ''}</div></div>`
    + `<div class=m style="margin-top:8px;font-size:11.5px">Verification reference ${ref} · The client typed their name and confirmed they approve this change and its cost.</div>`
    + (hist ? `<h2>History</h2><table><tbody>${hist}</tbody></table>` : '')
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){print()},500)}</scr' + 'ipt></body></html>';
  return printHtml(html);
}

/** Avatar data for a member id (falls back to '—'). */
export function avatarOf(members, id) {
  const m = (members || []).find((x) => x.id === id) || { name: '—', h: 265, role: '', team: '' };
  const t = avatarTone(m.h);
  return { id, name: m.name, role: m.role, team: m.team, ini: m.name.split(' ').map((w) => w[0]).join('').slice(0, 2), bg: t.bg, fg: t.fg };
}

const ZERO = Object.freeze({ all: 0, today: 0, yest: 0, week: 0, month: 0, range: 0 });

/**
 * Shared derived model for the Projects area (port of the top of pv()).
 * @param {object} S role-scoped state
 * @param {object} pj projects UI state (uses pj.f filters)
 * @param {number} now
 */
export function buildProjectsModel(S, pj, now = Date.now()) {
  const f = pj.f;
  const D = DAY;
  const T = sod(now);

  const MEM = {};
  const PRJ = {};
  const MSS = {};
  const msOf = {};
  const msPeople = {};
  S.members.forEach((m) => { MEM[m.id] = m; });
  S.projects.forEach((p) => { PRJ[p.id] = p; });
  S.milestones.forEach((m) => { MSS[m.id] = m; (msOf[m.p] = msOf[m.p] || []).push(m); });
  Object.keys(msOf).forEach((k) => msOf[k].sort((a, b) => a.n - b.n));

  const rg = range(f.date, f.from, f.to);
  const wk = range('week');
  const mo = range('month');
  const inR = (d) => !rg || (d >= rg[0] && d < rg[1]);
  const yd = sod(T - D + NOON);

  // Hour aggregates keyed by 'p:pid', 'm:mid', 'pm:pid:mid', 'pt:pid:team', 'ms:msid', 'd:mid:day'.
  const A = {};
  const g = (k) => A[k] || ZERO;
  const add = (k, l) => {
    const a = A[k] || (A[k] = { all: 0, today: 0, yest: 0, week: 0, month: 0, range: 0 });
    a.all += l.h;
    if (l.d === T) a.today += l.h;
    if (l.d === T - D || yd === l.d) a.yest += l.h;
    if (l.d >= wk[0] && l.d < wk[1]) a.week += l.h;
    if (l.d >= mo[0] && l.d < mo[1]) a.month += l.h;
    if (inR(l.d)) a.range += l.h;
  };
  S.logs.forEach((l) => {
    const tm = (MEM[l.m] || {}).team;
    add(`p:${l.p}`, l); add(`m:${l.m}`, l); add(`pm:${l.p}:${l.m}`, l); add(`pt:${l.p}:${tm}`, l); add(`ms:${l.ms}`, l); add(`d:${l.m}:${l.d}`, l);
    const s = msPeople[l.ms] || (msPeople[l.ms] = []);
    if (!s.includes(l.m)) s.push(l.m);
  });
  const sumA = (list) => list.reduce((x, a) => ({
    all: x.all + a.all, today: x.today + a.today, yest: x.yest + a.yest, week: x.week + a.week, month: x.month + a.month, range: x.range + a.range,
  }), ZERO);

  const periodLabel = (PROJECT_PERIOD_PRESETS.find((p) => p[0] === f.date) || ['', 'Period'])[1].replace('…', '');

  // Filters
  const q = f.q.trim().toLowerCase();
  const pBase = S.projects.filter((p) => (!q || `${p.name} ${p.client} ${p.id} ${p.team.map((id) => (MEM[id] || {}).name).join(' ')}`.toLowerCase().includes(q))
    && (!f.project || p.id === f.project)
    && (!f.member || p.team.includes(f.member))
    && (!f.team || p.team.some((id) => (MEM[id] || {}).team === f.team)));
  const pF = f.status ? pBase.filter((p) => p.status === f.status) : pBase;
  const pSet = new Set(pF.map((p) => p.id));
  /** Aggregate key for a project's hours honouring the member/team filter. */
  const hk = (p) => (f.member ? `pm:${p.id}:${f.member}` : f.team ? `pt:${p.id}:${f.team}` : `p:${p.id}`);
  const LF = S.logs.filter((l) => pSet.has(l.p) && (!f.member || l.m === f.member) && (!f.team || (MEM[l.m] || {}).team === f.team));
  const projScoped = !!(q || f.project || f.status);
  const memF = S.members.filter((m) => (!f.member || m.id === f.member) && (!f.team || m.team === f.team)
    && (!projScoped || pF.some((p) => p.team.includes(m.id)) || (q && `${m.name} ${m.role}`.toLowerCase().includes(q))));
  const mAgg = (m) => (projScoped ? sumA(pF.map((p) => g(`pm:${p.id}:${m.id}`))) : g(`m:${m.id}`));

  const TKP = {};
  const BGP = {};
  (S.tasks || []).forEach((t) => (TKP[t.p] = TKP[t.p] || []).push(t));
  (S.bugs || []).forEach((b) => (BGP[b.p] = BGP[b.p] || []).push(b));

  /** Budget, progress and health of a project. */
  const info = (p) => {
    const ms = msOf[p.id] || [];
    const budget = ms.reduce((x, m) => x + (+m.alloc || 0), 0);
    const used = g(`p:${p.id}`).all;
    const curM = ms.find((m) => m.status !== 'Done');
    const ci = curM ? ms.indexOf(curM) : ms.length;
    const dd = Math.round((p.due - T) / D);
    let hl;
    let sc = null;
    const why = [];
    if (p.status === 'Completed') hl = budget && used > budget * 1.02 ? ['Over budget', 25] : ['Delivered', 150];
    else if (p.status === 'Planning') hl = ['Not started', 265];
    else if (p.status === 'Cancelled') hl = ['Cancelled', 265];
    else {
      sc = 100;
      const tks = TKP[p.id] || [];
      const bgs = BGP[p.id] || [];
      const odMs = ms.filter((m) => m.status !== 'Done' && m.due && m.due < T);
      const done = ms.filter((m) => m.status === 'Done').length;
      const prog = ms.length ? (done + (curM && curM.status !== 'Not started' ? 0.5 : 0)) / ms.length : 0;
      const el = Math.max(0, Math.min(1, (T - p.start) / Math.max(D, p.due - p.start)));
      const bp = budget ? used / budget : 0;
      const crit = bgs.filter((b) => b.sev === 'Critical' && b.st !== 'Closed' && b.st !== 'Fixed').length;
      const blk = tks.filter((t) => t.st === 'Blocked').length;
      const pen = (n, t) => { if (n > 0) { sc -= n; why.push(t); } };
      if (dd < 0) pen(35, `${Math.abs(dd)}d past the due date`);
      pen(Math.min(30, odMs.length * 15), `${odMs.length} milestone${odMs.length > 1 ? 's' : ''} overdue`);
      if (budget && used > budget) pen(25, `${hh(used - budget)} over the hours budget`);
      else if (budget && bp - prog > 0.15) pen(bp - prog > 0.3 ? 20 : 10, `${Math.round(bp * 100)}% of hours used, ${Math.round(prog * 100)}% delivered`);
      if (el - prog > 0.2) pen(15, `${Math.round(el * 100)}% of the timeline gone, ${Math.round(prog * 100)}% delivered`);
      pen(Math.min(24, crit * 8), `${crit} critical bug${crit > 1 ? 's' : ''} open`);
      pen(Math.min(15, blk * 5), `${blk} blocked task${blk > 1 ? 's' : ''}`);
      if (p.status === 'On hold') pen(10, 'Project is on hold');
      sc = Math.max(0, sc);
      hl = dd < 0 || odMs.some((m) => T - m.due > 7 * D) ? ['Late', 25] : sc < 75 ? ['At risk', 70] : ['On track', 150];
    }
    const st = tone(PROJECT_STATUS[p.status] ?? 265);
    const pct = budget ? used / budget : 0;
    return {
      p, ms, budget, used, curM, ci, pct, st, hl, health: hl[0], score: sc, why,
      hLabel: sc == null ? hl[0] : `${hl[0]} · ${sc}`, hBg: `oklch(0.95 0.04 ${hl[1]})`, hFg: `oklch(0.45 0.14 ${hl[1]})`, bad: hl[1] === 25 || hl[1] === 70,
      dueLabel: fd(p.due), dueSub: p.status === 'Completed' ? 'Delivered' : dd < 0 ? `${Math.abs(dd)}d overdue` : dd === 0 ? 'Due today' : `in ${dd}d`,
      dueColor: p.status !== 'Completed' && dd < 0 ? RED : INK,
    };
  };

  return { T, MEM, PRJ, MSS, msOf, msPeople, g, sumA, hk, inR, rg, wk, mo, q, pBase, pF, pSet, LF, projScoped, memF, mAgg, info, TKP, BGP, periodLabel };
}
