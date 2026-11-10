import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { isBugOpen, isTaskOpen } from '../workItems';

/**
 * Page-level numbers for the Projects header and tab bar: tab counts, the
 * timesheet entries in range (for CSV export) and hours logged today.
 * Mirrors the original tabDefs / summary / ents computations.
 */
export function useProjectsSummary() {
  const model = useProjectsModel();
  const S = useScoped();
  const f = useStore((s) => s.pj.f);
  const bf = useStore((s) => s.pj.bf);

  return useMemo(() => {
    const { pF, pSet, LF, T, inR, q, MEM, PRJ, msOf } = model;
    const pTs = new Set(
      S.projects.filter((p) => (!f.project || p.id === f.project) && (!f.status || p.status === f.status)).map((p) => p.id),
    );
    const nameOf = (id) => (MEM[id] || {}).name || '';
    const projName = (id) => (PRJ[id] || {}).name || '';

    const tasksOpen = (S.tasks || []).filter(
      (t) =>
        pTs.has(t.p) &&
        (!f.member || t.a === f.member) &&
        (!f.team || (MEM[t.a] || {}).team === f.team) &&
        (!q || `${t.title} ${projName(t.p)} ${nameOf(t.a)}`.toLowerCase().includes(q)) &&
        isTaskOpen(t),
    ).length;

    const b = bf || {};
    const bugsOpen = (S.bugs || []).filter(
      (x) =>
        pTs.has(x.p) &&
        (!f.member || x.a === f.member) &&
        (!f.team || x.dept === f.team) &&
        (!b.dept || x.dept === b.dept) &&
        (!b.sev || x.sev === b.sev) &&
        (!b.env || x.env === b.env) &&
        (!b.rep || x.rep === b.rep) &&
        (!q || `${x.id} ${x.title} ${projName(x.p)} ${nameOf(x.a)}`.toLowerCase().includes(q)) &&
        isBugOpen(x),
    ).length;

    const ents = LF.filter((l) => inR(l.d)).sort((a, c) => c.d - a.d || nameOf(a.m).localeCompare(nameOf(c.m)));
    const crOpen = (S.crs || []).filter((c) => pSet.has(c.p) && c.status !== 'Done' && c.status !== 'Rejected').length;
    const tH = LF.reduce((x, l) => x + (l.d === T ? l.h : 0), 0);

    return {
      counts: {
        projects: pF.length,
        milestones: pF.reduce((n, p) => n + (msOf[p.id] || []).length, 0),
        tasks: tasksOpen,
        bugs: bugsOpen,
        team: model.memF.length,
        cr: crOpen,
        ts: ents.length,
      },
      ents,
      tH,
      running: pF.filter((p) => p.status === 'Running').length,
    };
  }, [model, S, f, bf]);
}
