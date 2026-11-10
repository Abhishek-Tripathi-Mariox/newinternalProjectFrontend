import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useMasters } from '@/store/masters';
import { ActionMenu, Button, DataTable, KpiCard, KpiGrid, SearchInput, Tabs, Toolbar } from '@/components/ui';
import { money } from '@/lib/format';
import { useSetupRows } from './useSetupRows';
import MasterEditModal from './MasterEditModal';
import s from './LeadSetupPage.module.css';

/** Per-tab wording and store actions. */
const KINDS = {
  stages: { label: 'Pipeline stages', noun: 'stage', filter: 'status', add: 'addLeadStatus', rename: 'renameLeadStatus', remove: 'removeLeadStatus', move: 'moveLeadStatus',
    hint: 'Stages are the columns of the leads board, in this order. New, Won and Lost are built in: they can be recoloured but not renamed, moved or removed.' },
  sources: { label: 'Lead sources', noun: 'source', filter: 'source', add: 'addSource', rename: 'renameSource', remove: 'removeSource', move: 'moveSource',
    hint: 'Where leads come from. The order here is the order in every dropdown.' },
  services: { label: 'Services', noun: 'service', filter: 'service', add: 'addService', rename: 'renameService', remove: 'removeService', move: 'moveService',
    hint: 'What Mariox sells. Used on leads (multi-select) and projects. The order here is the order in every list.' },
};

/** Sales → Lead setup: manage pipeline stages, lead sources and services as tables. */
export default function LeadSetupPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('stages');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null); // {mode:'add'|'edit', row?}
  const K = KINDS[tab];
  const m = useMasters();
  const setLf = useStore((st) => st.setLf);
  const all = useSetupRows(tab);
  const counts = { stages: m.leadStatuses.length, sources: m.sources.length, services: m.services.length };

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? all.filter((r) => r.name.toLowerCase().includes(t)) : all;
  }, [all, q]);

  const unused = all.filter((r) => !r.leads && !r.projects).length;
  const kpis = [
    { label: `Total ${K.noun}s`, value: all.length, sub: `${all.length - unused} in use · ${unused} unused` },
    { label: 'Leads covered', value: all.reduce((x, r) => x + r.leads, 0), sub: tab === 'services' ? 'A lead can have several services' : 'Across all values' },
    { label: 'Open pipeline', value: money(all.reduce((x, r) => x + r.pipeline, 0)), sub: 'Open leads only' },
    { label: 'Won revenue', value: money(all.reduce((x, r) => x + r.won, 0)), sub: `${all.reduce((x, r) => x + r.wonCount, 0)} deals won` },
  ];

  const openLeads = (r) => {
    setLf({ q: '', date: 'all', owner: '', source: '', service: '', status: '', flag: '', [K.filter]: r.name });
    navigate('/leads');
  };

  const columns = [
    { key: 'order', label: '#', width: 48, render: (r) => <span className={s.order}>{r.index + 1}</span> },
    {
      key: 'name', label: K.noun[0].toUpperCase() + K.noun.slice(1),
      render: (r) => (
        <span className={s.nameCell}>
          {tab === 'stages'
            ? <span className={s.pill} style={{ background: `oklch(0.95 0.035 ${r.hue})`, color: `oklch(0.42 0.12 ${r.hue})` }}><span className={s.dot} style={{ background: `oklch(0.62 0.15 ${r.hue})` }} />{r.name}</span>
            : <b>{r.name}</b>}
          {r.core && <span className={s.tag}>Built-in</span>}
          {!r.leads && !r.projects && <span className={s.tagMuted}>Unused</span>}
        </span>
      ),
    },
    {
      key: 'leads', label: 'Leads', align: 'right',
      render: (r) => (r.leads ? <button type="button" className={s.link} onClick={() => openLeads(r)} title={`Open leads with this ${K.noun}`}>{r.leads}</button> : <span className={s.muted}>0</span>),
    },
    { key: 'open', label: 'Open', align: 'right', render: (r) => r.open || <span className={s.muted}>0</span> },
    ...(tab === 'services' ? [{ key: 'projects', label: 'Projects', align: 'right', render: (r) => r.projects || <span className={s.muted}>0</span> }] : []),
    { key: 'pipeline', label: 'Open pipeline', align: 'right', render: (r) => (r.pipeline ? money(r.pipeline) : <span className={s.muted}>—</span>) },
    { key: 'won', label: 'Won revenue', align: 'right', render: (r) => (r.won ? <b className={s.won}>{money(r.won)}</b> : <span className={s.muted}>—</span>) },
    {
      key: 'actions', label: 'Actions', align: 'right', width: 120,
      render: (r) => (
        <span className={s.actions}>
          <Button size="sm" onClick={() => setEdit({ mode: 'edit', row: r })}>{r.core ? 'Colour' : 'Edit'}</Button>
          <ActionMenu
            label={`More actions for ${r.name}`}
            items={[
              { label: 'Move up', onClick: () => m[K.move](r.name, -1), disabled: !r.canUp, hidden: r.core },
              { label: 'Move down', onClick: () => m[K.move](r.name, 1), disabled: !r.canDown, hidden: r.core },
              { label: 'View leads', onClick: () => openLeads(r), disabled: !r.leads },
              { label: `Delete ${K.noun}`, danger: true, onClick: () => m[K.remove](r.name), hidden: r.core,
                disabled: !!(r.leads || r.projects), title: r.leads || r.projects ? `In use — move its leads to another ${K.noun} first` : undefined },
            ]}
          />
        </span>
      ),
    },
  ];

  const onSave = (name, hue) => {
    if (edit.mode === 'add') {
      const before = all.length;
      const res = m[K.add](name);
      if (!res) return `Enter a ${K.noun} name.`;
      if (useMasters.getState()[tab === 'stages' ? 'leadStatuses' : tab].length === before) return `A ${K.noun} called “${res}” already exists.`;
      if (tab === 'stages') m.setStageHue(res, hue);
      return undefined;
    }
    const r = edit.row;
    if (!r.core) {
      const e = m[K.rename](r.name, name);
      if (e) return e;
    }
    if (tab === 'stages') m.setStageHue(r.core ? r.name : name.trim().replace(/\s+/g, ' '), hue);
    return undefined;
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Lead setup</h1>
          <div className={s.sub}>Pipeline stages, lead sources and services used across Leads, Dashboard and Projects</div>
        </div>
        <Button variant="primary" onClick={() => setEdit({ mode: 'add' })}>+ Add {K.noun}</Button>
      </div>

      <Tabs
        tabs={Object.entries(KINDS).map(([k, v]) => ({ key: k, label: v.label, count: counts[k] }))}
        value={tab}
        onChange={(k) => { setTab(k); setQ(''); }}
        label="Lead setup lists"
      />

      <KpiGrid min={200}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </KpiGrid>

      <Toolbar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${K.noun}s…`} className={s.search} />
        <span className={s.hint}>{K.hint}</span>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.name}
        itemLabel={`${K.noun}s`}
        pageSize={25}
        resetKey={`${tab}|${q}`}
        empty={q ? `No ${K.noun}s match “${q}”.` : `No ${K.noun}s yet.`}
      />

      {edit && (
        <MasterEditModal
          key={`${tab}-${edit.mode}-${edit.row ? edit.row.name : ''}`}
          title={edit.mode === 'add' ? `Add ${K.noun}` : edit.row.core ? `Stage colour · ${edit.row.name}` : `Edit ${K.noun} · ${edit.row.name}`}
          noun={K.noun}
          initialName={edit.row ? edit.row.name : ''}
          initialHue={edit.row ? edit.row.hue : undefined}
          withColor={tab === 'stages'}
          nameLocked={!!(edit.row && edit.row.core)}
          onSave={onSave}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
