import { useMemo } from 'react';
import { useStore } from '@/store';
import { useSettings } from '@/store/settings';
import { useScoped } from '@/hooks/useScoped';
import { useNow } from '@/hooks/useNow';
import { leadInsights } from '@/domain/leads';

/**
 * Role-scoped leads + follow-ups with derived sales insights (score, last touch,
 * next follow-up, duplicates, hot / stale flags). Shared by the Leads page,
 * the lead drawer and the dashboard.
 */
export function useLeadInsights() {
  const scoped = useScoped();
  const staleDays = useStore((s) => s.staleDays) || 7;
  const now = useNow();
  // Subscribe so money() labels re-render when the currency setting changes.
  const currency = useSettings((s) => s.currency);
  const leads = scoped.leads;
  const fus = scoped.fus;

  return useMemo(() => {
    const leadMap = {};
    leads.forEach((l) => { leadMap[l.id] = l; });
    const ins = leadInsights({ leads, fus, staleDays, now });
    return { leads, fus, leadMap, ins, now, staleDays, currency };
  }, [leads, fus, staleDays, now, currency]);
}
