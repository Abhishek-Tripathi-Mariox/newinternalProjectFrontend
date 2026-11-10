import { MINUTE } from '@/lib/date';

/** Google Calendar compact UTC stamp: 20261110T093000Z. */
const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Build a Google Calendar "create event" URL for a follow-up (port of the
 * original `cal(f, l)`).
 * @param {{title:string, due:number, dur?:number, notes?:string, meet?:string, attendees?:string}} fu
 * @param {{company:string, contact:string}|null|undefined} lead
 */
export function calendarLink(fu, lead) {
  const details = [
    fu.notes,
    fu.meet ? `Google Meet: ${fu.meet}` : '',
    lead ? `Lead: ${lead.company} (${lead.contact})` : '',
  ].filter(Boolean).join('\n');
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(fu.title + (lead ? ` · ${lead.company}` : ''))}` +
    `&dates=${stamp(fu.due)}/${stamp(fu.due + (fu.dur || 30) * MINUTE)}` +
    `&details=${encodeURIComponent(details)}` +
    (fu.meet ? `&location=${encodeURIComponent(fu.meet)}` : '') +
    (fu.attendees ? `&add=${encodeURIComponent(fu.attendees)}` : '')
  );
}
