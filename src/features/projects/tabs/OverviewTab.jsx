import { useMemo } from 'react';
import { Avatar, BarList, Button, KpiCard, ProgressBar } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { avatarOf } from '@/domain/projects';
import { BLUE, projectColor, tone } from '@/lib/color';
import { addDays, dLabel, isSunday, workdaysSoFar } from '@/lib/date';
import { hh, money, pctW } from '@/lib/format';
import { PROJECT_STATUS, TEAMS } from '@/config/constants';
import { HealthPill } from '../components/bits';
import { useProjectNav } from '../hooks/useProjectNav';
import { NEUTRAL_DOT, STATUS_KEYS } from '../lib/view';
import s from './tabs.module.css';

const contractValue = (list) => `${money(list.reduce((x, p) => x + (p.value || 0), 0))} contract value`;

function HourCard({ label, value, sub, ratio }) {
  return (
    <div className={s.hourCard}>
      <span className={s.hourLabel}>{label}</span>
      <span className={s.hourValue}>{value}</span>
      <ProgressBar width={pctW(ratio)} color={BLUE} />
      <span className={s.hourSub}>{sub}</span>
    </div>
  );
}

/** Projects → Overview: status cards, hour cards, hours by project / team, missing timesheets, needs attention. */
export default function OverviewTab() {
  const model = useProjectsModel();
  const { projects, logs, members } = useScoped();
  const flash = useStore((st) => st.flash);
  const { openProject, openMember, goTab } = useProjectNav();

  const v = useMemo(() => {
    const { T, LF, pBase, pF, pSet, memF, projScoped, g, hk, inR, wk, mo, MEM, info } = model;
    const sumL = (fn) => LF.reduce((x, l) => x + (fn(l) ? l.h : 0), 0);
    const yd = addDays(T, -1);
    const tH = sumL((l) => l.d === T);
    const yH = sumL((l) => l.d === yd);
    const wH = sumL((l) => l.d >= wk[0] && l.d < wk[1]);
    const mH = sumL((l) => l.d >= mo[0] && l.d < mo[1]);
    const actM = memF.filter((m) => projects.some((p) => p.status === 'Running' && p.team.includes(m.id) && (!projScoped || pSet.has(p.id))));
    const shiftSum = actM.reduce((x, m) => x + (m.shift || 8), 0);
    const yOff = isSunday(yd);
    const expW = shiftSum * workdaysSoFar(wk[0], wk[1]);
    const expM = shiftSum * workdaysSoFar(mo[0], mo[1]);
    const missingM = actM.filter((m) => g(`d:${m.id}:${T}`).all === 0);

    const lastLog = (id) => logs.reduce((best, l) => (l.m === id && l.d > best ? l.d : best), 0);

    const pr = pF.map((p) => ({ p, h: g(hk(p)).range })).filter((x) => x.h > 0).sort((a, b) => b.h - a.h).slice(0, 8);
    const prMax = pr.length ? pr[0].h : 1;
    const tb = TEAMS.map((t) => ({ t, h: LF.reduce((x, l) => x + ((MEM[l.m] || {}).team === t && inR(l.d) ? l.h : 0), 0) }))
      .filter((x) => x.h > 0)
      .sort((a, b) => b.h - a.h);
    const tbMax = tb.length ? tb[0].h : 1;

    return {
      statusCards: [
        { key: '', label: 'All projects', count: pBase.length, dot: NEUTRAL_DOT, sub: contractValue(pBase) },
        ...STATUS_KEYS.map((k) => {
          const a = pBase.filter((p) => p.status === k);
          return { key: k, label: k, count: a.length, dot: tone(PROJECT_STATUS[k]).dot, sub: a.length ? contractValue(a) : 'None' };
        }),
      ],
      hourCards: [
        {
          label: 'Hours logged today',
          value: hh(tH),
          sub: shiftSum ? `of ${hh(shiftSum)} expected · ${missingM.length} not submitted` : 'No active members',
          ratio: shiftSum ? tH / shiftSum : 0,
        },
        { label: 'Yesterday', value: hh(yH), sub: yOff ? 'Sunday · weekly off' : `of ${hh(shiftSum)} expected`, ratio: shiftSum && !yOff ? yH / shiftSum : 0 },
        { label: 'This week', value: hh(wH), sub: `of ${hh(expW)} expected so far`, ratio: expW ? wH / expW : 0 },
        { label: 'This month', value: hh(mH), sub: `of ${hh(expM)} expected so far`, ratio: expM ? mH / expM : 0 },
      ],
      projBars: pr.map((x) => ({ key: x.p.id, label: x.p.name, value: hh(x.h), w: pctW(x.h / prMax), color: projectColor(x.p), onClick: () => openProject(x.p.id) })),
      teamBars: tb.map((x) => ({ key: x.t, label: x.t, value: hh(x.h), w: pctW(x.h / tbMax), color: 'oklch(0.6 0.12 265)', onClick: () => goTab('team', { team: x.t }) })),
      missing: missingM.map((m) => {
        const ll = lastLog(m.id);
        return { m, a: avatarOf(members, m.id), last: ll ? `Last logged ${dLabel(ll).toLowerCase()}` : 'Never logged' };
      }),
      missingCount: missingM.length ? `${missingM.length} of ${actM.length}` : '',
      attention: pF
        .map(info)
        .filter((I) => I.bad && I.p.status !== 'Completed')
        .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
        .map((I) => ({
          I,
          sub: I.why.length
            ? I.why.join(' · ')
            : I.health === 'Over budget'
              ? `${hh(I.used)} used of ${hh(I.budget)} budget`
              : I.health === 'Overdue'
                ? `Was due ${I.dueLabel} · ${I.curM ? I.curM.name : ''}`
                : I.health === 'At risk'
                  ? `${Math.round(I.pct * 100)}% of budget used · due ${I.dueLabel}`
                  : `On hold · ${I.curM ? I.curM.name : ''}`,
        })),
    };
  }, [model, projects, logs, members, openProject, goTab]);

  return (
    <div className={s.stack}>
      <div className={s.grid150}>
        {v.statusCards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.count} sub={c.sub} dot={c.dot} onClick={() => goTab('projects', { status: c.key })} />
        ))}
      </div>

      <div className={s.grid200}>
        {v.hourCards.map((c) => (
          <HourCard key={c.label} {...c} />
        ))}
      </div>

      <div className={s.split}>
        <section className={s.card}>
          <div className={s.cardHead}>
            <h2>Hours by project</h2>
            <span className={s.meta}>{model.periodLabel}</span>
          </div>
          <BarList items={v.projBars} />
          {v.projBars.length === 0 && <div className={s.emptyLg}>No hours logged in this period.</div>}
          <div className={`${s.cardHead} ${s.cardHeadGap}`}>
            <h2>Hours by team</h2>
            <span className={s.meta}>{model.periodLabel}</span>
          </div>
          <BarList items={v.teamBars} />
        </section>

        <div className={s.col}>
          <section className={s.card}>
            <div className={s.cardHead}>
              <h2>Timesheets not submitted today</h2>
              <span className={s.meta}>{v.missingCount}</span>
            </div>
            {v.missing.map(({ m, a, last }) => (
              <div key={m.id} className={s.personRow}>
                <Avatar name={m.name} h={m.h} ini={a.ini} size={30} />
                <button type="button" className={s.personBtn} onClick={() => openMember(m.id)}>
                  <div className={s.personName}>{m.name}</div>
                  <div className={s.cellSub}>
                    {a.role} · {last}
                  </div>
                </button>
                <Button size="sm" variant="secondary" onClick={() => flash(`Reminder sent to ${m.name}`)}>
                  Remind
                </Button>
              </div>
            ))}
            {v.missing.length === 0 && <div className={s.empty}>Everyone on an active project has logged hours today.</div>}
          </section>

          <section className={s.card}>
            <div className={s.cardHead}>
              <h2>Needs attention</h2>
            </div>
            {v.attention.map(({ I, sub }) => (
              <button type="button" key={I.p.id} className={s.attnRow} onClick={() => openProject(I.p.id)}>
                <div className={s.minw}>
                  <div className={s.personName}>{I.p.name}</div>
                  <div className={s.cellSub}>{sub}</div>
                </div>
                <HealthPill bg={I.hBg} fg={I.hFg}>
                  {I.hLabel}
                </HealthPill>
              </button>
            ))}
            {v.attention.length === 0 && <div className={s.empty}>All projects are on track.</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
