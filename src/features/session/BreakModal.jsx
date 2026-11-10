import { useState } from 'react';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { Modal, Button, Field, Input } from '@/components/ui';
import { BREAK_TYPES } from '@/config/constants';
import { clock, MINUTE } from '@/lib/date';
import s from './BreakModal.module.css';

/** "Take a break" — pick a break type and optional note. Props: `{pid, onClose}`. */
export default function BreakModal({ pid, onClose }) {
  const now = useNow(15000);
  const startBreak = useStore((st) => st.startBreak);
  const [type, setType] = useState('Lunch');
  const [note, setNote] = useState('');
  const mins = (BREAK_TYPES.find((b) => b[0] === type) || [0, 15])[1];

  const start = () => {
    startBreak(pid, type, note);
    onClose?.();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Take a break"
      sub="Your timer pauses until you resume"
      width={460}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button className={s.start} onClick={start}>Start break</Button>
        </>
      )}
    >
      <div className={s.body}>
        <div className={s.options} role="radiogroup" aria-label="Break type">
          {BREAK_TYPES.map(([label, m]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={type === label}
              className={`${s.option} ${type === label ? s.optionOn : ''}`}
              onClick={() => setType(label)}
            >
              <span className={s.optLabel}>{label}</span>
              <span className={s.optMins}>{m} min</span>
            </button>
          ))}
        </div>
        <Field label="Note for the team (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Reachable on phone" />
        </Field>
        <div className={s.back}>You’ll be shown as on break. Back by {clock(now + mins * MINUTE)}.</div>
      </div>
    </Modal>
  );
}
