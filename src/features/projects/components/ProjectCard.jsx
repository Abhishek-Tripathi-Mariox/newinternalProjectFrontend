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
        {(row.pmName || row.primaryNames.length > 0) && (
          <div className={s.sub}>
            {row.pmName ? `PM ${row.pmName}` : ''}
            {row.pmName && row.primaryNames.length ? ' · ' : ''}
            {row.primaryNames.length ? `★ ${row.primaryNames.join(', ')}` : ''}
          </div>
        )}
        {(row.openT > 0 || row.openB > 0) && (
          <div className={s.sub}>
            {row.openT} open task{row.openT === 1 ? '' : 's'} · <span style={row.openB ? { color: 'oklch(0.52 0.18 25)', fontWeight: 600 } : undefined}>{row.openB} bug{row.openB === 1 ? '' : 's'}</span>
          </div>
        )}
        {(I.p.statusReason || I.p.statusNote) && (
          <div className={s.cardReason} title={I.p.statusNote || I.p.statusReason}>
            {I.p.status === 'On hold' ? '⏸ ' : '⚠ '}
            {I.p.statusReason || 'Note'}
            {I.p.statusNote ? ` · ${I.p.statusNote}` : ''}
          </div>
        )}
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
