import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { Avatar } from '@/components/ui';
import s from './PrimaryDevs.module.css';

const ACTIVE = ['Running', 'Planning', 'On hold'];

/**
 * Developer-wise count of projects where each person is a ★ primary developer (active = Running /
 * Planning / On hold; total excludes Cancelled). Click a person to filter the list to their
 * primary projects; click again to clear.
 */
export default function PrimaryDevs() {
  const { projects, members } = useScoped();
  const f = useStore((st) => st.pj.f);
  const setPjF = useStore((st) => st.setPjF);

  const devs = useMemo(() => {
    const by = {};
    projects.filter((p) => p.status !== 'Cancelled').forEach((p) => (p.primary || []).forEach((id) => {
      const x = by[id] || (by[id] = { id, total: 0, active: 0, running: 0 });
      x.total += 1;
      if (ACTIVE.includes(p.status)) x.active += 1;
      if (p.status === 'Running') x.running += 1;
    }));
    return Object.values(by)
      .map((x) => ({ ...x, m: members.find((m) => m.id === x.id) || { name: x.id, h: 265 } }))
      .sort((a, b) => b.active - a.active || b.total - a.total || a.m.name.localeCompare(b.m.name));
  }, [projects, members]);

  if (!devs.length) return null;
  const on = (id) => f.member === id && f.role === 'primary';
  return (
    <div className={s.wrap}>
      <div className={s.label}>★ Primary developers</div>
      <div className={s.list}>
        {devs.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`${s.dev} ${on(d.id) ? s.on : ''}`}
            onClick={() => setPjF(on(d.id) ? { member: '', role: '' } : { member: d.id, role: 'primary' })}
            title={`${d.m.name}: primary on ${d.active} active project(s) — ${d.running} running · ${d.total} in total. Click to ${on(d.id) ? 'clear' : 'show them'}.`}
          >
            <Avatar name={d.m.name} h={d.m.h} size={22} />
            <span className={s.name}>{d.m.name}</span>
            <span className={s.count}>{d.active}</span>
            <span className={s.sub}>{d.running} running · {d.total} total</span>
          </button>
        ))}
      </div>
    </div>
  );
}
