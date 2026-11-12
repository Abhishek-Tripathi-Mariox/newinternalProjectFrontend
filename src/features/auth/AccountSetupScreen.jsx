import { useState } from 'react';
import { useStore } from '@/store';
import { Field } from '@/components/ui';
import { navigate } from '@/store/navigation';
import s from './LoginScreen.module.css';

const MODES = {
  'accept-invite': {
    title: 'Set up your account',
    sub: 'Choose a password to activate your Mariox portal account.',
    button: 'Activate account',
    busy: 'Activating…',
  },
  'reset-password': {
    title: 'Set a new password',
    sub: 'Choose a new password for your Mariox portal account.',
    button: 'Save new password',
    busy: 'Saving…',
  },
};

/**
 * Public page opened from the emailed link (or a link the admin shared if email failed):
 *   /accept-invite?email=…&token=…   → sets the password, activates the account and signs in
 *   /reset-password?email=…&token=…  → sets a new password, then back to sign-in
 */
export default function AccountSetupScreen({ mode }) {
  const M = MODES[mode];
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const action = useStore((x) => (mode === 'accept-invite' ? x.acceptInvite : x.resetPassword));
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    if (pw !== pw2) return setErr('The two passwords don’t match.');
    setBusy(true);
    const msg = await action(email, token, pw);
    setBusy(false);
    if (msg) setErr(msg);
  };

  const broken = !email || !token;

  return (
    <div className={s.screen}>
      <div className={s.col}>
        <div className={s.brand}>
          <div className={s.mark} aria-hidden="true">M</div>
          <div>
            <div className={s.brandName}>Mariox Software</div>
            <div className={s.brandSub}>Team portal</div>
          </div>
        </div>

        <form className={s.card} noValidate aria-labelledby="setup-title" onSubmit={submit}>
          <div>
            <h1 id="setup-title" className={s.title}>{M.title}</h1>
            <div className={s.sub}>{broken ? 'This link is incomplete. Ask your admin to send it again.' : M.sub}</div>
          </div>
          {!broken && (
            <>
              <Field label="Work email">
                <input className={s.input} type="email" value={email} readOnly autoComplete="username" />
              </Field>
              <Field label="New password">
                <input
                  className={s.input}
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={pw}
                  placeholder="At least 8 characters"
                  aria-invalid={!!err || undefined}
                  onChange={(e) => { setPw(e.target.value); setErr(''); }}
                />
              </Field>
              <Field label="Confirm password">
                <input
                  className={s.input}
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  aria-invalid={!!err || undefined}
                  onChange={(e) => { setPw2(e.target.value); setErr(''); }}
                />
              </Field>
              {err && <div className={s.err} role="alert">{err}</div>}
              <button type="submit" className={s.submit} disabled={busy} aria-busy={busy}>{busy ? M.busy : M.button}</button>
            </>
          )}
          <button type="button" className={s.link} onClick={() => navigate('/')}>Back to sign in</button>
        </form>
      </div>
    </div>
  );
}
