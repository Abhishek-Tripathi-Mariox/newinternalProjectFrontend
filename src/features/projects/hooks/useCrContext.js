import { useCallback, useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { avatarOf, crMoney } from '@/domain/projects';

/**
 * Everything `crView()` needs, memoised. crMoney uses the unscoped logs /
 * milestones / members like the original (`this.state`).
 */
export function useCrContext() {
  const model = useProjectsModel();
  const scoped = useScoped();
  const isPM = useIsPM();
  const logs = useStore((s) => s.logs);
  const milestones = useStore((s) => s.milestones);
  const members = useStore((s) => s.members);

  const money = useCallback((c) => crMoney(c, { logs, milestones, members }), [logs, milestones, members]);
  const avatar = useCallback((id) => avatarOf(scoped.members, id), [scoped.members]);

  return useMemo(
    () => ({ PRJ: model.PRJ, MSS: model.MSS, g: model.g, isPM, tasks: scoped.tasks || [], crMoney: money, avatar }),
    [model, isPM, scoped.tasks, money, avatar],
  );
}
