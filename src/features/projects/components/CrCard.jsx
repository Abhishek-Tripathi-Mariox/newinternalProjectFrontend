import { memo } from 'react';
import { AvatarStack, Button, ProgressBar } from '@/components/ui';
import s from './CrCard.module.css';

/**
 * Change-request card in the project drawer. `row` is a crView() model.
 * Workflow buttons only show for the project's PM (row.isDraft / isSent / …).
 */
function CrCard({ row: c, onOpen, onAct, onPdf }) {
  return (
    <div className={s.card}>
      <div className={s.head}>
        <button type="button" className={s.titleBtn} onClick={() => onOpen(c)}>
          <div className={s.meta}>
            <span className={s.mono}>{c.id}</span> · {c.by} · raised {c.raised}
          </div>
          <div className={s.title}>{c.title}</div>
        </button>
        <span className={s.badge} style={{ background: c.sBg, color: c.sFg }}>
          {c.status}
        </span>
      </div>

      <div className={s.figures}>
        <span>
          <b>{c.hours}</b> <span className={s.muted}>estimate</span>
        </span>
        <span>
          <b>{c.amount}</b> <span className={s.muted}>value</span>
        </span>
        <span>
          <b>{c.days}</b> <span className={s.muted}>timeline</span>
        </span>
        {c.docs && <span className={s.docs}>{c.docs}</span>}
      </div>

      {c.hasUsed && (
        <div className={s.used}>
          <div className={s.grow}>
            <ProgressBar width={c.barW} color={c.barBg} />
          </div>
          <span className={s.usedText}>{c.used}</span>
        </div>
      )}
      {c.track && <div className={s.track}>{c.track}</div>}
      {c.over && <div className={s.over}>Over estimate · {c.overL}</div>}
      {c.near && <div className={s.near}>{c.nearL}</div>}

      <div className={s.moneyRow}>
        <span className={s.money} style={{ color: c.profitColor }}>
          {c.moneyL}
        </span>
        {c.team.length > 0 && (
          <span className={s.team}>
            <AvatarStack people={c.team} max={5} />
            <span className={s.muted}>{c.tasksL}</span>
          </span>
        )}
      </div>
      {c.sigL && <div className={s.sig}>✓ {c.sigL}</div>}
      {c.note && <div className={s.note}>“{c.note}”</div>}

      <div className={s.actions}>
        {c.isDraft && (
          <Button size="sm" variant="primary" onClick={() => onAct(c.id, 'send')}>
            Send to client
          </Button>
        )}
        {c.isSent && (
          <>
            <Button size="sm" variant="primary" className={s.approve} onClick={() => onAct(c.id, 'approve')}>
              Mark approved
            </Button>
            <Button size="sm" variant="dangerOutline" onClick={() => onAct(c.id, 'reject')}>
              Mark rejected
            </Button>
          </>
        )}
        {c.isApproved && (
          <Button size="sm" variant="primary" onClick={() => onAct(c.id, 'start')}>
            Start work
          </Button>
        )}
        {c.isProg && (
          <Button size="sm" variant="primary" className={s.approve} onClick={() => onAct(c.id, 'done')}>
            Mark done
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => onOpen(c)}>
          Details &amp; documents
        </Button>
        {c.sigL && (
          <Button size="sm" variant="secondary" onClick={() => onPdf(c.c)}>
            Approval PDF
          </Button>
        )}
      </div>
    </div>
  );
}

export default memo(CrCard);
