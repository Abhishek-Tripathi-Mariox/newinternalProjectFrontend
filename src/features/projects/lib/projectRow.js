/** Row model for a project (original `prow`) — shared by the table and the board cards. */
import { barColor, projectColor } from '@/lib/color';
import { hh, money, pctW } from '@/lib/format';

/**
 * @param p      project
 * @param model  useProjectsModel() result
 * @param avatar (memberId) => avatar
 */
export function projectRow(p, model, avatar) {
  const I = model.info(p);
  const H = model.g(model.hk(p));
  const n = I.ms.length;
  return {
    p,
    I,
    id: p.id,
    name: p.name,
    client: p.client,
    color: projectColor(p),
    msName: I.curM ? I.curM.name : n ? 'All milestones done' : '—',
    msStep: n ? (I.curM ? `Milestone ${I.ci + 1} of ${n} · ${I.curM.status}` : `${n} of ${n} done`) : '',
    team: p.team.map(avatar),
    usedLabel: hh(I.used),
    budgetLabel: `/ ${hh(I.budget)}`,
    pctLabel: `${Math.round(I.pct * 100)}%`,
    barW: pctW(I.pct),
    barBg: barColor(I.pct),
    today: hh(H.today),
    week: hh(H.week),
    rangeH: hh(H.range),
    // Detail for the table / cards
    pmName: p.pm ? ((model.MEM[p.pm] || {}).name || p.pm) : '',
    people: p.team.filter((id) => id !== p.pm).map((id) => ({
      id,
      name: (model.MEM[id] || {}).name || id,
      primary: (p.primary || []).includes(id),
      logged: model.g(`pm:${p.id}:${id}`).all,
      alloc: +(p.alloc || {})[id] || 0,
    })),
    primaryNames: (p.primary || []).map((id) => (model.MEM[id] || {}).name || id),
    msPeople: I.curM ? (I.curM.team || []).map((id) => (model.MEM[id] || {}).name || id) : [],
    openT: (model.TKP[p.id] || []).filter((t) => t.st !== 'Done').length,
    openB: (model.BGP[p.id] || []).filter((b) => b.st !== 'Closed' && b.st !== 'Fixed').length,
    value: p.value ? money(p.value) : '',
    service: p.service || '',
    prio: p.prio || 'Medium',
  };
}
