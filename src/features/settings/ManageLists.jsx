import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { tone } from '@/lib/color';
import { CORE_STAGES, useLeadStatuses, useMasters, useServices, useSources } from '@/store/masters';
import s from './SettingsModal.module.css';

/** One editable list: chips with × and an input + Add button. */
function ListGroup({ title, sub, items, onAdd, onRemove, placeholder, locked = [] }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    if (onAdd(text)) setText('');
  };
  return (
    <section className={s.group} aria-label={title}>
      <div className={s.groupHead}>
        <span className={s.rowTitle}>{title}</span>
        <span className={s.rowSub}>{sub}</span>
      </div>
      <div className={s.listChips}>
        {items.map(({ name, dot }) => (
          <span key={name} className={s.listChip}>
            {dot && <span className={s.dot} style={{ background: dot }} />}
            {name}
            {locked.includes(name) ? (
              <span className={s.lock} title="Core stage — can't be removed">·</span>
            ) : (
              <button type="button" className={s.remove} aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={() => onRemove(name)}>×</button>
            )}
          </span>
        ))}
      </div>
      <div className={s.addRow}>
        <Input
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button onClick={add} disabled={!text.trim()}>Add</Button>
      </div>
    </section>
  );
}

/** Settings → Manage lists: lead stages, sources and services. */
export default function ManageLists() {
  const stages = useLeadStatuses();
  const sources = useSources();
  const services = useServices();
  const m = useMasters.getState();

  return (
    <div className={s.lists}>
      <ListGroup
        title="Lead stages"
        sub="Pipeline order · new stages go before Won"
        items={stages.map(([name, h]) => ({ name, dot: tone(h).dot }))}
        locked={CORE_STAGES}
        placeholder="New stage name"
        onAdd={m.addLeadStatus}
        onRemove={m.removeLeadStatus}
      />
      <ListGroup
        title="Sources"
        sub="Where leads come from"
        items={sources.map((name) => ({ name }))}
        placeholder="New source"
        onAdd={m.addSource}
        onRemove={m.removeSource}
      />
      <ListGroup
        title="Services"
        sub="Used by leads and projects"
        items={services.map((name) => ({ name }))}
        placeholder="New service"
        onAdd={m.addService}
        onRemove={m.removeService}
      />
    </div>
  );
}
