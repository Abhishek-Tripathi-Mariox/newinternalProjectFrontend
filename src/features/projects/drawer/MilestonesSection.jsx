import { useCallback, useMemo } from 'react';
import { SectionTitle } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { hh } from '@/lib/format';
import MilestoneRow from '../components/MilestoneRow';

/** Milestones list with PM-editable name / allocation and member breakdown. */
export default function MilestonesSection({ project: sp, info: I, model }) {
  const exp = useStore((st) => st.pj.exp);
  const exp2 = useStore((st) => st.pj.exp2);
  const setPj = useStore((st) => st.setPj);
  const updMs = useStore((st) => st.updMs);
  const { logs, members } = useScoped();
  const isPM = useIsPM();
  const canEdit = isPM(sp);

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const onUpdate = useCallback(
    (id, patch) => {
      // Status is open to everyone; name / allocation are PM only (original behaviour).
      if (('name' in patch || 'alloc' in patch) && !canEdit) return;
      updMs(id, patch);
    },
    [canEdit, updMs],
  );
  const onToggle = useCallback((id) => setPj({ exp: exp === `ms:${id}` ? null : `ms:${id}`, exp2: null }), [exp, setPj]);
  const onToggleMember = useCallback((id) => setPj({ exp2: id }), [setPj]);

  const done = I.ms.filter((m) => m.status === 'Done').length;

  return (
    <section>
      <SectionTitle title="Milestones" sub={`${done} of ${I.ms.length} done · ${hh(I.budget)} allocated`} />
      {I.ms.map((m) => (
        <MilestoneRow
          key={m.id}
          m={m}
          project={sp}
          current={!!I.curM && I.curM.id === m.id}
          used={model.g(`ms:${m.id}`).all}
          T={model.T}
          canEdit={canEdit}
          open={exp === `ms:${m.id}`}
          openMemberId={exp2}
          logs={logs}
          memberById={memberById}
          onUpdate={onUpdate}
          onToggle={onToggle}
          onToggleMember={onToggleMember}
        />
      ))}
    </section>
  );
}
