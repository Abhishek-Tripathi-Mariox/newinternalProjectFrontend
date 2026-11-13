import { memo } from 'react';
import { AvatarStack } from '@/components/ui';
import { fd } from '@/lib/date';
import { HealthPill, Meter, UsedOf } from './bits';
import s from './shared.module.css';

/** Board card for a project (Projects tab → Board view). */
function ProjectCard({ row, onOpen }) {
  const { I } = row;
  return (
    <div className={s.card} onClick={() => onOpen(row.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(row.id)}>
      <div>
        <div className={s.cardTitle}>{row.name}</div>
        <div className={s.sub}>
          {row.client} · {row.msName}
        </div>
      </div>
      <Meter
        left={<UsedOf used={row.usedLabel} of={row.budgetLabel} />}
        right={<HealthPill bg={I.hBg} fg={I.hFg}>{I.hLabel}</HealthPill>}
        width={row.barW}
        color={row.barBg}
      />
      <div className={s.cardFoot}>
        <AvatarStack people={row.team} max={4} />
        <span className={s.cardDue} title={`Onboarded ${I.p.start ? fd(I.p.start) : '—'} · due ${I.p.due ? fd(I.p.due) : '—'}`}>
          <span className={s.cardStart}>{I.p.start ? `${fd(I.p.start)} → ` : ''}</span>
          <span style={{ color: I.dueColor }}>{I.p.due ? fd(I.p.due) : ''} · {I.dueSub}</span>
        </span>
      </div>
    </div>
  );
}

export default memo(ProjectCard);
