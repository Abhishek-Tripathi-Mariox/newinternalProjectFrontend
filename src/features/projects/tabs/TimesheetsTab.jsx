import { useMemo } from 'react';
import { useStore } from '@/store';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { Button, DataTable, Pagination, SegmentedControl, usePagination } from '@/components/ui';
import { INK, projectColor } from '@/lib/color';
import { dLabel, ymd } from '@/lib/date';
import { downloadCsv } from '@/lib/download';
import { hh } from '@/lib/format';
import { MiniAvatar } from '../components/TaskCard';
import { memberAvatar } from '../workItems';
import s from './WorkTabs.module.css';

const VIEWS = [['entries', 'Entries'], ['matrix', 'Member × project']];
const CSV_HEAD = ['Date', 'Member', 'Team', 'Project', 'Milestone', 'Hours', 'Work done'];

/**
 * Timesheets tab: filtered entries (paginated, deletable) or a member × project
 * matrix whose cells drill into the matching entries. Exports CSV.
 */
export default function TimesheetsTab() {
  const pj = useStore((st) => st.pj);
  const setPj = useStore((st) => st.setPj);
  const delLog = useStore((st) => st.delLog);
  const flash = useStore((st) => st.flash);
  const { LF, inR, pF, memF, g, hk, MEM, PRJ, MSS, periodLabel } = useProjectsModel();
  const view = pj.tsView === 'matrix' ? 'matrix' : 'entries';

  const ents = useMemo(
    () => LF.filter((l) => inR(l.d)).sort((a, b) => b.d - a.d || ((MEM[a.m] || {}).name || '').localeCompare((MEM[b.m] || {}).name || '')),
    [LF, inR, MEM],
  );
  const total = useMemo(() => ents.reduce((x, l) => x + l.h, 0), [ents]);

  const mx = useMemo(() => {
    const cell = (m, p) => g(`pm:${p.id}:${m.id}`).range;
    const cols = pF.filter((p) => g(hk(p)).range > 0);
    const mems = memF.filter((m) => cols.some((p) => cell(m, p) > 0));
    let max = 0;
    mems.forEach((m) => cols.forEach((p) => { max = Math.max(max, cell(m, p)); }));
    const rows = mems.map((m) => ({ m, total: cols.reduce((x, p) => x + cell(m, p), 0), cells: cols.map((p) => ({ p, v: cell(m, p) })) }));
    const totals = cols.map((p) => mems.reduce((x, m) => x + cell(m, p), 0));
    return { cols, rows, totals, grand: totals.reduce((a, b) => a + b, 0), max };
  }, [pF, memF, g, hk]);

  const openP = (id) => setPj({ selP: id, selM: null, exp: null, exp2: null, pDay: null });
  const openM = (id) => setPj({ selM: id, selP: null, mDay: null, exp: null, exp2: null });
  const drill = (mid, pid) => {
    const cur = useStore.getState().pj;
    setPj({ tsView: 'entries', f: { ...cur.f, member: mid, project: pid } });
  };

  const exportCsv = () => {
    const rows = ents.map((l) => [ymd(l.d), (MEM[l.m] || {}).name, (MEM[l.m] || {}).team, (PRJ[l.p] || {}).name, (MSS[l.ms] || {}).name, l.h, l.note]);
    downloadCsv([CSV_HEAD, ...rows], `mariox-timesheets-${ymd(Date.now())}.csv`, { bom: false });
    flash(`Exported ${rows.length} entries`);
  };

  const columns = [
    {
      key: 'd', label: 'Date', render: (l) => (
        <div className={s.nowrap}>
          <div className={s.b500}>{dLabel(l.d)}</div>
          <div className={s.muted} style={{ fontSize: 12 }}>{new Date(l.d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        </div>
      ),
    },
    {
      key: 'm', label: 'Member', render: (l) => {
        const av = memberAvatar(MEM[l.m]);
        return (
          <button type="button" className={s.linkBtn} onClick={(e) => { e.stopPropagation(); openM(l.m); }}>
            <MiniAvatar av={av} /><span className={s.b500}>{av.name}</span>
          </button>
        );
      },
    },
    {
      key: 'p', label: 'Project', render: (l) => (
        <button type="button" className={s.linkBtn} onClick={(e) => { e.stopPropagation(); openP(l.p); }}>
          <span className={s.sq8} style={{ background: projectColor(PRJ[l.p]) }} />{PRJ[l.p] ? PRJ[l.p].name : '—'}
        </button>
      ),
    },
    { key: 'ms', label: 'Milestone', render: (l) => <span className={s.nowrap} style={{ color: 'oklch(0.4 0.012 265)' }}>{MSS[l.ms] ? MSS[l.ms].name : '—'}</span> },
    { key: 'note', label: 'Work done', render: (l) => <span style={{ color: 'oklch(0.4 0.012 265)' }}>{l.note || '—'}</span> },
    { key: 'h', label: 'Hours', align: 'right', render: (l) => <span className={s.b600}>{hh(l.h)}</span> },
    {
      key: 'del', label: '', align: 'right', render: (l) => (
        <button type="button" className={s.delBtn} title="Delete entry" onClick={(e) => { e.stopPropagation(); delLog(l.id); }}>✕</button>
      ),
    },
  ];

  // Matrix rows (members) are paginated; the Total row still sums every member in the filter.
  const mxPager = usePagination(mx.rows);
  return (
    <div className={s.stack}>
      <div className={s.bar}>
        <SegmentedControl options={VIEWS} value={view} onChange={(v) => setPj({ tsView: v })} />
        <div className={s.group}>
          <div className={s.summary}><span className={s.strong}>{hh(total)}</span> · {ents.length} entries · {periodLabel.toLowerCase()}</div>
          <Button variant="secondary" onClick={exportCsv}>Export timesheet CSV</Button>
        </div>
      </div>

      {view === 'entries' ? (
        <div>
          <DataTable itemLabel="entries" columns={columns} rows={ents} rowKey={(l) => l.id} minWidth={960} empty="No hours logged for these filters." />
        </div>
      ) : (
        <>
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
            <table className={s.table} style={{ width: 'auto', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th className={s.stickyHead}>Member</th>
                  {mx.cols.map((p) => (
                    <th key={p.id} className={s.mxTh}>
                      <div className={s.mxThInner}><span className={s.sq} style={{ background: projectColor(p) }} /><span className={s.nowrap}>{p.name}</span></div>
                    </th>
                  ))}
                  <th className={s.right}>Total</th>
                </tr>
              </thead>
              <tbody>
                {mxPager.pageItems.map((r) => {
                  const av = memberAvatar(r.m);
                  return (
                    <tr key={r.m.id}>
                      <td className={s.sticky} style={{ padding: '8px 14px' }}>
                        <button type="button" className={s.linkBtn} onClick={() => openM(r.m.id)}><MiniAvatar av={av} /><span className={s.b500}>{av.name}</span></button>
                      </td>
                      {r.cells.map(({ p, v }) => {
                        const ratio = mx.max ? v / mx.max : 0;
                        return (
                          <td key={p.id} className={s.mxTd}>
                            <button
                              type="button"
                              className={s.mxCell}
                              title={`${r.m.name} on ${p.name}: ${hh(v)}`}
                              onClick={() => drill(r.m.id, p.id)}
                              style={{
                                fontWeight: v ? 600 : 400,
                                background: v ? `oklch(0.6 0.15 265 / ${(0.07 + ratio * 0.38).toFixed(2)})` : 'transparent',
                                color: v ? INK : 'oklch(0.75 0.01 265)',
                              }}
                            >
                              {v ? hh(v) : '·'}
                            </button>
                          </td>
                        );
                      })}
                      <td className={`${s.right} ${s.b600}`} style={{ padding: '8px 14px' }}>{hh(r.total)}</td>
                    </tr>
                  );
                })}
                <tr className={s.totalRow}>
                  <td className={s.stickyHead}>Total</td>
                  {mx.totals.map((t, i) => <td key={mx.cols[i].id}>{hh(t)}</td>)}
                  <td style={{ fontWeight: 700 }}>{hh(mx.grand)}</td>
                </tr>
              </tbody>
            </table>
            </div>
            {mx.rows.length === 0 && <div className={s.empty}>No hours logged for these filters.</div>}
            <Pagination {...mxPager} label="members" />
          </div>
          <div className={s.hint}>Click any cell to see the entries behind it.</div>
        </>
      )}
    </div>
  );
}
