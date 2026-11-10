import { MILESTONE_TEMPLATE } from '@/config/constants';
import { DAY, NOON, sod, dLabel, parseDay } from '@/lib/date';
import { randomHue } from '@/lib/random';
import { money } from '@/lib/format';
import { curMs } from '@/domain/projects';
import { attachedMessage } from '@/domain/files';
import { mapById, patchById, memberName } from '../helpers';

const LINK_OK = /^https?:\/\//i;

/** Delivery actions: projects, milestones, client portal, logs, tasks, bugs, change requests. */
export const createDeliverySlice = (set, get) => ({
  updProj: (id, patch) => set((s) => ({ projects: patchById(s.projects, id, patch) })),

  /**
   * Create a project from the new-project form
   * `{name, client, service, status, pm, start, due, budget, team[], value, prio, brief, links[{type,url}], atts}`.
   * Generates the five template milestones and splits the budget across the team.
   */
  saveProj(m) {
    const S = get();
    if (!m.name.trim() || !m.client.trim()) return 'Project name and client are required.';
    if (!(m.service || '').trim()) return 'Pick at least one service.';
    if (!m.start || !m.due || m.due < m.start) return 'Pick a start date and a due date after it.';
    const id = `PR-${101 + S.projects.length}`;
    const budget = Math.max(0, +m.budget || 0);
    const start = parseDay(m.start);
    const due = parseDay(m.due);
    const team = [m.pm].concat(m.team.filter((x) => x !== m.pm));
    const alloc = {};
    team.forEach((x) => { alloc[x] = Math.round(budget / team.length / 5) * 5; });
    const { fractions: FR, names: MN } = MILESTONE_TEMPLATE;
    let cum = 0;
    const ms = FR.map((fr, i) => {
      cum += fr;
      return { id: `${id}-M${i + 1}`, p: id, n: i + 1, name: MN[i], alloc: Math.round((budget * fr) / 5) * 5, due: sod(start + (due - start) * cum + NOON), status: 'Not started' };
    });
    const bad = (m.links || []).find((l) => l.url.trim() && !LINK_OK.test(l.url.trim()));
    if (bad) return `Links must start with https:// (check the ${bad.type} link).`;
    const p = {
      id, name: m.name.trim(), client: m.client.trim(), service: m.service, status: m.status, pm: m.pm, team, start, due, value: +m.value || 0,
      h: randomHue(), prio: m.prio || 'Medium', alloc, brief: (m.brief || '').trim(),
      links: (m.links || []).filter((l) => l.url.trim()).map((l) => ({ type: l.type, url: l.url.trim() })), docs: (m.atts || []).slice(),
    };
    set((s) => ({ projects: s.projects.concat(p), milestones: s.milestones.concat(ms), modal: null, pj: { ...s.pj, selP: id, selM: null } }));
    get().flash(`Project created · ${p.name}`);
    return undefined;
  },

  /** Transform a project's docs: fn(docs) → docs. */
  setProjDocs: (pid, fn) => set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, docs: fn(p.docs || []) })) })),

  /** Append read attachments to a project and flash the count. */
  addProjDocs(pid, atts, skipped = 0) {
    get().setProjDocs(pid, (docs) => docs.concat(atts));
    get().flash(attachedMessage(atts.length, skipped));
  },

  /**
   * Save a project's links from the drawer editor. Valid http(s) links are stored
   * on the project; incomplete ones are kept as a draft in `pj.linkDraft`.
   * Pass the full edited list (saved + draft).
   */
  setProjLinks(pid, links) {
    const ok = links.filter((l) => LINK_OK.test(l.url.trim()));
    const rest = links.filter((l) => !LINK_OK.test(l.url.trim()));
    set((s) => ({
      projects: mapById(s.projects, pid, (p) => ({ ...p, links: ok.map((l) => ({ type: l.type, url: l.url.trim() })) })),
      pj: { ...s.pj, linkDraft: { pid, links: rest } },
    }));
  },

  updMs: (id, patch) => set((s) => ({ milestones: patchById(s.milestones, id, patch) })),

  setAlloc: (pid, mid, v) => set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, alloc: { ...p.alloc, [mid]: v } })) })),

  addMember(pid, mid) {
    if (!mid) return;
    set((s) => ({ projects: s.projects.map((p) => (p.id === pid && !p.team.includes(mid) ? { ...p, team: p.team.concat(mid), alloc: { ...p.alloc, [mid]: 0 } } : p)) }));
  },

  removeMember: (pid, mid) => set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, team: p.team.filter((x) => x !== mid) })) })),

  // Client portal
  portalOn(pid) {
    const tk = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
    set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, portal: { token: tk, ...p.portal, on: true } })) }));
    get().flash('Client portal link is live');
  },
  portalOff(pid) {
    set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, portal: { ...p.portal, on: false } })) }));
    get().flash('Client portal link turned off');
  },
  askApproval(mid) {
    get().updMs(mid, { status: 'In review', appr: { st: 'Pending', asked: Date.now() } });
    get().flash('Sent to the client for approval');
  },
  /** Client approves a milestone or requests changes (note required). */
  clientDecide(mid, ok, note) {
    const m = get().milestones.find((x) => x.id === mid);
    if (!m) return;
    const n = (note || '').trim();
    if (!ok && !n) { get().flash('Add a note so the team knows what to change'); return; }
    get().updMs(mid, { status: ok ? 'Done' : 'In progress', appr: { ...m.appr, st: ok ? 'Approved' : 'Changes requested', at: Date.now(), note: n } });
    set((s) => ({ pj: { ...s.pj, cNote: { ...s.pj.cNote, [mid]: '' } } }));
    get().flash(ok ? 'Milestone approved' : 'Change request sent to the team');
  },

  // Timesheets
  /** Log hours from the log modal form `{member, date, rows:[{p, ms, h, note}]}`. */
  saveLog(m) {
    const S = get();
    const mem = S.members.find((x) => x.id === m.member);
    if (!m.date) return 'Pick a date.';
    const d = parseDay(m.date);
    const rows = m.rows.filter((r) => r.p && +r.h > 0);
    if (!rows.length) return 'Enter hours for at least one project.';
    const tot = rows.reduce((x, r) => x + +r.h, 0);
    const ex = S.logs.filter((l) => l.m === m.member && l.d === d).reduce((x, l) => x + l.h, 0);
    if (tot + ex > 24) return 'That adds up to more than 24 hours for one day.';
    const b = Date.now();
    const nl = rows.map((r, i) => ({ id: `L${b}-${i}`, m: m.member, p: r.p, ms: r.ms || curMs(S.milestones, r.p), d, h: Math.round(+r.h * 4) / 4, note: (r.note || '').trim() }));
    set((s) => ({ logs: s.logs.concat(nl), modal: null }));
    get().flash(`Logged ${tot}h for ${mem ? mem.name : ''} · ${dLabel(d)}`);
    return undefined;
  },
  delLog(id) {
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
    get().flash('Time entry deleted');
  },

  // Tasks
  updTask: (id, patch) => set((s) => ({ tasks: patchById(s.tasks, id, patch) })),
  /** Save a task from the task modal form `{title, p, ms, a, st, prio, due(yyyy-mm-dd), est, desc, cl}`. */
  saveTask(m, editId = m.editId) {
    if (!m.title.trim()) return 'Add a task title.';
    const o = { title: m.title.trim(), p: m.p, ms: m.ms, a: m.a, st: m.st, prio: m.prio, due: m.due ? parseDay(m.due) : null, est: +m.est || 0, desc: m.desc, cl: m.cl };
    const who = memberName(get().members, m.a);
    if (editId) {
      set((s) => ({ tasks: patchById(s.tasks, editId, o), modal: null }));
      get().flash('Task updated');
    } else {
      set((s) => ({ tasks: s.tasks.concat({ id: `T${Date.now()}`, created: Date.now(), ...o }), modal: null }));
      get().flash(`Task created${who ? ` · assigned to ${who}` : ''}`);
    }
    return undefined;
  },
  delTask(id) {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), modal: null }));
    get().flash('Task deleted');
  },

  // Bugs
  /** Patch a bug, optionally appending a history note. */
  updBug: (id, patch, note) => set((s) => ({
    bugs: mapById(s.bugs, id, (b) => ({ ...b, ...patch, ...(note ? { log: (b.log || []).concat({ t: note, d: Date.now() }) } : {}) })),
  })),
  /**
   * Save a bug from the bug modal form
   * `{title, p, ms, dept, env, sev, prio, a, st, rep, repDate, due, build, steps, exp, act, link, atts}`.
   */
  saveBug(m, editId = m.editId) {
    const S = get();
    const MEMn = (id) => (id === 'client' ? 'Client' : memberName(S.members, id) || 'Unassigned');
    if (!m.title.trim()) return 'Add a short bug title.';
    const o = {
      title: m.title.trim(), p: m.p, ms: m.ms, dept: m.dept, env: m.env, sev: m.sev, prio: m.prio, a: m.a, st: m.st, rep: m.rep, repDate: parseDay(m.repDate),
      due: m.due ? parseDay(m.due) : null, build: m.build, steps: m.steps, exp: m.exp, act: m.act, link: m.link, atts: m.atts || [],
    };
    if (editId) {
      const old = S.bugs.find((b) => b.id === editId) || {};
      const notes = [];
      if (old.st !== o.st) notes.push(`Status → ${o.st}`);
      if (old.a !== o.a) notes.push(`Assigned to ${MEMn(o.a)}`);
      if (old.sev !== o.sev) notes.push(`Severity → ${o.sev}`);
      const oa = (old.atts || []).length;
      const na = o.atts.length;
      if (na > oa) notes.push(`Added ${na - oa} attachment${na - oa > 1 ? 's' : ''}`);
      if (na < oa) notes.push(`Removed ${oa - na} attachment${oa - na > 1 ? 's' : ''}`);
      set((s) => ({ bugs: mapById(s.bugs, editId, (b) => ({ ...b, ...o, log: (b.log || []).concat(notes.map((t) => ({ t, d: Date.now() }))) })), modal: null }));
      get().flash(`${editId} updated`);
    } else {
      const max = S.bugs.reduce((x, b) => Math.max(x, +b.id.split('-')[1] || 0), 1000);
      const id = `BUG-${max + 1}`;
      const log = [{ t: `Reported by ${MEMn(o.rep)}`, d: Date.now() }].concat(o.a ? [{ t: `Assigned to ${MEMn(o.a)}`, d: Date.now() }] : []);
      set((s) => ({ bugs: s.bugs.concat({ id, log, ...o }), modal: null }));
      get().flash(`${id} reported${o.a ? ` · assigned to ${MEMn(o.a)}` : ''}`);
    }
    return undefined;
  },
  delBug(id) {
    set((s) => ({ bugs: s.bugs.filter((b) => b.id !== id), modal: null }));
    get().flash(`${id} deleted`);
  },

  // Change requests
  /**
   * Save a CR from the CR modal form
   * `{pid, title, desc, by, reqBy, hours, rate, days, prio, target, atts, team[], tasks[{t,a,h}]}`.
   * Once approved, only documents can change. `send` sends a draft to the client.
   */
  saveCr(m, editId = m.editId, send = false) {
    const S = get();
    const p = S.projects.find((x) => x.id === m.pid);
    if (!p) return undefined;
    const now = Date.now();
    const old = editId && S.crs.find((c) => c.id === editId);
    const locked = old && !['Draft', 'Sent to client'].includes(old.status);
    if (!locked && !m.title.trim()) return 'Give the change request a title.';
    if (!locked && !(+m.hours > 0)) return 'Estimate the hours this change needs.';
    const n = old ? old.n : S.crs.filter((c) => c.p === p.id).reduce((x, c) => Math.max(x, c.n), 0) + 1;
    const tks = (m.tasks || []).filter((t) => t.t.trim()).map((t) => ({ t: t.t.trim(), a: t.a, h: +t.h || 0 }));
    const team = Array.from(new Set((m.team || []).concat(tks.map((t) => t.a).filter(Boolean))));
    const base = locked
      ? { docs: (m.atts || []).slice() }
      : {
        title: m.title.trim(), desc: m.desc.trim(), by: m.by, reqBy: m.reqBy.trim(), hours: +m.hours, rate: +m.rate || 0, amount: Math.round(+m.hours * (+m.rate || 0)),
        days: Math.max(0, Math.round(+m.days || 0)), prio: m.prio, target: m.target, docs: (m.atts || []).slice(), team, tasks: tks,
      };
    const c = {
      ...(old || {
        id: `CR-${p.id.slice(3)}-${n}`, p: p.id, n, status: 'Draft', raised: now, ms: null,
        hist: [{ t: now, text: m.by === 'Client' ? `Raised by ${m.reqBy.trim() || p.client}` : `Draft created by ${m.reqBy.trim() || 'PM'}` }],
      }),
      ...base,
    };
    if (!locked) c.hist = c.hist.concat({ t: now + 1, text: `Estimated ${c.hours}h · ${money(c.amount)}${c.days ? ` · +${c.days} days` : ' · no change to due date'}` });
    if (send && c.status === 'Draft') {
      c.status = 'Sent to client';
      c.sentAt = now;
      c.hist = c.hist.concat({ t: now + 2, text: 'Sent to client for approval' });
    }
    set((s) => ({ crs: old ? s.crs.map((x) => (x.id === c.id ? c : x)) : s.crs.concat(c), modal: null }));
    get().flash(c.id + (send ? ' sent to client for approval' : old ? ' saved' : ' saved as draft'));
    return undefined;
  },

  /**
   * Move a CR through its workflow. acts: send · approve (PM records client
   * approval; sig {name}) · clientApprove (portal; sig {name, agree}) · reject ·
   * clientReject (note required) · start · done · delete.
   * Approval adds hours/value/timeline to the project, a CR milestone (or extends
   * the target milestone) and board tasks. Returns an error string only for
   * 'approve' without a signer name (shown in the CR modal); other validation
   * problems are flashed.
   */
  crAct(id, act, note, sig) {
    const S = get();
    const c = (S.crs || []).find((x) => x.id === id);
    if (!c) return undefined;
    const p = S.projects.find((x) => x.id === c.p);
    const now = Date.now();
    const D = DAY;
    const nt = (note || '').trim();
    if (act === 'delete') {
      set((s) => ({ crs: s.crs.filter((x) => x.id !== id), modal: null }));
      get().flash(`${c.id} deleted`);
      return undefined;
    }
    if (act === 'clientReject' && !nt) { get().flash('Add a note so the team knows why'); return undefined; }
    if (act === 'clientApprove') {
      if (!sig || (sig.name || '').trim().length < 3) { get().flash('Type your full name to sign the approval'); return undefined; }
      if (!sig.agree) { get().flash('Tick the box to confirm you approve the cost and timeline'); return undefined; }
    }
    if (act === 'approve' && (!sig || (sig.name || '').trim().length < 3)) return 'Enter the name of the client person who approved (needed for the approval record).';

    const nc = { ...c };
    const h = (t) => { nc.hist = (nc.hist || []).concat({ t: now + (nc.hist || []).length, text: t }); };
    let ms = S.milestones;
    let { projects } = S;
    let tasks = S.tasks || [];
    let msg = '';
    if (act === 'approve' || act === 'clientApprove') {
      const pmName = memberName(S.members, p.pm) || 'PM';
      nc.sig = { name: sig.name.trim(), at: now, via: act === 'clientApprove' ? 'Typed signature in client portal' : `Recorded by ${pmName} (client approved by email / call)`, note: nt };
    }
    if (act === 'send') {
      nc.status = 'Sent to client'; nc.sentAt = now; h('Sent to client for approval'); msg = `${c.id} sent to client`;
    } else if (act === 'approve' || act === 'clientApprove') {
      nc.status = 'Approved';
      nc.decidedAt = now;
      if (nt) h(`Client comment · ${nt}`);
      if (!c.target || c.target === 'new' || !ms.some((m) => m.id === c.target)) {
        const mn = ms.filter((m) => m.p === p.id).reduce((x, m) => Math.max(x, m.n), 0) + 1;
        nc.ms = `${p.id}-${c.id}`;
        ms = ms.concat({ id: nc.ms, p: p.id, n: mn, name: `CR: ${c.title}`, alloc: c.hours, due: sod(Math.max(p.due, sod(now)) + (c.days || 0) * D + NOON), status: 'Not started', cr: c.id });
      } else {
        nc.ms = c.target;
        ms = ms.map((m) => (m.id === c.target ? { ...m, alloc: (+m.alloc || 0) + c.hours } : m));
      }
      const tk = (c.tasks || []).filter((t) => t.t);
      const addA = {};
      tk.forEach((t) => { if (t.a) addA[t.a] = (addA[t.a] || 0) + (+t.h || 0); });
      const newTeam = Array.from(new Set((c.team || []).concat(Object.keys(addA))));
      projects = projects.map((x) => {
        if (x.id !== p.id) return x;
        const al = { ...x.alloc };
        Object.keys(addA).forEach((k) => { al[k] = (+al[k] || 0) + addA[k]; });
        return { ...x, value: (x.value || 0) + (c.amount || 0), due: x.due + (c.days || 0) * D, team: Array.from(new Set(x.team.concat(newTeam))), alloc: al };
      });
      const msDue = (ms.find((m) => m.id === nc.ms) || {}).due || p.due;
      if (tk.length) {
        tasks = tasks.concat(tk.map((t, i) => ({
          id: `T${now}-${i}`, p: p.id, ms: nc.ms, title: t.t, desc: `From ${c.id} · ${c.title}`, a: t.a || '', st: 'To do', prio: c.prio || 'Medium',
          due: msDue, est: +t.h || 0, cl: [], created: now, cr: c.id, log: [{ d: now, t: `Created from ${c.id}` }],
        })));
      }
      h(`Approved by ${nc.sig.name} · ${nc.sig.via}`);
      h(`+${c.hours}h added to the budget · +${money(c.amount || 0)} contract value${c.days ? ` · due date moved by ${c.days} days` : ''}${tk.length ? ` · ${tk.length} task${tk.length > 1 ? 's' : ''} created on the board` : ''}`);
      msg = `${c.id} approved · ${tk.length ? `${tk.length} tasks created, ` : ''}hours, value and timeline updated`;
    } else if (act === 'reject' || act === 'clientReject') {
      nc.status = 'Rejected'; nc.decidedAt = now; nc.note = nt;
      h((act === 'clientReject' ? 'Rejected by client in portal' : 'Marked rejected') + (nt ? ` · ${nt}` : ''));
      msg = `${c.id} rejected`;
    } else if (act === 'start') {
      nc.status = 'In progress'; h('Work started');
      ms = ms.map((m) => (m.id === nc.ms && m.cr ? { ...m, status: 'In progress' } : m));
      msg = `Work started on ${c.id}`;
    } else if (act === 'done') {
      nc.status = 'Done'; nc.doneAt = now; h('Marked done');
      ms = ms.map((m) => (m.id === nc.ms && m.cr ? { ...m, status: 'Done' } : m));
      msg = `${c.id} marked done`;
    }
    set((s) => ({
      crs: s.crs.map((x) => (x.id === id ? nc : x)), milestones: ms, projects, tasks,
      modal: s.modal && s.modal.kind === 'cr' ? null : s.modal,
      pj: { ...s.pj, cNote: { ...s.pj.cNote, [id]: '' }, cSig: { ...s.pj.cSig, [id]: '' }, cAgree: { ...s.pj.cAgree, [id]: false } },
    }));
    get().flash(msg);
    return undefined;
  },
});
