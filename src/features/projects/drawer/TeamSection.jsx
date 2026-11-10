import { useMemo } from 'react';
import { Avatar, ProgressBar, SectionTitle, Select } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { MUTED, RED, barColor } from '@/lib/color';
import { hh, pctW } from '@/lib/format';
import { EntryRows } from '../components/bits';
import { useProjectNav } from '../hooks/useProjectNav';
import { memberProjectDetail } from '../lib/logs';
import s from './drawer.module.css';

const UNKNOWN = { name: '—', h: 265, role: '' };

function MemberDetail({ detail }) {
  return (
    <div className={s.detailWrap}>
      <div className={s.detail}>
        <div className={s.small}>{detail.sum}</div>
        {detail.groups.map((gr) => (
          <div key={gr.id}>
            <div className={s.groupHead}>
              <span>{gr.name}</span>
              <span>
                {gr.total} <span className={s.groupDays}>· {gr.days}</span>
              </span>
            </div>
            <EntryRows rows={gr.rows} />
          </div>
        ))}
        {detail.empty && <div className={s.small}>No hours logged yet.</div>}
      </div>
    </div>
  );
}

/** Team allocation editor: per-member allocated / taken / remaining, add & remove (PM only). */
export default function TeamSection({ project: sp, info: I, model }) {
  const exp = useStore((st) => st.pj.exp);
  const setPj = useStore((st) => st.setPj);
  const setAlloc = useStore((st) => st.setAlloc);
  const addMember = useStore((st) => st.addMember);
  const removeMember = useStore((st) => st.removeMember);
  const flash = useStore((st) => st.flash);
  const { members, logs } = useScoped();
  const isPM = useIsPM();
  const { openMember } = useProjectNav();
  const canEdit = isPM(sp);

  const MEM = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const aTot = sp.team.reduce((x, id) => x + (+sp.alloc[id] || 0), 0);
  const aOver = aTot > I.budget;

  const onAlloc = (id, raw) => {
    if (!canEdit) return;
    const nv = Math.max(0, +raw || 0);
    const nt = aTot - (+sp.alloc[id] || 0) + nv;
    if (nt > I.budget && aTot <= I.budget) flash(`Over budget: team now ${hh(nt)} of ${hh(I.budget)}`);
    setAlloc(sp.id, id, nv);
  };
  const onAdd = (e) => {
    const v = e.target.value;
    if (v && canEdit) {
      addMember(sp.id, v);
      flash(`${(MEM[v] || {}).name} added`);
    }
  };
  const onRemove = (id) => {
    if (!canEdit) return;
    removeMember(sp.id, id);
    flash(`${(MEM[id] || {}).name} removed from project`);
  };

  const action = canEdit ? (
    <Select
      unstyled
      className={s.addSelect}
      aria-label="Add member"
      value=""
      placeholder="+ Add member…"
      onChange={onAdd}
      options={members.filter((m) => !sp.team.includes(m.id)).map((m) => ({ value: m.id, label: `${m.name} · ${m.role}` }))}
    />
  ) : (
    <span className={s.small}>Team and hours set by the PM</span>
  );

  return (
    <section className={s.section}>
      <SectionTitle title="Team on this project" action={action} />
      <div className={s.allocSum} style={{ color: aOver ? RED : MUTED }}>
        {hh(aTot)} allocated of {hh(I.budget)} budget{aOver ? '' : ` · ${hh(I.budget - aTot)} unassigned`}
      </div>
      {aOver && (
        <div className={s.alert} role="alert">
          <span className={s.alertMark}>!</span>
          <div>
            <div className={s.alertTitle}>Allocated hours exceed the project budget</div>
            <div>
              Team total is {hh(aTot)} against a {hh(I.budget)} budget, {hh(aTot - I.budget)} over. Reduce member allocations or raise the budget.
            </div>
          </div>
        </div>
      )}
      <div className={s.teamScroll}>
        <div className={s.teamTable}>
          <div className={`${s.teamGrid} ${s.teamHead}`}>
            <span>Member</span>
            <span className={s.r}>Allocated</span>
            <span className={s.r}>Taken</span>
            <span>Remaining</span>
            <span className={s.r}>Today</span>
            <span className={s.r}>Week</span>
            <span />
            <span />
          </div>
          {sp.team.map((id) => {
            const m = MEM[id] || UNKNOWN;
            const a = +sp.alloc[id] || 0;
            const t = model.g(`pm:${sp.id}:${id}`);
            const r = a - t.all;
            const u = a ? t.all / a : 0;
            const open = exp === `pm:${id}`;
            return (
              <div key={id} className={s.rowLine}>
                <div className={`${s.teamGrid} ${s.teamRow}`}>
                  <button type="button" className={s.memberBtn} onClick={() => openMember(id)}>
                    <Avatar name={m.name} h={m.h} size={28} />
                    <span className={s.minw}>
                      <span className={s.memberName}>{m.name}</span>
                      <span className={s.memberRole}>{m.role}</span>
                    </span>
                  </button>
                  {canEdit ? (
                    <input className={s.allocInput} type="number" min="0" step="5" value={a} onChange={(e) => onAlloc(id, e.target.value)} />
                  ) : (
                    <span className={`${s.r} ${s.b5}`} title="Only the project manager can change allocated hours">
                      {hh(a)}
                    </span>
                  )}
                  <span className={`${s.r} ${s.b6}`}>{hh(t.all)}</span>
                  <div>
                    <div className={s.remText} style={{ color: r < 0 ? RED : MUTED }}>
                      {r >= 0 ? `${hh(r)} left` : `${hh(-r)} over`}
                    </div>
                    <ProgressBar width={pctW(u)} color={barColor(u)} />
                  </div>
                  <span className={s.r}>{hh(t.today)}</span>
                  <span className={s.r}>{hh(t.week)}</span>
                  <button
                    type="button"
                    className={s.togBtn}
                    style={{ background: open ? 'oklch(0.95 0.03 265)' : '#fff' }}
                    onClick={() => setPj({ exp: open ? null : `pm:${id}` })}
                  >
                    {open ? 'Hide ▴' : 'By date ▾'}
                  </button>
                  {canEdit ? (
                    <button type="button" className={s.removeBtn} title="Remove from project" onClick={() => onRemove(id)}>
                      ✕
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
                {open && <MemberDetail detail={memberProjectDetail(logs, model.msOf[sp.id], sp.id, id)} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
