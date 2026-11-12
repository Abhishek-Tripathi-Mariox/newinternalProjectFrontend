> **Status: done.** The app runs entirely on the API; `src/data/seed` and all browser storage of business data are removed.

# Frontend ↔ API integration contract

Goal: the React app (this folder) uses the Node/Express API (`../backend`, base `/api/v1`, see `../backend/README.md`
and each module's `*.routes.js` / `*.schemas.js` / `*.mapper.js`) as its only data source. **No dummy data and no
browser storage of business data**: `src/data/seed/*` and all `localStorage` persistence are being removed.
Settings (`store/settings.js`) and masters (`store/masters.js`) also move to the API.

## What already exists (don't rewrite)
- `src/api/client.js`: `api.get/page/post/patch/put/del/upload/text`, `getAll(path, query)` (all pages),
  `download(path, query, filename)`, `openPrint(path)`, `ApiError {status, code, message}`, converters
  `ms(iso)`, `dayMs('YYYY-MM-DD')` → local start-of-day ms, `toDay(ms)` → 'YYYY-MM-DD', `iso(ms)`.
  Token handling + refresh on 401 is automatic. Vite proxies `/api` → `http://localhost:4000`.
- `src/api/loaders.js`: bootstrap calls `loadSales(me)`, `loadDelivery(me)`, `loadPeople(me)`, `loadWorkday(me)`,
  `loadMasters(me)` in parallel; each returns a **partial store state**. 403/404 → `{}`. `reload(me, names)`.
- `src/store/slices/session.js`: `restoreSession`, `login` (async), `logout`, `endSession`, `bootstrap`,
  `resync(['delivery', …])`. State: `boot`, `me` (API principal: `{id,name,email,role:{id,name,perms},isSuper,memberId,ownerId,clientOf,team,pid,shiftHours}`), `auth: {uid}`.
- `src/store/initialState.js` (empty data + UI defaults), `src/store/owners.js` (`getOwners()`, `useOwners()`, `firstOwnerId()` — sales owners now live in `state.owners`, loaded from `GET /sales-owners`).
- `src/domain/live.js` (`liveBase`), `src/domain/followUps.js` (`makeFollowUp`) — moved out of `data/seed`.
- `App.jsx` boot splash + `useReminderPolling` (calls `checkReminders()` every 15 s and `pollLive()` every 20 s when signed in).

## Rules
1. **Keep the store's data shapes** (documented in `CONTRACT.md` → "Data shapes": ms timestamps, local-day ms for
   `d`/`due`/`start`, field names like `owner`, `p`, `ms`, `a`, `st`, `h`…). Components and `src/domain/*` keep working
   unchanged. Each `src/api/<domain>.js` contains **adapters** `fromApiX(dto) → store shape` and `toApiX(form) → body`.
2. **Loaders** fetch with `getAll()` / `api.get()` in parallel and return `{ key: adaptedList }`. Skip modules the role
   can't open using `me.role.perms` (Super Admin: everything) to avoid pointless 403s.
3. **Form actions** (`saveLead`, `saveFu`, `saveQuote`, `saveTask`, `saveBug`, `saveLog`, `saveCr`, `saveProj`, `saveUser`,
   `submitEndShift`, `crAct`, masters add/rename…) become `async` and keep their contract: resolve to an **error string**
   (the API message — already the UI wording) or `undefined` on success, then merge the server's returned entity into the
   store (replace by id / insert). Update every caller to `await` (search the codebase; modals typically do
   `const err = await save(form); if (!err) onClose();` — show a busy/disabled state on the primary button while saving).
4. **Quick actions** (toggle done, status/owner change, drag on boards, checklist tick, alloc edit, permission toggle…):
   update the store immediately (as today), then call the API; on failure revert (or `resync`) and `flash(e.message)`.
   Put the shared helper in `src/api/optimistic.js` → `optimistic(set, get, applyFn, requestFn, { rollback, resync })`
   (first agent to need it writes it; keep the signature).
5. After writes with **server-side side effects** (CR approve → project/milestones/tasks; quote accepted → lead Won;
   end shift → logs; merge leads; user create → members/owners), either merge everything the response returns or
   `await get().resync([...])` for the affected domains.
6. Keep flash messages the store already shows; the server's errors replace local validation only where the server is
   stricter. Client-side validation that already exists may stay (fast feedback) — it must match the server wording.
7. **Files**: uploads go to the API (`api.upload`), stored docs keep `{id, name, size, type, at, kind, url}` where `url` is
   the API download path; image thumbnails / "open" links must fetch with auth — use a helper that downloads the blob and
   opens an object URL (put it in `src/api/files.js`).
8. **Print/CSV**: use the server endpoints (`openPrint`, `download`) instead of building HTML/CSV in the browser.
9. No `localStorage` for business data anywhere. `useSettings` keeps only per-browser UI prefs (or moves fully to the API —
   currency/defaultLeadsView/reminderAlerts are server settings: `GET/PUT /settings`).
10. Don't touch other agents' files. Ownership:
    - **Sales agent**: `src/api/{sales,masters}.js`, `store/slices/sales.js`, `store/masters.js`, `store/settings.js`,
      `features/{leads,followups,dashboard,setup,settings}/**`.
    - **Delivery agent**: `src/api/delivery.js`, `src/api/optimistic.js` (if first), `src/api/files.js`, `store/slices/delivery.js`,
      `features/projects/**`, `components/ui/{DocumentsPanel,DocumentList}.jsx` (auth file open/download).
    - **People & workday agent**: `src/api/{people,workday}.js`, `store/slices/{people,workday}.js`,
      `features/{users,live,attendance,reports,session}/**`, `components/layout/**` (session controls, my day).
    - **Backend agent**: `../backend/**` only (extra endpoints listed below).
    The coordinator removes `src/data/seed/` at the end — stop importing from it.

## Extra backend endpoints (being added now by the backend agent; code against these shapes)
- `GET /leads?include=activities,quotes,documents` → each lead also has `activities[]`, `quotes[]`, `documents[]`.
- `GET /milestones?projectId=` → milestones of all visible projects (array, unpaginated or paginated — use `getAll`).
- `GET /projects?include=documents` / `GET /bugs?include=events,attachments` / `GET /change-requests?include=history,documents` — embed the children the UI needs in list responses.
- `GET /attendance/events?from=YYYY-MM-DD&to=YYYY-MM-DD&person=` → `[{ at, personId, kind: login|logout|break|resume, meta }]`. Super Admin: everyone; others: only their own pid (person is forced).
- `GET /live/state` → `{ date, att: {pid: {in,out,brk,brkMin,brkType,brkPlan,brkNote}}, timers: {pid: {task,p,ms,title,start}}, idle: {pid: t}, feed: [{t,who,kind,text,lead}] }` with ISO times. Super Admin: everyone; others: only their own pid.
- `GET /shift-reports?from=&to=&person=` → reports in the frontend `reports` shape (Super Admin all; others own).
- `GET /workday/state` → same as `/live/state` but only the caller (any staff).
