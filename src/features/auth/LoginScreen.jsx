import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Field } from '@/components/ui';
import { DEFAULT_PASSWORD } from '@/config/constants';
import s from './LoginScreen.module.css';

const DEMO = [['u-ceo', 'Super Admin'], ['u-mj', 'Project Manager'], ['u-rj', 'Team Lead'], ['u-vg', 'Developer'], ['u-ak', 'Sales']];

/** Full-screen sign-in. Logging in starts the workday (store.login checks the user in). */
export default function LoginScreen() {
  const users = useStore((x) => x.users);
  const login = useStore((x) => x.login);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const demo = useMemo(
    () => DEMO.map(([id, role]) => ({ u: (users || []).find((x) => x.id === id), role })).filter((d) => d.u),
    [users],
  );

  const go = (e, p) => {
    // On success the store signs in, checks the user in and routes to the first allowed page.
    const msg = login(e, p);
    if (msg) {
      setEmail(e);
      setPw(p);
      setErr(msg);
    }
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
          <button type="submit" className={s.submit}>Log in &amp; start my day</button>
        </form>

        {demo.length > 0 && (
          <section className={s.demo} aria-labelledby="demo-title">
            <h2 id="demo-title" className={s.demoHead}>Demo accounts · password {DEFAULT_PASSWORD}</h2>
            {demo.map(({ u, role }) => (
              <button key={u.id} type="button" className={s.demoBtn} onClick={() => go(u.email, u.pw || DEFAULT_PASSWORD)}>
                <span>
                  <span className={s.demoName}>{u.name}</span>
                  <span className={s.demoEmail}>{u.email}</span>
                </span>
                <span className={s.demoRole}>{role}</span>
              </button>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
