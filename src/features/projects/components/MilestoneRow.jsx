import { memo, useMemo, useState } from 'react';
import { Avatar, ConfirmButton, ProgressBar, Select } from '@/components/ui';
import ToggleChip from './ToggleChip';
import { GREEN, MUTED, RED, barColor, projectColor, tone } from '@/lib/color';
import { fd, parseDay, ymd } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { MILESTONE_STATUS } from '@/config/constants';
import { milestoneByMember } from '../lib/logs';
import { msOverdue, val } from '../lib/view';
import { EntryRows, MilestoneNumber } from './bits';
import s from './MilestoneRow.module.css';

const MS_KEYS = Object.keys(MILESTONE_STATUS);

/**
 * Project-drawer milestone row: editable name / allocation (PM only), status
 * select, progress, and the expandable "who logged these hours" breakdown.
 */
function MilestoneRow({ m, project, current, used, T, canEdit, open, openMemberId, logs, memberById, onUpdate, onDelete, onTeam, onToggle, onToggleMember }) {
  const [picking, setPicking] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const notes = m.notes || '';
  const team = m.team || [];
  const toggleTeam = (id) => onTeam && onTeam(m.id, team.includes(id) ? team.filter((x) => x !== id) : team.concat(id));
  const pct = m.alloc ? used / m.alloc : 0;
  const rem = m.alloc - used;
  const od = msOverdue(m, T);
  const t = tone(MILESTONE_STATUS[m.status] ?? 265);
  const breakdown = useMemo(() => (open ? milestoneByMember(logs, m.id) : []), [open, logs, m.id]);
  const people = new Set(logs.filter((l) => l.ms === m.id).map((l) => l.m)).size;

  return (
    <div className={s.row}>
      <MilestoneNumber milestone={m} current={current} large />
      <div className={s.body}>
        <div className={s.top}>
          <div className={s.nameCol}>
            {canEdit ? (
              <input
                className={s.nameInput}
                value={m.name}
                title="Click to rename"
                onChange={(e) => onUpdate(m.id, { name: e.target.value })}
                onBlur={(e) => {
                  if (!e.target.value.trim()) onUpdate(m.id, { name: `Milestone ${m.n}` });
                }}
              />
            ) : (
              <div className={s.name}>{m.name}</div>
            )}
            <div className={s.due} style={{ color: od ? RED : MUTED }}>
              {canEdit ? (
                <label className={s.dueEdit}>
                  Due
                  <input
                    className={s.dueInput}
                    type="date"
                    value={m.due ? ymd(m.due) : ''}
                    aria-label={`${m.name} due date`}
                    onChange={(e) => e.target.value && onUpdate(m.id, { due: parseDay(e.target.value) })}
                  />
                </label>
              ) : (
                <>Due {fd(m.due)}</>
              )}
              {od ? ' · overdue' : ''}
            </div>
          </div>
          <div className={s.controls}>
            <Select unstyled className={s.select} style={{ color: t.fg }} aria-label="Milestone status" value={m.status} options={MS_KEYS} onChange={(e) => onUpdate(m.id, { status: val(e) })} />
            {canEdit ? (
              <label className={s.allocLabel}>
                Alloc. h
                <input
                  className={s.allocInput}
                  type="number"
                  min="0"
                  step="5"
                  value={m.alloc}
                  onChange={(e) => onUpdate(m.id, { alloc: Math.max(0, +e.target.value || 0) })}
                />
              </label>
            ) : (
              <span className={s.pmOnly} title="Only the project manager can change allocated hours">
                {hh(m.alloc || 0)} allocated · PM only
              </span>
            )}
            {canEdit && onDelete && !m.cr && used === 0 && (
              <ConfirmButton size="sm" variant="ghost" confirmLabel="Delete?" aria-label={`Delete ${m.name}`} title="Delete milestone" onConfirm={() => onDelete(m.id)}>
                ✕
              </ConfirmButton>
            )}
          </div>
        </div>

        <div className={s.teamLine}>
          <span className={s.teamLabel}>Team</span>
          {team.length ? (
            team.map((id) => {
              const mem = memberById[id] || { name: id, h: 265 };
              return (
                <span key={id} className={s.teamPerson} title={mem.role || ''}>
                  <Avatar name={mem.name} h={mem.h} size={20} />
                  {mem.name}
                </span>
              );
            })
          ) : (
            <span className={s.muted}>No one assigned</span>
          )}
          {canEdit && onTeam && (
            <button type="button" className={s.teamEdit} onClick={() => setPicking((x) => !x)} aria-expanded={picking}>
              {picking ? 'Done' : team.length ? 'Change' : '+ Assign'}
            </button>
          )}
        </div>
        {picking && (
          <div className={s.teamPick}>
            {(project.team || []).concat(
              Object.values(memberById).filter((x) => !x.inactive && !(project.team || []).includes(x.id)).map((x) => x.id),
            ).map((id) => {
              const mem = memberById[id] || { name: id };
              const onProject = (project.team || []).includes(id);
              return (
                <ToggleChip key={id} on={team.includes(id)} onClick={() => toggleTeam(id)} title={onProject ? `${mem.role || ''} · on this project` : `${mem.role || ''} · joins the project team when picked`}>
                  {mem.name}{onProject ? '' : ' +'}
                </ToggleChip>
              );
            })}
            <span className={s.muted}>“+” = not on the project yet; picking them adds them to the project team.</span>
          </div>
        )}

        <div className={s.progress}>
          <div className={s.bar}>
            <ProgressBar width={pctW(pct)} color={m.status === 'Done' && pct <= 1 ? GREEN : barColor(pct)} />
          </div>
          <span className={s.usedText}>
            <b>{hh(used)}</b> <span className={s.muted}>logged ·</span> <span style={{ color: rem < 0 ? RED : MUTED }}>{rem >= 0 ? `${hh(rem)} left` : `${hh(-rem)} over`}</span>
          </span>
        </div>

        {notes && !notesOpen && (
          <button type="button" className={s.notePreview} onClick={() => setNotesOpen(true)} title="Open notes">
            📝 {notes.length > 140 ? `${notes.slice(0, 140)}…` : notes}
          </button>
        )}
        {notesOpen && (
          <div className={s.notesBox}>
            {canEdit ? (
              <textarea
                className={s.notesInput}
                rows={3}
                value={notes}
                placeholder="Scope, decisions, client feedback, links… (saved as you type)"
                aria-label={`${m.name} notes`}
                onChange={(e) => onUpdate(m.id, { notes: e.target.value })}
                autoFocus
              />
            ) : (
              <div className={s.notesRead}>{notes || 'No notes yet.'}</div>
            )}
          </div>
        )}

        <div className={s.links}>
          <button type="button" className={s.toggle} onClick={() => onToggle(m.id)}>
            {open ? 'Hide member breakdown ▴' : `Who logged these ${hh(used)} ▾`}
          </button>
          {(canEdit || notes) && (
            <button type="button" className={s.toggle} onClick={() => setNotesOpen((x) => !x)}>
              {notesOpen ? 'Close notes ▴' : notes ? 'Notes ▾' : '+ Add notes'}
            </button>
          )}
        </div>

        {open && (
          <div className={s.breakdown}>
            <div className={s.bmSum}>{people} people logged {hh(used)} · click a name to see dates</div>
            {breakdown.map((b) => {
              const mem = memberById[b.id] || { name: '—', h: 265, role: '' };
              const isOpen = openMemberId === b.id;
              return (
                <div key={b.id} className={s.member}>
                  <button type="button" className={s.memberBtn} onClick={() => onToggleMember(isOpen ? null : b.id)}>
                    <Avatar name={mem.name} h={mem.h} size={26} />
                    <span className={s.minw}>
                      <span className={s.memberName}>{mem.name}</span>
                      <span className={s.memberSub}>
                        {mem.role} · {b.days} day{b.days === 1 ? '' : 's'} · {Math.round(b.share * 100)}% of this milestone
                      </span>
                    </span>
                    <ProgressBar width={pctW(b.rel)} color={projectColor(project)} />
                    <span className={s.memberH}>{hh(b.hours)}</span>
                    <span className={s.chev}>{isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen && (
                    <div className={s.memberRows}>
                      <EntryRows rows={b.rows} />
                    </div>
                  )}
                </div>
              );
            })}
            {used === 0 && <div className={s.bmEmpty}>No hours logged on this milestone yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MilestoneRow);

