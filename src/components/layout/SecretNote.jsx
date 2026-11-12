import { useState } from 'react';
import { useStore } from '@/store';
import s from './Banners.module.css';

/**
 * One-time invite / password-reset token returned by the API. There is no email service yet,
 * so the admin copies it and passes it on. Shown until dismissed; never stored.
 */
export default function SecretNote() {
  const note = useStore((x) => x.secretNote);
  const clear = useStore((x) => x.clearSecretNote);
  const [copied, setCopied] = useState('');
  if (!note) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note.value);
      setCopied(note.value);
    } catch {
      setCopied('');
    }
  };

  return (
    <section className={s.secret} role="status" aria-live="polite" aria-label={note.title}>
      <div className={s.secretMain}>
        <div className={s.secretTitle}>{note.title}</div>
        <div className={s.secretSub}>{note.sub}</div>
        <code className={s.secretValue} data-testid="secret-token">{note.value}</code>
      </div>
      <div className={s.secretBtns}>
        <button type="button" className={s.secretBtn} onClick={copy}>{copied === note.value ? 'Copied' : 'Copy'}</button>
        <button type="button" className={s.secretClose} onClick={clear}>Dismiss</button>
      </div>
    </section>
  );
}
