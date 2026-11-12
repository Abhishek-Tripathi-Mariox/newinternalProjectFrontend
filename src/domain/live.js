import { today } from '@/lib/date';

/**
 * Normalise a live-board object: `{ date, att: {pid: {in,out,brk,brkMin,brkType,brkPlan,brkNote}},
 * timers: {pid: {task,p,ms,title,start}}, idle: {pid: t}, feed: [{t,who,kind,text,lead?}] }`.
 * The board itself comes from the API (GET /live/state or /workday/state).
 */
export const liveBase = (L) => ({ date: today(), att: {}, timers: {}, idle: {}, feed: [], ...L });
