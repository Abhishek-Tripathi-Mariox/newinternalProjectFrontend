# Build contract — Mariox Internal Portal (React 19 + Vite + Zustand + React Router 7)

This app is a **1:1 port** of the prototype at
`/home/abhishek/companyProject/Mariox CEO Portal Design/CEO Portal.dc.html`.
Reference copies (easier to read):
- Logic: `/tmp/claude-1000/-home-abhishek-companyProject/da9eb3da-a7f4-46b0-b751-2975fb1319f0/scratchpad/script.js` (2165 lines, the original class)
- Markup without styles: `.../scratchpad/template.txt` (2761 lines). For exact visual styles read the raw file: **raw line ≈ template line + 22**.

Nothing may be dropped: every label, KPI, chip, filter, column, empty state, button, flash message and validation error in the original must exist in the port. Keep wording identical.

## Ground rules
- JavaScript + JSX only (no TS). Function components + hooks. Import alias `@/` → `src/`.
- Styling: CSS Modules co-located (`Foo.module.css`) using tokens from `src/styles/tokens.css`. Dynamic hue colours via `style={{...}}` using `@/lib/color` helpers. No CSS frameworks, no new npm deps.
- Reuse the UI kit (`@/components/ui`) — don't re-implement buttons/modals/chips/pills/tables/boards.
- Feature-local derived data: compute in `useMemo` inside the feature (or a `use<Feature>Model.js` hook in the feature folder). Cross-feature business logic lives in `src/domain`.
- Never mutate store state; actions in the store handle all writes.
- Read data for rendering through `useScoped()` (role-scoped view). Read UI state & call actions through `useStore`.

## Already written (do not rewrite; extend only if a helper is missing)
- `src/lib/date.js`: MINUTE HOUR DAY NOON sod today addDays ymd hm parseDay dLabel tLabel clock fd fday longDay dateTime fmtDur isSunday range workdaysSoFar workdaysBetween ago greeting LATE_MIN lateAt
- `src/lib/format.js`: money(v) inr hh h1 pctW fileSize initials plural firstName
- `src/lib/color.js`: INK MUTED RED AMBER BLUE GREEN GREEN_TEXT PURPLE PRIMARY tone(h) toneStrong(h) avatarTone(h) projectColor(p) barColor(x)
- `src/lib/download.js`: downloadBlob downloadCsv(rows, filename, {bom}) printHtml(html)->bool escapeHtml copyText
- `src/lib/random.js`: seeded(seed)->{r,pick} randomHue uid genMeet
- `src/config/constants.js`: OWNERS LEAD_STATUSES LEAD_STATUS_NAMES leadStatusHue SOURCES SERVICES FU_TYPES PRIORITIES PRIORITY_NAMES PROJECT_STATUS TASK_STATUS BUG_STATUS BUG_SEVERITY BUG_SEVERITY_DAYS BUG_ENVS MILESTONE_STATUS CR_STATUS QUOTE_STATUS TEAMS TEAM_COST MODULES REMINDERS FU_DEFAULTS BREAK_TYPES MILESTONE_TEMPLATE LINK_TYPES LINK_PLACEHOLDER LINK_HUE DOC_KINDS ACTIVITY_KINDS LEAD_DATE_PRESETS FU_DATE_PRESETS PROJECT_PERIOD_PRESETS ATTENDANCE_RANGES DEFAULT_PASSWORD
- `src/data/seed/sales.js`: makeFollowUp(o) seedSales()->{leads,fus}

## Data shapes (same field names as the original)
lead `{id,company,contact,email,phone,service('A, B'),source,owner,firstOwner?,status,value,created,notes,docs?[],acts?[{t,kind,text}],quotes?[]}`
follow-up `{id,type,title,leadId,owner,due,dur,remind,prio,meet,attendees,notes,done,notified}`
member `{id,name,role,team,h,shift,cost?}` · project `{id,name,client,service,status,pm,team[],start,due,value,h,prio,alloc{memberId:h},brief?,links?[{type,url}],docs?[],portal?{on,token}}`
milestone `{id,p,n,name,alloc,due,status,cr?,appr?{st,asked,at,note}}` · log `{id,m,p,ms,d,h,note}`
task `{id,p,ms,title,desc,a,st,prio,due,est,cl[{t,done}],created,cr?,log?}` · bug `{id,p,ms,title,dept,env,sev,prio,st,a,rep,repDate,due,build,steps,exp,act,link,atts?[],log[{t,d}]}`
cr `{id,p,n,title,desc,by,reqBy,hours,rate,amount,days,prio,target,status,raised,sentAt?,decidedAt?,doneAt?,ms,docs[],team[],tasks[{t,a,h}],sig?{name,title?,at,via,note},note?,hist[{t,text}]}`
user `{id,name,email,phone,title,role,dept,reports,join,status('Active'|'Invited'|'Deactivated'),last,h,ownerId?,memberId?,clientOf?[],shift?,invited?,pw?}`
role `{id,name,desc,h,locked?,perms{[module]:{v,c,e,d,scope:'all'|'team'|'own'}}}` · audit `{d,actor,text,kind}`
live `{date,att{[pid]:{in,out,brk,brkMin,brkType?,brkPlan?,brkNote?}},timers{[pid]:{task,p,ms,title,start}},idle{[pid]:t},feed[{t,who,kind,text,lead?}]}`
attLog `[{t,who,k:'login'|'logout'|'break'|'resume'}]` · report (end of shift) — see original `submitEndShift`.
attachment `{name,size,type,at,url,kind}` (url '' when > 1.5 MB).
"pid" = person id: member id for delivery staff, owner id for sales (`pidOf(user)`).

## Store — `src/store/index.js` → `export const useStore` (Zustand) [Agent A]
Persisted to localStorage with the original keys (`mariox-ceo-portal-v1` {leads,fus}, `mariox-ceo-projects-v1` {members,projects,milestones,logs,tasks,bugs,crs}, `mariox-ceo-users-v1` {users,roles,audit}, `mariox-ceo-live-v1` live (dropped if not today), `mariox-ceo-auth-v1`, `mariox-ceo-att-v1`, `mariox-ceo-rep-v1` reports). Initial state = stored or seeded, including the original's healing/migration steps (initState lines 21-56, componentDidMount 103-119).

State keys: leads fus members projects milestones logs tasks bugs crs users roles audit auth attLog live reports, plus UI:
`toast` (string) · `modal` (`{kind, props}`|null) · `alerts` (fu ids) · `viewAs` (user id|null) · `selLead` (lead id|null) · `selIds` (lead ids) ·
`lf` {q,date:'all',from,to,owner,source,service,status,flag} · `sort` {k:'created',d:-1} · `leadView` ('kanban'|'table', default from settings) · `staleDays` (7) ·
`ff` {q,type,owner,priority,meet,date:'all',from,to} · `fuTab` ('today') ·
`pj` {tab:'overview',pView:'board',tsView:'entries',msSt:'',msView:'stage',tView:'board',tF:'',bView:'board',bQ:'open',bf:{},bAllTime:true,capW:1,capF:'',crSt:'',selP:null,selM:null,mDay:null,pDay:null,exp:null,exp2:null,portal:null,cNote:{},cSig:{},cAgree:{},linkDraft:null,dragP..., f:{q:'',date:'week',from:'',to:'',status:'',team:'',member:'',project:''}}
`liveF` ('all') · `attF` · `repF` · `us` {tab:'users',q,role,dept,status,selRole:'r-pm'}

Actions (all are store functions; ones returning `string` return an **error message** to show, or `undefined` on success):
- UI: `flash(msg)` (toast 2.4s) · `openModal(kind, props={})` · `closeModal()` · `dismissAlert(fuId)` · `checkReminders()` · `setLf(patch)` `setFf(patch)` `setFuTab(t)` `setSort(sort)` `setLeadView(v)` `setStaleDays(n)` · `setPj(patch)` `setPjF(patch)` (patch pj.f) · `selectLead(id|null)` · `toggleSel(id)` `setSelIds(ids)` · `setLiveF(v)` `setAttF(patch)` `setRepF(patch)` `setUs(patch)` · `setViewAs(id|null, quiet?)` (also fixes current page access — expose `firstAllowedPath()` helper in domain/permissions)
- Sales: `setLead(id,key,value)` (status/owner write activity like original) · `logAct(id,kind,text)` · `bulk(key,value)` (uses selIds) · `saveLead(form, editId?)`:string · `mergeLead(keepId,dropId)` · `saveQuote(leadId, form, qid|null, send)`:string · `setQuote(leadId,qid,status)` · `toggleFu(id)` `delFu(id)` · `saveFu(form, editId?)`:string · `addLeadDocs(leadId, atts)` `setLeadDocs(leadId, fn)`
  - form objects use the same field names as the original modal state (see openFu/openLeadModal/openQuote).
- Delivery: `updProj(id,patch)` · `saveProj(form)`:string · `setProjDocs(pid, fn)` `setProjLinks(pid, links)` · `updMs(id,patch)` · `setAlloc(pid,mid,v)` `addMember(pid,mid)` `removeMember(pid,mid)` · `portalOn(pid)` `portalOff(pid)` `askApproval(mid)` `clientDecide(mid, ok, note)` · `saveLog(form)`:string `delLog(id)` · `updTask(id,patch)` `saveTask(form, editId?)`:string `delTask(id)` · `updBug(id,patch,note?)` `saveBug(form, editId?)`:string `delBug(id)` · `saveCr(form, editId?, send)`:string · `crAct(id, act, note?, sig?)`:string (acts: send approve clientApprove reject clientReject start done delete) · `startTimer(pid, taskId)` `stopTimer(pid)`
- People: `saveUser(form, editId?)`:string · `setUserStatus(id,status)` `delUser(id)` · `updRole(id, fn)` `newRole()` `duplicateRole(id)` `deleteRole(id)` · `audit(text, kind)` · `resendInvite(id)` `resetPassword(id)` `forceLogout(id)`
- Workday: `login(email,pw)`:string · `logout()` · `checkIn(pid)` `checkOut(pid)` `toggleBreak(pid)` · `myBreak()` · `startBreak(pid, type, note)` · `openEndShift(pid)` (opens modal 'eos' with props = the computed initial form from original openEndShift) · `submitEndShift(form, workedHours)`:string

## Settings — `src/store/settings.js` → `useSettings` [Agent A]
Zustand + persist (`mariox-portal-settings-v1`): `{currency:'INR'|'USD', defaultLeadsView:'Kanban'|'Table', reminderAlerts:true, set(patch)}`. `format.money` reads `useSettings.getState().currency`.

## Domain — `src/domain/*` [Agent A] (pure functions)
- `permissions.js`: `pidOf(user)` · `viewUser(state)` (user being viewed-as or null) · `sessionUser(state)` (logged-in or effective) · `can(state, mod, act='v')` · `isPMof(state, project)` · `scopeState(state)` → scoped copy (filters leads/fus/projects/milestones/crs/tasks/bugs/logs like original) · `firstAllowedPath(state)` · `MODULE_OF_TAB` {overview:'projects',projects:'projects',milestones:'projects',tasks:'tasks',bugs:'bugs',team:'team',cap:'team',cr:'projects',ts:'ts'}
- `leads.js`: `leadInsights({leads,fus,staleDays,now})` → `{touch, scoreOf, nextOf, dupOf, daysSince(id), isOpen(l), isHot(l), isStale(l), scorePill(n)->{bg,fg}}` · `findDuplicateLeads(form, leads, excludeId)` · `normPhone normCompany normEmail`
- `quotes.js`: `qTotals(q)` · `printQuote(lead, quote)`:bool
- `projects.js`: `buildProjectsModel(scopedState, pj, now)` → `{T, MEM, PRJ, MSS, msOf, msPeople, g(key)->{all,today,yest,week,month,range}, sumA, hk(p), inR(d), rg, wk, mo, q, pBase, pF, pSet, LF, projScoped, memF, mAgg(m), info(p), TKP, BGP, periodLabel}` where `info(p)` returns the original's `info()` object (`{p,ms,budget,used,curM,ci,pct,st,hl,health,score,why,hLabel,hBg,hFg,bad,dueLabel,dueSub,dueColor}`) · `curMs(milestones, pid)` · `crRate(milestones, p)` · `costOf(members, id)` · `crMoney(c, {logs, milestones, members})` · `printCr(c, {projects, members})`:bool · `avatarOf(members, id)` → `{id,name,role,team,ini,bg,fg}`
- `attendance.js`: `sumDay(list, day, now)` (original sumDay) · `groupAttendance(attLog, from, to)` → `{'who|day': events[]}` · `people(state)` → original `ppl` list (members + sales owners) `{id,name,role,h,sales,shift}`
- `files.js`: `docKind(name)` · `readFiles(fileList)` → `Promise<{atts, skipped}>` (10 MB max; > 1.5 MB stored as name only)

## Hooks — `src/hooks/*` [Agent A]
- `useScoped()` → memoised `scopeState(state)` result (full state object, scoped). 
- `useCan()` → `(mod, act) => boolean` · `useIsPM()` → `(project) => boolean`
- `useNow(intervalMs = 15000)` → current ms, re-rendering every interval.
- `useCurrentUser()` → `{ auth user, effective user (viewAs aware), pid, isSuper }`
- `useProjectsModel()` → `buildProjectsModel(useScoped(), pj, now)` memoised.

## UI kit — `src/components/ui/index.js` [Agent B] (named exports; all accept `className`, `style`)
`Button {variant:'primary'|'secondary'|'ghost'|'danger'|'dangerOutline'|'link'|'dark', size:'sm'|'md'|'lg', block, icon}` · `IconButton {label, onClick, children='✕'}` · `Card {title, sub, action, padding, children}` · `Pill {bg, fg, dot, children, size}` · `HuePill {hue, dot?, children}` · `Avatar {name, h, size=28, ini?}` · `AvatarStack {people:[{name,h|bg,fg,ini}], max=4}` · `KpiCard {label, value, sub, subColor, dot, color, onClick}` · `KpiGrid {children, min=180}` · `ProgressBar {value 0..1 | width '%', color, height=6, track}` · `StackedBar {segments:[{w,bg,tip}]}` · `BarList {items:[{label,value,w,color,onClick}]}` · `FilterChips {items:[{key,label,count,dot}], value, onChange, tone:'dark'}` · `SegmentedControl {options:[[value,label]], value, onChange}` · `Tabs {tabs:[{key,label,count?,tone?}], value, onChange}` · `Modal {open, onClose, title, sub, width=580, footer, children}` · `Drawer {open, onClose, width=620, title, sub, header, children}` · `Field {label, hint, error, required, children}` · `Input` · `Select {options:[{value,label}]|string[], placeholder}` · `Textarea` · `Toggle {checked, onChange}` · `Checkbox {checked, onChange, label}` · `SearchInput {value,onChange,placeholder}` · `EmptyState {title, sub, action}` · `KanbanBoard {columns:[{key,name,dot,count,meta,items,onAdd?}], getId, renderCard(item), onMove(id,toKey), minColWidth=250}` · `DataTable {columns:[{key,label,align,width,sortable,render(row)}], rows, rowKey, onRowClick, sort:{k,d}, onSort(k), empty, rowStyle(row)}` · `DateRangeFilter {presets:[[v,l]], value, from, to, onChange(patch)}` · `FileDropzone {onFiles(FileList), label, compact}` · `DocumentList {docs, onKind(i,kind), onRemove(i), editable}` · `DocumentsPanel {docs, onAddFiles(FileList), onChange(fn)}` (dropzone + list, uses domain/files.readFiles) · `LinksEditor {links, onChange(links)}` · `Timeline {items:[{time,label,sub,dot}]}` · `ErrorText {children}` · `Toolbar {children}` (filter row) · `SectionTitle {title, sub, action}` · `Stat {label, value, sub, color}` · `StatGrid {items}` · `ConfirmButton {onConfirm, children, confirmLabel}`
Global CSS: `src/styles/tokens.css` (`--bg --surface --ink --muted --subtle --border --border-strong --hover --primary --primary-hover --primary-soft --sidebar --sidebar-2 --red --green --amber --radius-sm --radius --radius-lg --shadow --shadow-lg --font --mono`) + `src/styles/global.css`.

## Layout & app shell [Agent B]
`src/main.jsx`, `src/App.jsx` (router + global hosts), `src/components/layout/{AppShell,Sidebar,Header,BreakBanner,PreviewBanner,NoAccess,ToastHost,ReminderAlerts,ModalHost,DrawerHost}.jsx`, `src/features/auth/LoginScreen.jsx`, `src/features/settings/SettingsModal.jsx`.
Routes: `/live` `/attendance` `/reports` `/dashboard` `/leads` `/follow-ups` `/projects` `/users` (default `/live`). Projects sub-tab is `pj.tab`; sidebar "Team & hours" = `/projects` with tab 'team'.
Header page actions (per original `hdr`): New lead, New project, Report bug, Log hours, Invite user, New follow-up; plus session controls (status ▾ My day popover, Check in, Break, End shift).

**ModalHost** maps `modal.kind` → lazy component, rendered as `<C {...modal.props} onClose={closeModal} />`:
`fu` features/followups/FollowUpModal · `lead` features/leads/LeadModal · `quote` features/leads/QuoteModal · `proj` features/projects/NewProjectModal · `cr` features/projects/ChangeRequestModal · `log` features/projects/LogHoursModal · `task` features/projects/TaskModal · `bug` features/projects/BugModal · `user` features/users/UserModal · `brk` features/session/BreakModal · `eos` features/session/EndShiftModal · `settings` features/settings/SettingsModal
**DrawerHost** renders: `selLead` → features/leads/LeadDrawer · `pj.selP` → features/projects/ProjectDrawer · `pj.selM` → features/projects/MemberDrawer · `pj.portal` → features/projects/ClientPortalPreview. Each is a default export taking no props (reads store).

Open-modal props (what callers pass): `fu {editId?, leadId?, date?}` · `lead {editId?}` · `quote {leadId, qid?}` · `task {editId?, p?, a?, st?}` · `bug {editId?, p?}` · `log {member?, project?, date?}` · `proj {}` · `cr {pid?, editId?}` · `user {editId?}` · `brk {pid}` · `eos {…initial form}`

## Pages (default exports)
`features/live/LivePage` · `features/attendance/AttendancePage` · `features/reports/ReportsPage` · `features/dashboard/DashboardPage` · `features/leads/LeadsPage` · `features/followups/FollowUpsPage` · `features/projects/ProjectsPage` (tabs + shared filter bar; tab bodies: `features/projects/tabs/{OverviewTab,ProjectsTab,MilestonesTab,ChangeRequestsTab}.jsx` [Agent F] and `features/projects/tabs/{TasksTab,BugsTab,TeamTab,CapacityTab,TimesheetsTab}.jsx` [Agent G]) · `features/users/UsersPage`.
Shared card renderers needed by several features: `features/projects/components/TaskCard.jsx` and `BugCard.jsx` [Agent G] (props `{task}`/`{bug}` + `compact`), `features/followups/components/FollowUpRow.jsx` [Agent E] (props `{fu}`; used by Dashboard agenda and LeadDrawer).

## UI kit & shell notes [Agent B] — read before using `@/components/ui`
- **Event signatures.** Native-like controls pass the native event: `Input`, `Select`, `Textarea`, `SearchInput` → `onChange(e)` (read `e.target.value`). Widget controls pass values: `Toggle`/`Checkbox` → `onChange(nextBool)`, `SegmentedControl`/`FilterChips`/`Tabs` → `onChange(key)`, `DateRangeFilter` → `onChange(patch)` (`{date}`/`{from}`/`{to}`; rename preset key with `field`), `LinksEditor` → `onChange(nextLinks)`, `DocumentsPanel` → `onChange(updaterFn)`, `FileDropzone` → `onFiles(File[])`.
- **KanbanBoard** wraps each `renderCard(item, {dragging})` in an *unstyled* draggable div (opacity .4 while dragging). Card chrome comes from your card component — use the exported **`KanbanCard {onClick, children}`** (white, radius 10, hover ring) if you don't have one. Column extras: `emptyText` (board- or column-level dashed "Drop tasks here" hint), `addLabel` for the `onAdd` "+" button. `onMove(id, toKey)` fires only when the column changes (callers flash `"X → Status"`).
- **Modal** `open` defaults to true (ModalHost mounts it only when active). Extra props: `bodyClassName`, `bodyStyle`, `headerExtra`. Footer: a single child is right-aligned; pass two children (left group, right group) for space-between. `data-autofocus` on an element overrides first-field focus.
- **Drawer** extra props: `actions` (buttons left of ✕), `headerBelow` (extra rows inside the sticky header, e.g. quick-action grid), `header` replaces the title block, `label` = aria-label when using a custom header, `bodyStyle`/`bodyClassName` (default body: padding 18px 22px 40px, column gap 22).
- **Field** wraps children in a `<label>`; use `as="div"` when the child is a widget (SegmentedControl, chip group). Extra: `full` (grid-column 1/-1), `aside` (right side of label row).
- **Input/Select**: `invalid`, `compact` (34px filter-bar height), `inline` (auto width), Input `mono`. `Select options` accepts strings or `{value,label,disabled}`; `placeholder` adds a `value=""` first option.
- **Pill** `size`: `'md'` (rounded status pill) | `'sm'` (tag: radius 5, 11px/600) | `'xs'`. **HuePill** `{hue, dot:boolean, size}`.
- **Button** also takes `href` (renders an anchor). **IconButton** `variant: 'soft'|'plain'`, `size:'lg'` (32px).
- **EmptyState** `variant: 'plain'|'boxed'|'dashed'`; title-only = muted one-liner (e.g. "No leads match these filters.").
- **KpiCard** extra `active` (highlight ring, aria-pressed), `title`. **StatGrid** `{items, cols?, min?}`. **BarList** items also take `dot`, `key`, `title`; `labelWidth`.
- **Checkbox** `checked` may be `'mixed'` (select-all). Clicks stop propagation (safe in clickable rows).
- **DocumentsPanel** handles reading itself (readFiles + `attachedMessage` toast) and calls `onChange(arr => arr.concat(atts))`; pass `onAddFiles` only to override. `editable={false}` = read-only list. Helpers exported: `docMeta`, `docSummary`, `isValidUrl`.
- **ConfirmButton** two-step (arms for 4 s), other props → Button (default `dangerOutline`).
- **Shell**: `AppShell` registers React Router's navigate via `registerNavigate` (from `@/store`) and shows `NoAccess` for any route `canAccessPath` rejects. Sidebar "Settings" (opens modal kind `'settings'`) is shown to a signed-in Super Admin when not previewing. Pages render inside a column container with `gap: 18px` — pages should return fragments/sections, not their own outer padding.

## Agent A additions / changes (implemented — code against these)
**Breaking:** the action `audit(text, kind)` is renamed **`addAudit(text, kind)`** — `audit` is also the state array (audit log), and the two collided.

Store extra actions:
- `togglePerm(roleId, mod, act)` — locked role → flash 'Super Admin is a locked system role'; View off clears c/e/d; c/e/d on forces View on.
- `setPermScope(roleId, mod, scope)` — locked → same flash; View off → flash 'Turn on View first'.
- Role name/description: `updRole(id, r => ({...r, name}))`.
- `addLeadDocs(leadId, atts, skipped=0)` / `addProjDocs(pid, atts, skipped=0)` — append the result of `readFiles()` and flash '3 files attached · 1 skipped (over 10 MB)'. Inside modals keep atts in local form state and flash `attachedMessage(n, skipped)` (domain/files) yourself.
- `setProjLinks(pid, links)` — pass the full edited list (saved + `pj.linkDraft.links` for that pid); valid http(s) links are saved, the rest go to `pj.linkDraft = {pid, links}` (original behaviour).
- `leadForm(lead?)` → initial lead-modal form (handles the Sales Executive "own owner" default). `copyMeet(url)` → copy + 'Meet link copied'. `attPush(who, k)`.
- `fixAccess()` — if the current URL is not allowed for the viewed-as role, sets `pj.tab` if needed and navigates to the first allowed page. Called by `setViewAs`, `login`, and once automatically at startup.
- `registerNavigate(fn)` exported from `@/store` (optional: AppShell may call `useEffect(() => registerNavigate(navigate), [navigate])`). Without it the store uses `history.pushState` + `popstate`, which BrowserRouter picks up. `login` / `logout` / `submitEndShift` navigate to `/live` themselves.
- `crAct` returns an error string only for `'approve'` without a signer name (show in the CR modal); other validation problems (clientReject without note, clientApprove without name / agree) are flashed.
- `saveQuote(leadId, form, qid, send)`, `saveLead(form, editId?)`, `saveFu(form, editId?)`, `saveTask/saveBug/saveUser(form, editId?)`, `saveCr(form, editId?, send)`: `editId` defaults to `form.editId`. `saveCr` form includes `pid`.
- `myBreak()` opens modal `'brk'` with props `{pid}`; BreakModal calls `startBreak(pid, type, note)`. `openEndShift(pid)` opens `'eos'` with props = form `{who, sales, done, blockers, plan, outcome, calls, meetings, rows?, pmRows?}`; EndShiftModal calls `submitEndShift(form, workedHours)` where workedHours = today's `sumDay(...).work / 36e5`.
- `setAttF(patch)` / `setRepF(patch)` merge over defaults `ATT_FILTER_DEFAULT` / `REP_FILTER_DEFAULT` (exported from `@/store/slices/ui`); `attF`/`repF` start as `null`, so read them as `{...ATT_FILTER_DEFAULT, ...attF}`.
- `alerts` holds follow-up ids; `checkReminders()` is a no-op when `useSettings` `reminderAlerts === false`.

Domain extras:
- `permissions.js`: `authUser(state)`, `canAccessPath(state, path, tab?)`, `firstAllowedTarget(state)` → `{path, tab?}|null`, `firstProjectsTab(state)` (original goProj), `MODULE_OF_PATH`. `firstAllowedPath(state)` returns a path string ('/live' when not previewing). `scopeState` returns the same object when nothing is hidden.
- `leads.js`: `calendarUrl(fu, lead)` (Google Calendar link, original `cal()`), `isOpenLead(l)`.
- `files.js`: `attachedMessage(n, skipped)`, `MAX_FILE`, `MAX_STORED`.
- `quotes.printQuote` / `projects.printCr` return `false` when pop-ups are blocked; flash 'Allow pop-ups to download the quote PDF' / 'Allow pop-ups to download the approval PDF'.
- `data/seed/live.js`: `liveBase(live)` (original `lBase`: today's live with empty att/timers/idle/feed defaults).

Hooks:
- `useCurrentUser()` → `{ authUser, user, pid, isSuper }` (user = effective user; pid null for Super Admin / client).
- `useScoped()` returns every state value except actions and `toast`/`modal`/`alerts`, with role scoping applied.
- `@/hooks` index re-exports all hooks.

## Pagination (added after review)
- `DataTable` paginates by default: props `pageSize` (default 10), `itemLabel` ("Showing 1–10 of 42 leads"), `resetKey`, `pagination={false}` to opt out. `render(row, i)` gets the index in the full list.
- Lists/tables not built on `DataTable` use `usePagination(items, {pageSize, resetKey})` + `<Pagination {...pager} label="…" />` from `@/components/ui` (see AttendanceDayTable, CapacityTab, Timesheets matrix, FollowUpList, ActivityLogTab).
- Page sizes: 10 / 25 / 50 / 100. The page resets to 1 when filters, sort or the row count change.
