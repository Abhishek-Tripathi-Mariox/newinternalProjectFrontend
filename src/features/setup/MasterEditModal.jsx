import { useState } from 'react';
import { Button, ErrorText, Field, Input, Modal } from '@/components/ui';
import s from './LeadSetupPage.module.css';

/** Colour choices for stages (hues). */
const HUES = [250, 220, 190, 150, 120, 95, 70, 45, 25, 340, 300, 265];

/**
 * Add / rename a list value. `onSave(name, hue)` resolves to an error message or undefined.
 * Stages also pick a colour.
 */
export default function MasterEditModal({ title, noun, initialName = '', initialHue, withColor, nameLocked, onSave, onClose }) {
  const [name, setName] = useState(initialName);
  const [hue, setHue] = useState(initialHue ?? HUES[0]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!name.trim()) return setErr(`Enter a ${noun} name.`);
    setBusy(true);
    const e = await onSave(name, hue);
    setBusy(false);
    if (e) return setErr(e);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={440}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy} aria-busy={busy}>{initialName ? 'Save changes' : `Add ${noun}`}</Button>
        </>
      )}
    >
      <Field label="Name" required={!nameLocked} hint={nameLocked ? 'Built-in stage — the name is fixed, the colour can change.' : undefined}>
        <Input
          value={name}
          disabled={nameLocked}
          invalid={!!err}
          placeholder={`e.g. ${noun === 'stage' ? 'Demo scheduled' : noun === 'source' ? 'Trade show' : 'Cloud migration'}`}
          onChange={(e) => { setName(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          data-autofocus={nameLocked ? undefined : true}
        />
      </Field>
      {withColor && (
        <Field label="Colour" as="div">
          <div className={s.swatches} role="radiogroup" aria-label="Stage colour">
            {HUES.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={hue === h}
                aria-label={`Colour ${h}`}
                className={s.swatch}
                style={{ background: `oklch(0.62 0.15 ${h})`, boxShadow: hue === h ? `0 0 0 2px #fff, 0 0 0 4px oklch(0.62 0.15 ${h})` : 'none' }}
                onClick={() => setHue(h)}
              />
            ))}
          </div>
          <div className={s.preview}>
            Preview <span className={s.pill} style={{ background: `oklch(0.95 0.035 ${hue})`, color: `oklch(0.42 0.12 ${hue})` }}>
              <span className={s.dot} style={{ background: `oklch(0.62 0.15 ${hue})` }} />{name.trim() || 'Stage name'}
            </span>
          </div>
        </Field>
      )}
      {err && <ErrorText>{err}</ErrorText>}
    </Modal>
  );
}
