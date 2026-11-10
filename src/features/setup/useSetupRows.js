import { useMemo } from 'react';
import { useStore } from '@/store';
import { CORE_STAGES, useLeadStatuses, useServices, useSources } from '@/store/masters';

const servicesOf = (o) => (o.service || '').split(',').map((x) => x.trim()).filter(Boolean);
const isOpen = (l) => l.status !== 'Won' && l.status !== 'Lost';
const sum = (a) => a.reduce((x, l) => x + (+l.value || 0), 0);

/** Usage stats for a set of leads matching one list value. */
function stats(leads) {
  const open = leads.filter(isOpen);
  const won = leads.filter((l) => l.status === 'Won');
  return { leads: leads.length, open: open.length, pipeline: sum(open), won: sum(won), wonCount: won.length };
}

/**
 * Table rows for the Lead setup page.
 * kind: 'stages' | 'sources' | 'services'. Each row: {name, hue?, core?, index, last, ...stats, projects?}.
 */
export function useSetupRows(kind) {
  const leads = useStore((s) => s.leads);
  const projects = useStore((s) => s.projects);
  const stages = useLeadStatuses();
  const sources = useSources();
  const services = useServices();

  return useMemo(() => {
    if (kind === 'stages') {
      return stages.map(([name, hue], i) => ({
        name, hue, index: i, total: stages.length,
        core: CORE_STAGES.includes(name),
        // Custom stages can move between "New" (first) and Won/Lost (last).
        canUp: !CORE_STAGES.includes(name) && i > 1,
        canDown: !CORE_STAGES.includes(name) && stages[i + 1] && !CORE_STAGES.includes(stages[i + 1][0]),
        ...stats(leads.filter((l) => l.status === name)),
      }));
    }
    const list = kind === 'sources' ? sources : services;
    return list.map((name, i) => {
      const mine = kind === 'sources' ? leads.filter((l) => l.source === name) : leads.filter((l) => servicesOf(l).includes(name));
      return {
        name, index: i, total: list.length, canUp: i > 0, canDown: i < list.length - 1,
        ...stats(mine),
        projects: kind === 'services' ? projects.filter((p) => servicesOf(p).includes(name)).length : 0,
      };
    });
  }, [kind, leads, projects, stages, sources, services]);
}
