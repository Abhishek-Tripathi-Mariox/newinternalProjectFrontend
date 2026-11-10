import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Select } from '@/components/ui';
import { ACTIVITY_KINDS } from '@/config/constants';
import { dLabel, tLabel } from '@/lib/date';
import s from './DrawerSection.module.css';

/** Activity kind → [hue, label]. */
const AK = {
  status: [265, 'Stage'], call: [150, 'Call'], email: [250, 'Email'], whatsapp: [150, 'WhatsApp'], meeting: [300, 'Meeting'],
  note: [85, 'Note'], quote: [35, 'Quote'], owner: [220, 'Owner'], created: [265, 'Created'], fu: [150, 'Follow-up'],
};

/** Log-an-activity row + merged activity timeline (created, acts, completed follow-ups). */
export default function LeadActivity({ lead, fus, now }) {
  const logAct = useStore((st) => st.logAct);
  const flash = useStore((st) => st.flash);
  const [kind, setKind] = useState('Call');
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);

  const feed = useMemo(() => [{ t: lead.created, kind: 'created', text: `Lead created from ${lead.source}` }]
    .concat(lead.acts || [], fus.filter((f) => f.done && f.due <= now).map((f) => ({ t: f.due, kind: 'fu', text: `${f.type} done · ${f.title}` })))
    .sort((a, b) => b.t - a.t), [lead, fus, now]);

  const add = () => {
    if (!text.trim()) return flash('Write what happened first');
    logAct(lead.id, kind.toLowerCase(), text.trim());
    setText('');
    flash(`${kind} logged`);
  };


  return (
    <div>
      <h3 className={`${s.h3} ${s.mb8}`}>Activity</h3>
      <div className={s.actRow}>
        <Select unstyled value={kind} onChange={(e) => setKind(e.target.value)} className={s.actSelect} options={ACTIVITY_KINDS} aria-label="Activity type" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="What happened? Press Enter to log"
          className={s.actInput}
        />
        <button type="button" className={s.actBtn} onClick={add}>Log</button>
      </div>
      <ol className={s.feed}>
        {(showAll ? feed : feed.slice(0, 6)).map((a, i) => {
          const [h, label] = AK[a.kind] || AK.note;
          return (
            <li key={`${a.t}-${i}`} className={s.feedItem}>
              <span className={s.feedDot} style={{ background: `oklch(0.62 0.13 ${h})` }} aria-hidden="true" />
              <div>
                <div className={s.feedText}><span className={s.actKind} style={{ color: `oklch(0.42 0.12 ${h})` }}>{label}</span> · {a.text}</div>
                <div className={s.feedWhen}>{dLabel(a.t)} · {tLabel(a.t)}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {feed.length > 6 && (
        <button type="button" className={`${s.link} ${s.more}`} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `Show all ${feed.length}`}
        </button>
      )}
    </div>
  );
}
