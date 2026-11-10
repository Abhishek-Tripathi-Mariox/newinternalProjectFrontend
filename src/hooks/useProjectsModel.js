import { useMemo } from 'react';
import { useStore } from '@/store';
import { buildProjectsModel } from '@/domain/projects';
import { useScoped } from './useScoped';
import { useNow } from './useNow';

/** Shared Projects-area model (filters, hour aggregates, info(p)) over the scoped data. */
export function useProjectsModel() {
  const scoped = useScoped();
  const pj = useStore((s) => s.pj);
  const now = useNow();
  return useMemo(() => buildProjectsModel(scoped, pj, now), [scoped, pj, now]);
}
