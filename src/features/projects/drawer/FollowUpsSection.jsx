import { useMemo } from 'react';
import { Button, SectionTitle } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useNow } from '@/hooks/useNow';
import ProjectFollowUpRow from '@/features/project-followups/ProjectFollowUpRow';

/** Project drawer: open follow-ups first (by due date), then the last few completed ones. */
export default function FollowUpsSection({ project: sp }) {
  const { pfus, members } = useScoped();
  const openModal = useStore((st) => st.openModal);
  const now = useNow();
  const isClient = useStore((st) => !!st.auth && (st.users || []).find((u) => u.id === st.auth.uid)?.role === 'r-client');
  const list = useMemo(() => (pfus || []).filter((f) => f.p === sp.id), [pfus, sp.id]);
  const open = list.filter((f) => !f.done).sort((a, b) => a.due - b.due);
  const done = list.filter((f) => f.done).sort((a, b) => b.due - a.due).slice(0, 3);
  const overdue = open.filter((f) => f.due < now).length;
  if (isClient) return null;

  return (
    <section>
      <SectionTitle
        title="Follow-ups"
        sub={`${open.length} open${overdue ? ` · ${overdue} overdue` : ''}${done.length ? ` · ${list.filter((f) => f.done).length} done` : ''}`}
        action={<Button size="sm" onClick={() => openModal('pfu', { pid: sp.id })}>+ Add follow-up</Button>}
      />
      {open.concat(done).map((f) => <ProjectFollowUpRow key={f.id} fu={f} project={sp} members={members} compact now={now} />)}
      {list.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '6px 0 4px' }}>No follow-ups yet — add client calls, demos or reminders for this project.</div>}
    </section>
  );
}
