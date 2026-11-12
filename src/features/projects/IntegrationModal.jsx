import { useState } from 'react';
import { useStore } from '@/store';
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import s from './modals.module.css';

const INTEG_CATEGORIES = ['Payment gateway', 'SMS / WhatsApp', 'Email', 'Maps / location', 'Cloud / hosting', 'Login / auth', 'Push notifications',
  'Analytics', 'App Store / Play Store', 'Domain / DNS', 'Other'];
const INTEG_STATUSES = ['Pending from client', 'Received', 'Integrated', 'Live'];
const ENVS = ['Live', 'Test', 'Both'];
/** Common third parties (name suggestions). */
const SUGGEST = ['Razorpay', 'Stripe', 'PayU', 'Cashfree', 'PhonePe', 'Paytm', 'Twilio', 'MSG91', 'Gupshup', 'WhatsApp Business API', 'SendGrid',
  'Amazon SES', 'Mailgun', 'Google Maps', 'Mapbox', 'AWS', 'Google Cloud', 'Firebase', 'Vercel', 'Netlify', 'DigitalOcean', 'Google Sign-In',
  'Apple Sign-In', 'Auth0', 'OneSignal', 'Google Analytics', 'Mixpanel', 'Apple App Store', 'Google Play Console', 'GoDaddy', 'Cloudflare'];
const EMPTY_CRED = { label: '', env: 'Live', value: '' };

/** Add / edit a project third party and its credentials (ModalHost kind 'integ'). Props: {pid, editId?}. */
export default function IntegrationModal({ pid, editId, onClose }) {
  const item = useStore((st) => (editId ? ((st.integ[pid] || {}).items || []).find((x) => x.id === editId) : null));
  const enabled = useStore((st) => (st.integ[pid] || {}).credentialsEnabled !== false);
  const saveInteg = useStore((st) => st.saveInteg);
  const [form, setForm] = useState(() => (item
    ? { name: item.name, category: item.category, status: item.status, url: item.url || '', notes: item.notes || '', creds: item.credentials.map((c) => ({ id: c.id, label: c.label, env: c.env, value: '' })) }
    : { name: '', category: 'Payment gateway', status: 'Pending from client', url: '', notes: '', creds: [{ ...EMPTY_CRED }] }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCred = (i, patch) => setForm((f) => ({ ...f, creds: f.creds.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const e = await saveInteg(pid, enabled ? form : { ...form, creds: form.creds.filter((c) => c.id) }, editId);
    setBusy(false);
    if (e) setErr(e);
  };

  const footer = (
    <div className={s.footer}>
      <span className={s.spacer} />
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : editId ? 'Save changes' : 'Add third party'}</Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={editId ? `Edit ${item ? item.name : 'third party'}` : 'Add third party'} width={640} footer={footer}>
      <div className={s.grid2}>
        <Field label="Third party">
          <Input value={form.name} onChange={set('name')} list="integ-suggest" placeholder="e.g. Razorpay, Twilio, Firebase" data-autofocus />
          <datalist id="integ-suggest">{SUGGEST.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={set('category')} options={INTEG_CATEGORIES} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')} options={INTEG_STATUSES} />
        </Field>
        <Field label="Dashboard / console link">
          <Input value={form.url} onChange={set('url')} placeholder="https://dashboard.razorpay.com" />
        </Field>
        <Field full label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Whose account, plan, who gave the access, renewal date…" />
        </Field>

        <div className={`${s.full} ${s.groupLabel}`}>
          <div className={s.row}>
            <span>Credentials</span>
            <span className={s.light}>stored encrypted · only the PM and project team can view</span>
          </div>
          {!enabled ? (
            <div className={s.lock}>Saving credentials is turned off on the server. Ask the admin to set CREDENTIALS_KEY in the backend .env.</div>
          ) : (
            <>
              {form.creds.map((c, i) => (
                <div key={c.id || `n${i}`} className={s.credRow}>
                  <Input value={c.label} onChange={(e) => setCred(i, { label: e.target.value })} placeholder="e.g. API key, Secret, Login email, Password" aria-label="Credential name" />
                  <Select value={c.env} onChange={(e) => setCred(i, { env: e.target.value })} options={ENVS} aria-label="Environment" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={c.value}
                    onChange={(e) => setCred(i, { value: e.target.value })}
                    placeholder={c.id ? '•••••• unchanged — type to replace' : 'Value'}
                    aria-label="Credential value"
                  />
                  <button type="button" className={s.removeBtn} aria-label="Remove credential" onClick={() => setForm((f) => ({ ...f, creds: f.creds.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button type="button" className={s.addBtn} onClick={() => setForm((f) => ({ ...f, creds: f.creds.concat({ ...EMPTY_CRED }) }))}>+ Add credential</button>
            </>
          )}
        </div>
        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
