/** Row model for a project (original `prow`) — shared by the table and the board cards. */
import { barColor, projectColor } from '@/lib/color';
import { hh, pctW } from '@/lib/format';

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
  };
}
