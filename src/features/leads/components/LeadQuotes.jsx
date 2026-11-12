import { useStore } from '@/store';
import { dLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { quoteTone } from '../leadUtils';
import s from './DrawerSection.module.css';

const STAMPS = [['Created', 'created'], ['Sent', 'sentAt'], ['Viewed', 'viewedAt'], ['Accepted', 'acceptedAt'], ['Declined', 'declinedAt']];

/** Quotes on a lead, newest first, with lifecycle actions. */
export default function LeadQuotes({ lead }) {
  const openModal = useStore((st) => st.openModal);
  const setQuote = useStore((st) => st.setQuote);
  const printQuote = useStore((st) => st.printQuote);
  const qs = lead.quotes || [];
  const pdf = (q) => printQuote(lead.id, q.id);

  return (
    <div>
      <div className={s.head}>
        <h3 className={s.h3}>Quotes <span className={s.count}>{qs.length ? qs.length : ''}</span></h3>
        <button type="button" className={s.link} onClick={() => openModal('quote', { leadId: lead.id })}>+ New quote</button>
      </div>
      {qs.slice().reverse().map((q) => {
        const t = quoteTone(q.status);
        const n = q.items.length;
        const meta = `${n} line${n > 1 ? 's' : ''} · ${STAMPS.filter(([, k]) => q[k]).map(([l, k]) => `${l} ${dLabel(q[k])}`).join(' · ')}`;
        const out = q.status === 'Sent' || q.status === 'Viewed';
        return (
          <div key={q.id} className={s.quote}>
            <div className={s.quoteTop}>
              <span className={s.mono}>{q.id}</span>
              <span className={s.qStatus} style={{ background: t.bg, color: t.fg }}>{q.status}</span>
              <span className={s.qTotal}>{money(q.total)}</span>
            </div>
            <div className={s.meta}>{meta}</div>
            <div className={s.btns}>
              {q.status === 'Draft' && <button type="button" className={s.sm} onClick={() => openModal('quote', { leadId: lead.id, qid: q.id })}>Edit &amp; send</button>}
              {q.status === 'Sent' && <button type="button" className={s.sm} onClick={() => setQuote(lead.id, q.id, 'Viewed')}>Mark viewed</button>}
              {out && (
                <>
                  <button type="button" className={`${s.sm} ${s.ok}`} onClick={() => setQuote(lead.id, q.id, 'Accepted')}>Accepted</button>
                  <button type="button" className={`${s.sm} ${s.bad}`} onClick={() => setQuote(lead.id, q.id, 'Declined')}>Declined</button>
                </>
              )}
              <button type="button" className={s.sm} onClick={() => pdf(q)}>PDF</button>
            </div>
          </div>
        );
      })}
      {qs.length === 0 && <div className={s.empty}>No quotes yet. Build one from service lines and send it as a PDF.</div>}
    </div>
  );
}
