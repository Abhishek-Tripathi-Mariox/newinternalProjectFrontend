# Mariox Internal Portal — Frontend

React 19 + Vite port of the Mariox CEO Portal prototype (`../../Mariox CEO Portal Design`).
It covers live team status, attendance, reports, the sales pipeline (dashboard, leads, quotes, follow-ups),
delivery (projects, milestones, tasks, bugs, team, capacity, change requests, timesheets, client portal)
and admin (users, roles, permissions).

> All data comes from the API in `../backend` (Node + Express + PostgreSQL). Nothing is generated or
> stored in the browser. Start the backend first (see `../backend/README.md`).

## Getting started

```bash
# 1. backend (once): cd ../backend && npm install && npm run db:up && npm run migrate && npm run seed
# 2. backend:        cd ../backend && npm run dev          # http://localhost:4000
npm install
npm run dev       # http://localhost:5173 — /api is proxied to http://localhost:4000
npm run build     # production build in dist/
npm run preview   # serve the build
npm run lint
```

Sign in with the Super Admin the backend seed creates (`SUPER_ADMIN_*` in `../backend/.env`). New users get a one-time link (`/accept-invite?…`) from Users & roles → Invite user.

## Architecture

```
src/
  config/constants.js     static portal config: statuses, hues, modules, presets
  lib/                    framework-free helpers: date, format, color, download/print, random
  api/                    HTTP client (token + refresh), per-domain loaders, adapters (API ↔ store shapes)
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

- **API-backed store.** After sign-in `bootstrap()` loads every domain from the API in parallel. Form saves
  await the server and resolve to its error message (or `undefined`); quick edits update the screen first and
  roll back if the server rejects them. The access token lives in memory; the refresh token is an httpOnly cookie.
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
