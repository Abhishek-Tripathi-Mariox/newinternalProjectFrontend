import { FU_DEFAULTS } from '@/config/constants';

/** A follow-up with its type defaults (duration, reminder) applied. */
export function makeFollowUp(o) {
  const [dur, remind] = FU_DEFAULTS[o.type] || [0, 0];
  return { dur, remind, prio: 'Medium', meet: '', attendees: '', notes: '', done: false, notified: false, ...o };
}
