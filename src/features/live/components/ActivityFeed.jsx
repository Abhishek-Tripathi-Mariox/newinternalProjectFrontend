import { useState } from 'react';
import { Avatar, SegmentedControl } from '@/components/ui';
import { FEED_SEGMENTS } from '../useLiveModel';
import s from './ActivityFeed.module.css';

const PAGE = 30;

/** "Activity today" feed with group filter and show more/less. */
export default function ActivityFeed({ items, filter, onFilter, className }) {
  const [more, setMore] = useState(false);
  const shown = more ? items : items.slice(0, PAGE);
  return (
    <section className={`${s.panel} ${className || ''}`}>
      <div className={s.head}>
        <h2 className={s.title}>Activity today</h2>
        <SegmentedControl options={FEED_SEGMENTS} value={filter} onChange={onFilter} />
      </div>
      <div className={s.list}>
        {shown.map((e) => (
          <div key={e.key} className={s.item}>
            <span className={s.time}>{e.time}</span>
            <Avatar name={e.who} h={e.h} ini={e.ini} size={22} />
            <div className={s.text}>
              <span className={s.dot} style={{ background: e.dot }} />
              <b className={s.who}>{e.who}</b> · {e.text}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className={s.empty}>No activity yet today.</div>}
        {items.length > PAGE && (
          <button type="button" className={s.more} onClick={() => setMore((v) => !v)}>
            {more ? 'Show less' : `Show all ${items.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
