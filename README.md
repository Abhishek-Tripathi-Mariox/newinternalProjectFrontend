# Mariox Internal Portal — Frontend

React 19 + Vite port of the Mariox CEO Portal prototype (`../../Mariox CEO Portal Design`).
It covers live team status, attendance, reports, the sales pipeline (dashboard, leads, quotes, follow-ups),
delivery (projects, milestones, tasks, bugs, team, capacity, change requests, timesheets, client portal)
and admin (users, roles, permissions).

> There is no backend yet. All data is seeded in the browser and saved to `localStorage`.
> To reset, clear site data in the browser.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the build
npm run lint
```

Demo login: any seeded account, password `mariox123`. The login screen lists one-click demo accounts
(Super Admin, Project Manager, Team Lead, Developer, Sales).

## Architecture

```
src/
  config/constants.js     static portal config: statuses, hues, modules, presets
  lib/                    framework-free helpers: date, format, color, download/print, random
  data/seed/              deterministic demo data + localStorage load and migrations
  store/                  Zustand store (one store, slices) + settings store
  domain/                 pure business logic: permissions & scoping, lead scoring,
                          project health & hour totals, attendance, quotes, change requests, files
  hooks/                  useScoped, useCan, useNow, useCurrentUser, useProjectsModel …
  components/ui/          reusable UI kit (Button, Modal, Drawer, KanbanBoard, DataTable, …)
  components/layout/      app shell: sidebar, header, banners, modal/drawer/toast hosts
  features/<module>/      one folder per module: page, module components, modals, view-model hook
  styles/                 design tokens + global CSS
```

Key decisions:

- **One store, many slices.** Actions always change the full data set and validate like the prototype.
  Form actions return an error string, or `undefined` on success.
- **Role scoping happens when data is read.** `useScoped()` returns a copy of the state filtered to the
  viewer's permission scope (all / team / own). Writes always go to the full data, so a limited view
  can never delete records it can't see.
- **One modal registry.** `openModal(kind, props)` opens a lazy-loaded modal. Each modal keeps its own
  form state locally.
- **Derived data stays out of the store.** It is computed in domain functions and memoised hooks.
- **Styling** uses CSS Modules on top of design tokens, with OKLCH colours generated from one hue per status.

`CONTRACT.md` documents the interfaces between store, domain, UI kit and features.

## Configuration

Portal settings (Super Admin → sidebar → Settings): currency (INR/USD), default leads view, reminder alerts.
