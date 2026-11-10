import { clock, fmtDur } from '@/lib/date';

const EVL = { login: ['Logged in', 150], logout: ['Logged out', 265], break: ['Started break', 70], resume: ['Back from break', 250] };

/** Events of today's attendance log with the original sub-labels and a trailing "Now" row. */
export function dayEvents(list, aa, now) {
  const out = [];
  let bs = null;
  let li = null;
  list.forEach((e) => {
    const ev = EVL[e.k] || [e.k, 265];
    let sub = '';
    if (e.k === 'break') {
      bs = e.t;
      if (aa && aa.brk && Math.abs(aa.brk - e.t) < 6e4 && aa.brkType) sub = aa.brkType + (aa.brkNote ? ` · ${aa.brkNote}` : '');
    }
    if (e.k === 'resume' && bs != null) {
      sub = `Break lasted ${fmtDur(e.t - bs)}`;
      bs = null;
    }
    if (e.k === 'login') li = e.t;
    if (e.k === 'logout' && li != null) {
      sub = `Session ${fmtDur(e.t - li)}`;
      li = null;
    }
    out.push({ time: clock(e.t), label: ev[0], dot: `oklch(0.62 0.15 ${ev[1]})`, sub });
  });
  if (bs != null && aa && aa.brk && !aa.out) out.push({ time: 'Now', label: 'On break', dot: 'oklch(0.72 0.14 70)', sub: `${fmtDur(now - bs)} so far` });
  else if (aa && !aa.out && list.length) out.push({ time: 'Now', label: 'Working', dot: 'oklch(0.62 0.16 150)', sub: '' });
  return out;
}

