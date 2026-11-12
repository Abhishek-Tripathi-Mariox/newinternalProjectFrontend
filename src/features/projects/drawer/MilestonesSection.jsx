import { useCallback, useMemo, useState } from 'react';
import { Button, ErrorText, Input, SectionTitle } from '@/components/ui';
import { ymd } from '@/lib/date';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { hh } from '@/lib/format';
import MilestoneRow from '../components/MilestoneRow';
import s from './drawer.module.css';

/** Milestones list with PM-editable name / allocation and member breakdown. */
export default function MilestonesSection({ project: sp, info: I, model }) {
  const exp = useStore((st) => st.pj.exp);
  const exp2 = useStore((st) => st.pj.exp2);
  const setPj = useStore((st) => st.setPj);
  const updMs = useStore((st) => st.updMs);
  const addMs = useStore((st) => st.addMs);
  const delMs = useStore((st) => st.delMs);
  const [draft, setDraft] = useState(null); // { name, due, hours } while adding
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { logs, members } = useScoped();
  const isPM = useIsPM();
  const canEdit = isPM(sp);

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const onUpdate = useCallback(
    (id, patch) => {
      // Status is open to everyone; name / allocation are PM only (original behaviour).
      if (('name' in patch || 'alloc' in patch || 'due' in patch) && !canEdit) return;
      updMs(id, patch);
    },
    [canEdit, updMs],
  );
  const onToggle = useCallback((id) => setPj({ exp: exp === `ms:${id}` ? null : `ms:${id}`, exp2: null }), [exp, setPj]);
  const onToggleMember = useCallback((id) => setPj({ exp2: id }), [setPj]);

  const done = I.ms.filter((m) => m.status === 'Done').length;
  const startAdd = () => { setErr(''); setDraft({ name: '', due: sp.due ? ymd(sp.due) : '', hours: '' }); };
  const saveAdd = async () => {
    if (busy) return;
    setBusy(true);
    const e = await addMs(sp.id, draft);
    setBusy(false);
    if (e) setErr(e);
    else setDraft(null);
  };
  const setD = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <section>
      <SectionTitle
        title="Milestones"
        sub={`${done} of ${I.ms.length} done · ${hh(I.budget)} allocated`}
        action={canEdit && !draft ? <Button size="sm" onClick={startAdd}>+ Add milestone</Button> : null}
      />
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
          onDelete={delMs}
          onToggle={onToggle}
          onToggleMember={onToggleMember}
        />
      ))}
      {draft && (
        <div className={s.msAdd}>
          <Input value={draft.name} onChange={setD('name')} placeholder={`Milestone ${I.ms.length + 1}`} aria-label="New milestone name" data-autofocus />
          <Input type="date" value={draft.due} onChange={setD('due')} aria-label="New milestone due date" />
          <Input type="number" min="0" step="1" value={draft.hours} onChange={setD('hours')} placeholder="Hours" aria-label="New milestone hours" />
          <Button size="sm" variant="primary" onClick={saveAdd} disabled={busy}>{busy ? 'Adding…' : 'Add'}</Button>
          <Button size="sm" onClick={() => setDraft(null)}>Cancel</Button>
          {err && <ErrorText className={s.msAddErr}>{err}</ErrorText>}
        </div>
      )}
    </section>
  );
}
