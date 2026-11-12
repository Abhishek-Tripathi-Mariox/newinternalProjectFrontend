/** View helpers for project follow-ups (shares colours / labels with the sales follow-ups). */
import { avatarTone, RED, INK } from '@/lib/color';
import { dLabel, tLabel } from '@/lib/date';
import { initials } from '@/lib/format';
import { serverNow } from '@/lib/clock';
import { prioTone, remindLabel, typeTone, isOverdue } from '@/features/followups/model';

export const EMPTY_PF = { q: '', project: '', owner: '', type: '', priority: '' };

const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Google Calendar "create event" link for a project follow-up. */
export function pfCalendarLink(f, project) {
  const details = [f.notes, f.meet ? `Google Meet: ${f.meet}` : '', project ? `Project: ${project.name} (${project.client})` : ''].filter(Boolean).join('\n');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(f.title + (project ? ` · ${project.name}` : ''))}`
    + `&dates=${stamp(f.due)}/${stamp(f.due + (f.dur || 30) * 6e4)}`
    + `&details=${encodeURIComponent(details)}`
    + (f.meet ? `&location=${encodeURIComponent(f.meet)}` : '')
    + (f.attendees ? `&add=${encodeURIComponent(f.attendees)}` : '');
}

/** Everything a row shows. `members` = delivery members. */
export function describePfu(f, project, members, now = serverNow()) {
  const od = isOverdue(f, now);
  const m = (members || []).find((x) => x.id === f.owner) || { name: 'Unassigned', h: 265 };
  return {
    projectName: project ? project.name : '—',
    client: project ? project.client : '',
    owner: { name: m.name, h: m.h ?? 265, ini: initials(m.name), ...avatarTone(m.h ?? 265) },
    type: typeTone(f.type),
    prio: prioTone(f.prio),
    overdue: od,
    dueDate: (od ? 'Overdue · ' : '') + dLabel(f.due),
    dueTime: tLabel(f.due),
    durLabel: f.dur ? ` · ${f.dur} min` : '',
    dueColor: od ? RED : INK,
    remindLabel: remindLabel(f.remind),
    calUrl: pfCalendarLink(f, project),
  };
}

/** Filter bar for the page. */
export function filterPfus(pfus, f, projectsById) {
  const q = (f.q || '').trim().toLowerCase();
  return pfus.filter((x) =>
    (!f.project || x.p === f.project) &&
    (!f.owner || x.owner === f.owner) &&
    (!f.type || x.type === f.type) &&
    (!f.priority || x.prio === f.priority) &&
    (!q || `${x.title} ${projectsById[x.p] ? `${projectsById[x.p].name} ${projectsById[x.p].client}` : ''}`.toLowerCase().includes(q)));
}

export const hasPfFilters = (f) => !!(f.q || f.project || f.owner || f.type || f.priority);
