import { OWNERS } from '@/config/constants';
import { DAY, MINUTE, NOON, sod, today } from '@/lib/date';
import { seeded } from '@/lib/random';

/**
 * Three weeks of login / break / logout events for everyone (seed 777).
 * Port of the prototype's seedAtt().
 * @returns {{t:number, who:string, k:'login'|'logout'|'break'|'resume'}[]}
 */
export function seedAttendance(members) {
  const D = DAY;
  const T = today();
  const { r } = seeded(777);
  const ids = (members || []).map((m) => m.id).concat(OWNERS.map((o) => o.id));
  const out = [];
  for (let k = 21; k >= 1; k--) {
    const d = sod(T - k * D + NOON);
    if (new Date(d).getDay() === 0) continue;
    ids.forEach((who) => {
      if (r() < 0.06) return;
      const m = (x) => d + x * MINUTE;
      const li = m(540 + Math.floor(r() * 100));
      const b1 = m(780 + Math.floor(r() * 40));
      const b1e = b1 + (30 + Math.floor(r() * 30)) * MINUTE;
      const lo = m(1080 + Math.floor(r() * 95));
      out.push({ t: li, who, k: 'login' }, { t: b1, who, k: 'break' }, { t: b1e, who, k: 'resume' });
      if (r() < 0.45) {
        const b2 = m(990 + Math.floor(r() * 30));
        out.push({ t: b2, who, k: 'break' }, { t: b2 + (8 + Math.floor(r() * 14)) * MINUTE, who, k: 'resume' });
      }
      out.push({ t: lo, who, k: 'logout' });
    });
  }
  return out;
}
