import { memo } from 'react';
import { Avatar, KanbanCard } from '@/components/ui';
import { DupTag, HotTag, ScoreTag, StaleTag } from './LeadTags';
import s from './LeadCard.module.css';

/** Kanban card for a lead. `row` = leadRowModel(). */
function LeadCard({ row, onOpen }) {
  const { lead: l, owner } = row;
  return (
    <KanbanCard className={s.card} onClick={() => onOpen(l.id)}>
      <div>
        <div className={s.company}>{l.company}</div>
        <div className={s.sub}>{l.service} · {l.source}</div>
      </div>
      <div className={s.tags}>
        <ScoreTag sp={row.sp}>Score {row.score}</ScoreTag>
        {row.hot && <HotTag />}
        {row.stale && <StaleTag>{row.staleLabel}</StaleTag>}
        {row.dup && <DupTag />}
      </div>
      <div className={s.foot}>
        <span className={s.value}>{row.valueLabel}</span>
        <Avatar name={owner.name} h={owner.h} ini={owner.ini} size={24} />
      </div>
      <div className={s.next} style={{ color: row.nextColor }}>{row.nextLabel}</div>
    </KanbanCard>
  );
}

export default memo(LeadCard);
