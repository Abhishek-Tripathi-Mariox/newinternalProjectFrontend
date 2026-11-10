import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Avatar, Card, DataTable, Input, KpiCard, KpiGrid, ProgressBar, SegmentedControl, Select } from '@/components/ui';
import FollowUpRow from '@/features/followups/components/FollowUpRow';
import { useLeadInsights } from '@/features/leads/useLeadInsights';
import { ownerOf, statusTone, val } from '@/features/leads/leadUtils';
import { OWNERS } from '@/config/constants';
import { GREEN_TEXT, MUTED, RED } from '@/lib/color';
import { DAY, greeting, ymd } from '@/lib/date';
import { money } from '@/lib/format';
import { PERIODS, periodLabel, useDashboardModel } from './useDashboardModel';
import s from './DashboardPage.module.css';

const ownerOpts = [{ value: '', label: 'All owners' }, ...OWNERS.map((o) => ({ value: o.id, label: o.name }))];

/** One clickable "label · bar · [value] · count" row (funnel + sources). */
function BarRow({ label, dot, pct, color, valueLabel, count, onClick }) {
  return (
    <button type="button" className={`${s.barRow} ${valueLabel != null ? s.barRowValue : ''}`} onClick={onClick}>
      <span className={s.barLabel}>{dot && <span className={s.sq} style={{ background: dot }} />}{label}</span>
      <ProgressBar value={pct} color={color} height={8} />
      {valueLabel != null && <span className={s.barValue}>{valueLabel}</span>}
      <span className={s.barCount}>{count}</span>
    </button>
  );
}

/** Sales overview: KPIs, funnel, monthly trend, today's agenda, sources and team table. */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { leads, fus, now } = useLeadInsights();
  const setLf = useStore((st) => st.setLf);
  const setFf = useStore((st) => st.setFf);
  const setFuTab = useStore((st) => st.setFuTab);
  const [period, setPeriod] = useState('30');
  const [range, setRange] = useState(() => ({ from: ymd(now - 29 * DAY), to: ymd(now) }));
  const [ow, setOw] = useState('');
  const m = useDashboardModel({ leads, fus, now, period, from: range.from, to: range.to, owner: ow });
  const todayStr = ymd(now);

  const leadsWith = (patch) => () => {
    setLf({ owner: ow, date: 'all', status: '', source: '', ...patch });
    navigate('/leads');
  };
  const fuWith = (tab, patch) => () => {
    setFuTab(tab);
    setFf({ owner: ow, ...(patch || {}) });
    navigate('/follow-ups');
  };
  const periodRange = { date: 'custom', from: ymd(m.pr[0]), to: ymd(m.pr[1] - DAY) };

  const kpis = [
    {
      label: 'New leads', value: m.inP.length,
      sub: m.delta === null ? 'No prior data' : `${m.delta >= 0 ? '+' : ''}${m.delta}% vs previous period`,
      subColor: m.delta === null ? MUTED : m.delta >= 0 ? GREEN_TEXT : RED, onClick: leadsWith(periodRange),
    },
    { label: 'Open pipeline', value: money(m.openValue), sub: `${m.open.length} open deals`, subColor: MUTED, onClick: leadsWith({}) },
    { label: 'Won revenue', value: money(m.wonValue), sub: `${m.won.length} deals won in period`, subColor: GREEN_TEXT, onClick: leadsWith({ status: 'Won' }) },
    { label: 'Win rate', value: `${m.winRate}%`, sub: `${m.won.length} won · ${m.lost.length} lost`, subColor: MUTED, onClick: leadsWith({ status: 'Lost' }) },
    {
      label: 'Follow-ups today', value: m.fToday.length,
      sub: m.fOver.length ? `${m.fOver.length} overdue` : 'Nothing overdue', subColor: m.fOver.length ? RED : GREEN_TEXT, onClick: fuWith('today'),
    },
  ];

  const teamCols = [
    {
      key: 'owner', label: 'Owner',
      render: (t) => { const o = ownerOf(t.id); return <span className={s.owner}><Avatar name={o.name} h={o.h} ini={o.ini} size={26} />{o.name}</span>; },
    },
    { key: 'open', label: 'Open leads', align: 'right', render: (t) => t.open },
    { key: 'pipe', label: 'Open pipeline', align: 'right', render: (t) => money(t.pipe) },
    { key: 'won', label: 'Won (period)', align: 'right', render: (t) => t.won },
    { key: 'wonValue', label: 'Won revenue', align: 'right', render: (t) => <b>{money(t.wonValue)}</b> },
    { key: 'pending', label: 'Pending follow-ups', align: 'right', render: (t) => t.pending },
    { key: 'overdue', label: 'Overdue', align: 'right', render: (t) => <b style={{ color: t.overdue ? RED : MUTED }}>{t.overdue}</b> },
  ];

  const goTeam = (t) => { setLf({ owner: t.id }); navigate('/leads'); };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Good {greeting(now)}</h1>
          <div className={s.sub}>Sales overview · {periodLabel(period, m.pr)}{ow ? ` · ${ownerOf(ow).name}` : ''}</div>
        </div>
        <div className={s.controls}>
          <SegmentedControl options={PERIODS} value={period} onChange={(v) => setPeriod(val(v))} />
          {period === 'custom' && (
            <div className={s.range}>
              <Input compact type="date" aria-label="From date" value={range.from} max={range.to || todayStr}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <span className={s.rangeSep}>to</span>
              <Input compact type="date" aria-label="To date" value={range.to} min={range.from} max={todayStr}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          )}
          <Select compact value={ow} onChange={(e) => setOw(val(e))} options={ownerOpts} aria-label="Owner" />
        </div>
      </div>

      <KpiGrid min={170}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </KpiGrid>

      <div className={s.grid}>
        <Card title="Leads by status" action={<button type="button" className={s.link} onClick={() => navigate('/leads')}>Open leads →</button>}>
          {m.funnel.map((f) => {
            const t = statusTone(f.status);
            return (
              <BarRow key={f.status} label={f.status} dot={t.dot} color={t.dot} pct={f.pct}
                valueLabel={money(f.value)} count={f.count} onClick={leadsWith({ status: f.status })} />
            );
          })}
        </Card>

        <Card className={s.trendCard}>
          <div className={s.trendHead}>
            <h2 className={s.h2}>Leads per month</h2>
            <div className={s.legend}>
              <span><span className={s.sq9} style={{ background: 'oklch(0.9 0.04 265)' }} />Created</span>
              <span><span className={s.sq9} style={{ background: 'var(--primary)' }} />Won</span>
            </div>
          </div>
          <div className={s.bars}>
            {m.months.map((mo) => (
              <div key={mo.a} className={s.barCol} title={`${mo.total} created · ${mo.won} won`}>
                <div className={s.barTotal}>{mo.total}</div>
                <div className={s.bar} style={{ height: mo.h }}>
                  <div className={s.barWon} style={{ height: `${mo.wonShare * 100}%` }} />
                </div>
                <div className={s.barMonth}>{new Date(mo.a).toLocaleDateString('en-US', { month: 'short' })}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Today’s agenda" action={<button type="button" className={s.link} onClick={() => navigate('/follow-ups')}>All follow-ups →</button>}>
          {m.fOver.length > 0 && (
            <button type="button" className={s.overdue} onClick={fuWith('overdue')}>
              {m.fOver.length} overdue follow-up{m.fOver.length > 1 ? 's' : ''} need attention →
            </button>
          )}
          {m.agenda.map((f) => <FollowUpRow key={f.id} fu={f} variant="agenda" now={now} />)}
          {m.agenda.length === 0 && <div className={s.empty}>Nothing else scheduled for today.</div>}
        </Card>

        <Card title="Lead sources">
          {m.sources.map((x) => (
            <BarRow key={x.source} label={x.source} pct={x.pct} color="oklch(0.62 0.12 265)" count={x.n}
              onClick={leadsWith({ source: x.source, ...periodRange })} />
          ))}
        </Card>

        <Card title="Sales team" className={s.teamCard}>
          <DataTable itemLabel="owners" columns={teamCols} rows={m.team} rowKey={(t) => t.id} onRowClick={goTeam} className={s.teamTable} />
        </Card>
      </div>
    </div>
  );
}
