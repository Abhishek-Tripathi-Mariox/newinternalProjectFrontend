import { useState } from 'react';
import { useStore } from '@/store';
import { Button, ErrorText, Field, Modal, Textarea } from '@/components/ui';
import { STATUS_REASONS } from '@/config/constants';
import ToggleChip from './components/ToggleChip';
import s from './modals.module.css';

/**
 * "Why on hold / delayed" (ModalHost kind 'pstatus'). Props: {pid, status?} — pass status 'On hold'
 * when the project is being put on hold (a reason is then required).
 */
export default function StatusNoteModal({ pid, status, onClose }) {
  const p = useStore((st) => st.projects.find((x) => x.id === pid));
  const setStatusNote = useStore((st) => st.setStatusNote);
  const [reason, setReason] = useState((p && p.statusReason) || '');
  const [note, setNote] = useState((p && p.statusNote) || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  const hold = status === 'On hold' || (!status && p.status === 'On hold');

  const save = async (clear) => {
    if (busy) return;
    setBusy(true);
    const e = await setStatusNote(pid, clear ? { reason: '', note: '' } : { status, reason, note });
    setBusy(false);
    if (e) setErr(e);
  };

  const footer = (
    <div className={s.footer}>
      {!status && (p.statusReason || p.statusNote) && (
        <Button variant="ghost" className={s.del} disabled={busy} onClick={() => save(true)}>Clear note</Button>
      )}
      <span className={s.spacer} />
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={() => save(false)} disabled={busy}>
        {status === 'On hold' ? 'Put on hold' : 'Save note'}
      </Button>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={hold ? `Why is ${p.name} on hold?` : `Why is ${p.name} delayed?`}
      sub="Shown on the project so everyone knows what it is waiting for"
      width={540}
      footer={footer}
    >
      <div className={s.grid2}>
        <Field as="div" full label={<>Reason {hold && <span className={s.light}>· required</span>}</>}>
          <div className={s.chips}>
            {STATUS_REASONS.map((r) => (
              <ToggleChip key={r} on={reason === r} onClick={() => { setReason(reason === r ? '' : r); setErr(''); }}>
                {r}
              </ToggleChip>
            ))}
          </div>
        </Field>
        <Field full label="Details">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={hold ? 'e.g. Waiting for the client’s app content and logo; follow-up on Monday' : 'e.g. Payment gateway KYC pending from Razorpay since 10 Nov'}
            data-autofocus
          />
        </Field>
        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
