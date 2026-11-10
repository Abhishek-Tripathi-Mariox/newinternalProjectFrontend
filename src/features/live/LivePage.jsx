import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { Button } from '@/components/ui';
import KpiRow from '@/features/attendance/shared/KpiRow';
import sh from '@/features/attendance/shared/shared.module.css';
import { useLiveModel } from './useLiveModel';
import AlertsPanel from './components/AlertsPanel';
import TeamTable from './components/TeamTable';
import ActivityFeed from './components/ActivityFeed';
import SalesTodayTable from './components/SalesTodayTable';
import s from './LivePage.module.css';

/** Live now — who is working, what needs attention and today's activity. */
export default function LivePage() {
  const now = useNow(15000);
  const [feedF, setFeedF] = useState('all');
  const m = useLiveModel(now, feedF);
  const navigate = useNavigate();
  const setLiveF = useStore((st) => st.setLiveF);
  const setPj = useStore((st) => st.setPj);
  const setPjF = useStore((st) => st.setPjF);
  const setLf = useStore((st) => st.setLf);

  const runAlert = useCallback((action) => {
    switch (action.type) {
      case 'liveF':
        setLiveF(action.value);
        break;
      case 'project':
        setPj(action.reset
          ? { selP: action.pid, selM: null, exp: null, exp2: null, pDay: null }
          : { selP: action.pid, selM: null });
        navigate('/projects');
        break;
      case 'hotLeads':
        setLf({ flag: 'hot' });
        navigate('/leads');
        break;
      case 'timesheets':
        setPj({ tab: 'ts' });
        setPjF({ date: 'yesterday' });
        navigate('/projects');
        break;
      default:
    }
  }, [navigate, setLiveF, setPj, setPjF, setLf]);

  const openOwnerLeads = useCallback((ownerId) => {
    setLf({ owner: ownerId });
    navigate('/leads');
  }, [navigate, setLf]);

  const sendWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(m.summary)}`, '_blank');
  const sendEmail = () => {
    const a = document.createElement('a');
    a.href = `mailto:?subject=${encodeURIComponent('Mariox daily summary')}&body=${encodeURIComponent(m.summary)}`;
    a.click();
  };

  return (
    <div className={sh.page}>
      <div className={sh.head}>
        <div>
          <h1 className={sh.title}>Live now</h1>
          <div className={sh.sub}>{m.sub}</div>
        </div>
        <div className={sh.toolbar}>
          <Button variant="secondary" className={s.waBtn} onClick={sendWhatsApp}>Send summary to WhatsApp</Button>
          <Button variant="secondary" onClick={sendEmail}>Email summary</Button>
        </div>
      </div>

      <KpiRow items={m.kpis.map((k) => ({ ...k, onClick: () => setLiveF(k.key) }))} />

      <AlertsPanel alerts={m.alerts} onAct={runAlert} />

      <div className={s.split}>
        <TeamTable
          className={s.team}
          rows={m.rows}
          chips={m.chips}
          activeChip={m.activeChip}
          onChip={setLiveF}
        />
        <ActivityFeed className={s.feed} items={m.feed} filter={feedF} onFilter={setFeedF} />
      </div>

      <SalesTodayTable rows={m.sales} onOpen={openOwnerLeads} />
    </div>
  );
}
