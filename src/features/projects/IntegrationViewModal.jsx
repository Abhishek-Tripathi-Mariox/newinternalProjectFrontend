import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { Button, Field, HuePill, Input, Modal, Textarea } from '@/components/ui';
import { copyText } from '@/lib/download';
import { fd } from '@/lib/date';
import s from './modals.module.css';

const STATUS_HUE = { 'Pending from client': 65, Received: 250, Integrated: 300, Live: 150 };

/**
 * Read-only "Show" view of a project third party (ModalHost kind 'integView'), laid out like the
 * edit form, with every credential value decrypted (each view is written to the activity log).
 * Props: {pid, id}.
 */
export default function IntegrationViewModal({ pid, id, onClose }) {
  const data = useStore((st) => st.integ[pid]) || {};
  const x = (data.items || []).find((i) => i.id === id);
  const revealCred = useStore((st) => st.revealCred);
  const openModal = useStore((st) => st.openModal);
  const flash = useStore((st) => st.flash);
  const [vals, setVals] = useState({});
  const [hidden, setHidden] = useState({});

  useEffect(() => {
    if (!x || !data.canReveal) return undefined;
    let live = true;
    Promise.all(x.credentials.map(async (c) => [c.id, await revealCred(x.id, c.id)])).then((pairs) => {
      if (live) setVals(Object.fromEntries(pairs.filter(([, v]) => v != null)));
    });
    return () => { live = false; };
    // Load once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!x) return null;
  const copy = async (c) => {
    if (vals[c.id] == null) return;
    await copyText(vals[c.id]);
    flash(`${c.label} copied`);
  };

  const footer = (
    <div className={s.footer}>
      <span className={s.spacer} />
      <Button onClick={onClose}>Close</Button>
      {data.canManage && <Button variant="primary" onClick={() => openModal('integ', { pid, editId: x.id })}>Edit</Button>}
    </div>
  );

  return (
    <Modal open onClose={onClose} title={x.name} sub={`${x.category} · ${pid}`} width={640} footer={footer}>
      <div className={s.grid2}>
        <Field label="Third party"><Input value={x.name} readOnly /></Field>
        <Field label="Category"><Input value={x.category} readOnly /></Field>
        <Field as="div" label="Status">
          <div><HuePill hue={STATUS_HUE[x.status] ?? 265}>{x.status}</HuePill></div>
        </Field>
        <Field as="div" label="Dashboard / console link">
          {x.url ? <a href={x.url} target="_blank" rel="noreferrer" className={s.viewLink}>{x.url} ↗</a> : <span className={s.light}>—</span>}
        </Field>
        <Field full label="Notes"><Textarea value={x.notes || '—'} readOnly rows={2} /></Field>

        <div className={`${s.full} ${s.groupLabel}`}>
          <div className={s.row}>
            <span>Credentials</span>
            <span className={s.light}>{x.credentials.length ? 'every view is recorded in the activity log' : ''}</span>
          </div>
          {x.credentials.length === 0 && <span className={s.light}>No credentials saved.</span>}
          {!data.canReveal && x.credentials.length > 0 && <div className={s.lock}>Only the PM and the project team can see credential values.</div>}
          {x.credentials.map((c) => {
            const v = vals[c.id];
            const masked = hidden[c.id];
            return (
              <div key={c.id} className={s.credView}>
                <Input value={c.label} readOnly aria-label="Credential name" />
                <Input value={c.env} readOnly aria-label="Environment" />
                <Input
                  readOnly
                  type={masked ? 'password' : 'text'}
                  value={v != null ? v : data.canReveal ? 'Loading…' : '••••••••••'}
                  aria-label={`${c.label} value`}
                  className={s.mono}
                />
                {data.canReveal ? (
                  <span className={s.credViewBtns}>
                    <button type="button" className={s.addBtn} onClick={() => setHidden((h) => ({ ...h, [c.id]: !h[c.id] }))}>{masked ? 'Show' : 'Hide'}</button>
                    <button type="button" className={s.addBtn} onClick={() => copy(c)}>Copy</button>
                  </span>
                ) : <span />}
              </div>
            );
          })}
          {x.credentials.length > 0 && (
            <span className={s.light}>
              Last changed {fd(Math.max(...x.credentials.map((c) => Date.parse(c.updatedAt) || 0)))}
              {x.credentials.find((c) => c.updatedBy) ? ` by ${x.credentials.find((c) => c.updatedBy).updatedBy}` : ''}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
