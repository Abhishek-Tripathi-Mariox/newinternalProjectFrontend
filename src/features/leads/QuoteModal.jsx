import { useState } from 'react';
import { useStore } from '@/store';
import { Button, ErrorText, Field, Input, Modal, Textarea } from '@/components/ui';
import { qTotals } from '@/domain/quotes';
import { inr } from '@/lib/format';
import { closeIfStillOpen } from './closeIfStillOpen';
import s from './QuoteModal.module.css';

const DEFAULT_TERMS = '50% advance, 30% on beta, 20% on launch. Third-party licences and hosting billed separately.';

/** Initial form (port of the original openQuote). */
function initialForm(lead, quote) {
  if (quote) {
    return {
      items: quote.items.map((i) => ({ ...i })), disc: String(quote.disc || 0), gst: quote.gst !== false,
      valid: String(quote.valid || 15), terms: quote.terms || '',
    };
  }
  return {
    items: [{ d: `${lead ? lead.service : ''} · design, development & launch`, q: '1', r: String((lead && lead.value) || '') }],
    disc: '0', gst: true, valid: '15', terms: DEFAULT_TERMS,
  };
}

/** Editable quote line (description · qty · rate · amount · remove). */
function LineItem({ item, onChange, onRemove }) {
  const set = (k) => (e) => onChange({ ...item, [k]: e.target.value });
  return (
    <div className={s.line}>
      <Input value={item.d} onChange={set('d')} placeholder="e.g. Android + iOS app" aria-label="Description" />
      <Input type="number" min="1" value={item.q} onChange={set('q')} aria-label="Qty" />
      <Input type="number" min="0" value={item.r} onChange={set('r')} aria-label="Rate (₹)" />
      <span className={s.amt}>{inr((+item.q || 0) * (+item.r || 0))}</span>
      {onRemove ? <button type="button" className={s.remove} title="Remove line" aria-label="Remove line" onClick={onRemove}>✕</button> : <span />}
    </div>
  );
}

/** Quote builder dialog. Props: {leadId, qid?, onClose}. */
export default function QuoteModal({ leadId, qid = null, onClose }) {
  const lead = useStore((st) => st.leads.find((l) => l.id === leadId));
  const saveQuote = useStore((st) => st.saveQuote);
  const [form, setForm] = useState(() => initialForm(lead, qid && lead ? (lead.quotes || []).find((q) => q.id === qid) : null));
  const [err, setErr] = useState('');
  const t = qTotals(form);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setItem = (i, item) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? item : x)) }));
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  const addLine = () => setForm((f) => ({ ...f, items: f.items.concat({ d: '', q: '1', r: '' }) }));

  const save = (send) => {
    const e = saveQuote(leadId, form, qid || null, send);
    if (e) return setErr(e);
    closeIfStillOpen('quote', onClose);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={qid ? `Edit quote ${qid}` : 'New quote'}
      sub={lead ? lead.company : undefined}
      width={760}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save(false)}>Save draft</Button>
          <Button variant="primary" onClick={() => save(true)}>Mark sent &amp; download PDF</Button>
        </>
      )}
    >
      <div className={s.body}>
        <div className={`${s.line} ${s.lineHead}`}><span>Description</span><span>Qty</span><span>Rate (₹)</span><span className={s.right}>Amount</span><span /></div>
        {form.items.map((it, i) => (
          <LineItem key={i} item={it} onChange={(x) => setItem(i, x)} onRemove={form.items.length > 1 ? () => removeItem(i) : null} />
        ))}
        <button type="button" className={s.addLine} onClick={addLine}>+ Add line</button>

        <div className={s.bottom}>
          <div className={s.opts}>
            <div className={s.two}>
              <Field label="Discount %"><Input type="number" min="0" max="100" value={form.disc} onChange={set('disc')} /></Field>
              <Field label="Valid for (days)"><Input type="number" min="1" value={form.valid} onChange={set('valid')} /></Field>
            </div>
            <Field label="Payment terms"><Textarea value={form.terms} onChange={set('terms')} rows={3} /></Field>
          </div>
          <div className={s.totals}>
            <div className={s.tRow}><span className={s.tLabel}>Subtotal</span><span className={s.num}>{inr(t.sub)}</span></div>
            {t.disc > 0 && <div className={s.tRow}><span className={s.tLabel}>Discount</span><span className={s.num}>− {inr(t.disc)}</span></div>}
            <div className={s.tRow}>
              <span className={`${s.tLabel} ${s.gstLabel}`}>
                GST 18%{' '}
                <button
                  type="button"
                  aria-pressed={form.gst}
                  className={`${s.gst} ${form.gst ? s.gstOn : ''}`}
                  onClick={() => setForm((f) => ({ ...f, gst: !f.gst }))}
                >
                  {form.gst ? 'On' : 'Off'}
                </button>
              </span>
              <span className={s.num}>{form.gst ? inr(t.tax) : '—'}</span>
            </div>
            <div className={`${s.tRow} ${s.total}`}><span>Total</span><span className={s.num}>{inr(t.total)}</span></div>
          </div>
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </Modal>
  );
}
