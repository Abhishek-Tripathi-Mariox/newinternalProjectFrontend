import { useState } from 'react';
import { useStore } from '@/store';
import { Field } from '@/components/ui';
import s from './LoginScreen.module.css';

/** Full-screen sign-in against the API. Logging in starts the workday (store.login checks the user in). */
export default function LoginScreen() {
  const login = useStore((x) => x.login);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e, p) => {
    if (busy) return;
    if (!e.trim() || !p) return setErr('Enter your work email and password.');
    setBusy(true);
    // On success the store signs in, loads the portal data, checks the user in and routes to the first allowed page.
    const msg = await login(e, p);
    setBusy(false);
    if (msg) setErr(msg);
  };

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

        <form
          className={s.card}
          noValidate
          aria-labelledby="login-title"
          onSubmit={(e) => {
            e.preventDefault();
            go(email, pw);
          }}
        >
          <div>
            <h1 id="login-title" className={s.title}>Log in</h1>
            <div className={s.sub}>Logging in starts your workday. Logging out ends it.</div>
          </div>
          <Field label="Work email">
            <input
              className={s.input}
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              placeholder="name@marioxsoftware.com"
              aria-invalid={!!err || undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr('');
              }}
            />
          </Field>
          <Field label="Password">
            <input
              className={s.input}
              type="password"
              autoComplete="current-password"
              value={pw}
              placeholder="••••••••"
              aria-invalid={!!err || undefined}
              onChange={(e) => {
                setPw(e.target.value);
                setErr('');
              }}
            />
          </Field>
          {err && <div className={s.err} role="alert">{err}</div>}
          <button type="submit" className={s.submit} disabled={busy} aria-busy={busy}>{busy ? 'Signing in…' : <>Log in &amp; start my day</>}</button>
        </form>

      </div>
    </div>
  );
}
