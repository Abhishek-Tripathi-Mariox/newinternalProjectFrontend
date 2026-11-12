import { useEffect, useRef, useState } from 'react';
import { Button, ConfirmButton, HuePill, SectionTitle } from '@/components/ui';
import { useStore } from '@/store';
import { copyText } from '@/lib/download';
import s from './integrations.module.css';

const STATUS_HUE = { 'Pending from client': 65, Received: 250, Integrated: 300, Live: 150 };
const SHOW_MS = 30_000;

/** Reveal state for one third party's credentials: {credId: value}; each reveal auto-hides after 30 s. */
function useRevealed(integ) {
  const revealCred = useStore((st) => st.revealCred);
  const [vals, setVals] = useState({});
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const hide = (id) => {
    clearTimeout(timers.current[id]);
    setVals((v) => {
      const { [id]: _, ...rest } = v;
      return rest;
    });
  };
  const put = (id, value) => {
    setVals((v) => ({ ...v, [id]: value }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => hide(id), SHOW_MS);
  };
  /** Value (from what is shown, else fetched — the server logs the view); null on error. */
  const get = async (id) => (vals[id] != null ? vals[id] : revealCred(integ.id, id));
  const show = async (id) => {
    const v = await get(id);
    if (v != null) put(id, v);
    return v;
  };
  return { vals, get, show, hide };
}

/** One credential: label · env · masked value with Show / Copy. */
function CredRow({ c, canReveal, rv }) {
  const flash = useStore((st) => st.flash);
  const value = rv.vals[c.id];
  const copy = async () => {
    const v = await rv.get(c.id);
    if (v == null) return;
    await copyText(v);
    flash(`${c.label} copied`);
  };

  return (
    <div className={s.cred}>
      <span className={s.credLabel}>{c.label}</span>
      <span className={s.env}>{c.env}</span>
      <code className={s.value}>{value != null ? value : '••••••••••'}</code>
      {canReveal ? (
        <span className={s.credBtns}>
          <button type="button" className={s.linkBtn} onClick={() => (value != null ? rv.hide(c.id) : rv.show(c.id))}>{value != null ? 'Hide' : 'Show'}</button>
          <button type="button" className={s.linkBtn} onClick={copy}>Copy</button>
        </span>
      ) : <span className={s.muted}>PM / team only</span>}
    </div>
  );
}

/** One third party card. */
function IntegrationCard({ x, data, pid }) {
  const delInteg = useStore((st) => st.delInteg);
  const openModal = useStore((st) => st.openModal);
  const rv = useRevealed(x);
  const n = x.credentials.length;

  return (
    <div className={s.card}>
      <div className={s.head}>
        <div className={s.minw}>
          <div className={s.name}>
            {x.name}
            {x.url && <a href={x.url} target="_blank" rel="noreferrer" className={s.open}>Open ↗</a>}
          </div>
          <div className={s.sub}>{x.category}{x.notes ? ` · ${x.notes}` : ''}</div>
        </div>
        <div className={s.actions}>
          <HuePill hue={STATUS_HUE[x.status] ?? 265}>{x.status}</HuePill>
          <Button size="sm" variant="ghost" onClick={() => openModal('integView', { pid, id: x.id })}>Show</Button>
          {data.canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => openModal('integ', { pid, editId: x.id })}>Edit</Button>
              <ConfirmButton size="sm" variant="ghost" confirmLabel="Delete?" aria-label={`Delete ${x.name}`} onConfirm={() => delInteg(pid, x.id)}>✕</ConfirmButton>
            </>
          )}
        </div>
      </div>
      {n > 0 ? (
        <div className={s.creds}>
          {x.credentials.map((c) => <CredRow key={c.id} c={c} canReveal={data.canReveal} rv={rv} />)}
        </div>
      ) : (
        <div className={s.muted}>No credentials saved{x.status === 'Pending from client' ? ' — waiting for the client' : ''}.</div>
      )}
    </div>
  );
}

/** Project drawer: third parties used on the project and their (encrypted) credentials. */
export default function IntegrationsSection({ project: sp }) {
  const data = useStore((st) => st.integ[sp.id]);
  const loadInteg = useStore((st) => st.loadInteg);
  const openModal = useStore((st) => st.openModal);
  const isClient = useStore((st) => !!st.auth && (st.users || []).find((u) => u.id === st.auth.uid)?.role === 'r-client');

  useEffect(() => {
    if (!isClient) loadInteg(sp.id);
  }, [sp.id, isClient, loadInteg]);

  if (isClient) return null;
  const items = (data && data.items) || [];
  const live = items.filter((x) => x.status === 'Live').length;

  return (
    <section>
      <SectionTitle
        title="Third parties & credentials"
        sub={data ? `${items.length} third part${items.length === 1 ? 'y' : 'ies'}${live ? ` · ${live} live` : ''}` : 'Loading…'}
        action={data && data.canManage ? <Button size="sm" onClick={() => openModal('integ', { pid: sp.id })}>+ Add third party</Button> : null}
      />
      {data && data.error && <div className={s.muted}>{data.error}</div>}
      {data && !data.error && items.length === 0 && (
        <div className={s.empty}>No third parties yet — add payment gateways, SMS, maps, cloud and other services this project uses, with their keys and logins.</div>
      )}
      {items.map((x) => <IntegrationCard key={x.id} x={x} data={data} pid={sp.id} />)}
    </section>
  );
}
