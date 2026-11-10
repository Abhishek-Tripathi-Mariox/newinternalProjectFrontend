import { useState } from 'react';
import s from './AddChip.module.css';

/**
 * "+ Add service" chip that turns into a small inline input.
 * Enter → onAdd(text) (the input closes when it returns a truthy value); Esc / blur with empty text cancels.
 */
export default function AddChip({ label = '+ Add service', placeholder = 'New service', onAdd }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const close = () => { setEditing(false); setText(''); };
  const submit = () => {
    if (!text.trim()) return close();
    if (onAdd(text)) close();
  };

  if (!editing) {
    return (
      <button type="button" className={s.chip} onClick={() => setEditing(true)}>{label}</button>
    );
  }
  return (
    <input
      autoFocus
      className={s.input}
      value={text}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      }}
      onBlur={() => { if (!text.trim()) close(); }}
    />
  );
}
