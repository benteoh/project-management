# DSP Project Intelligence Platform

## What This Is

A project management platform for DSP, a tunnel engineering consultancy (~100 engineers, 6 offices globally). Replaces fragmented Excel-based workflows with a unified system.

## The Problem

- PMs can't see real-time budget health — timesheet data arrives monthly, by which time overspend is already baked in
- Progress tracking is gut-feel ("I think we're 60% done") — no objective measurement
- Each PM uses their own Excel style — no standardised data, no cross-project comparison
- No structured way to plan who works on what, or compare plan vs reality
- Previous software implementations failed because they were too complex

## What We're Building

- **Programme / Scope** (current focus) — project setup, WBS (task → subtask → sub-subtask), scope definition with task types and complexity. The foundation everything else reads from.
- **Demand Forecasting** (current focus) — per-engineer, per-task, per-week hour allocation. Task scopes auto-fill the grid (autocomplete from scoped hours + date range). Forecast vs actual comparison.
- **Budget Tracker** — actual spend vs budget, CVR trend chart, EAC, alerts when overspending. Reads from timesheet actuals and forecast data.
- **Resource Matrix** — cross-project engineer availability, utilisation heat map. Reads from demand forecasts across all projects.
- **Portfolio & Retrospectives** — all-project dashboard with RAG status, post-project feedback loop.

## Who Uses It

- **PMs / Task Leaders**: project budget health, task breakdown, forecast vs actual
- **Operational Director**: resource allocation across projects, utilisation
- **Engineers**: their allocated hours, which tasks to work on
- **Leadership / MD**: portfolio health, profitability by sector, bid confidence

## Key Design Principles

- **Feels like Excel, not enterprise software** — PMs like spreadsheets, don't fight it
- **Show value in 5 seconds** — main view answers "are we over budget?" without clicking
- **Minimal input burden** — import existing data, autocomplete from task scopes, don't re-enter
- **System informs, PM decides** — no auto-scheduling or black box recommendations

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui (buttons, cards, modals), AG Grid (spreadsheet-like tables)
- **Charts**: Recharts
- **Database**: Supabase (Postgres)
- **Hosting**: Vercel (frontend), Supabase (backend)

## Key Domain Concepts

- **Programme**: the entire scoping of a project. One project has one programme.
- **Scope**: a high-level breakdown item within a programme (e.g. "Network Rail Boiler Room", "Endwalls Design").
- **Activity**: a task or piece of work within a scope (e.g. "Removal of infill panels", "Structural modelling"). Engineers log time against activities.
- **Hierarchy**: Programme → Scope → Activity. Progress rolls up bottom-to-top.
- **Demand forecast**: hours allocated per engineer per activity per week. Scoped hours + date range auto-fill the grid. PM adjusts from there.
- **CVR (Cost Variation Report)**: compares budget consumed % vs progress %. If budget > progress, the project is overspending. AECOM format is the reference.
- **EAC (Estimate at Completion)**: actual cost to date + estimated cost to complete remaining work.
- **Fixed fee**: DSP's projects are mostly fixed-fee — overspend directly erodes profit.
- **Activity types**: concept design, detailed design, technical review, CAD, workshop, report, site visit.
- **Triple constraint**: scope, time, cost. For designers, scope is fixed — time and cost vary.

## Project Structure

```
src/
├── app/                        # Pages (Next.js App Router)
│   ├── layout.tsx              # Root layout — fonts, metadata
│   ├── page.tsx                # Home / project list
│   ├── globals.css             # Design system tokens (edit here, not inline)
│   └── projects/[id]/          # Project detail page + tab shell
├── components/
│   ├── ui/                     # shared primitives
│   ├── programme/              # Programme tab components
│   ├── forecast/               # Demand forecast tab components
│   ├── charts/                 # Recharts wrappers
│   └── grid/                   # AG Grid wrappers
├── types/                      # TypeScript types — single source of truth for data shapes
│   ├── project.ts              # Project, Programme, Scope, Activity, ProjectRate
│   ├── timesheet.ts            # TimesheetEntry, Engineer
├── api/                        # Future: server-side logic
│   ├── services/               # Business logic (CVR, EAC, hour rollups) — not yet in use
│   └── db/                     # Supabase queries — not yet in use
├── lib/
│   ├── programme/              # Programme repository, DB helpers, seed tree
│   ├── projects/               # Project header load (`projectDb.ts`)
│   ├── supabase/               # Supabase client setup + env resolution
│   └── utils.ts                # Pure utilities: formatCurrency, formatDate, cn
```

---

## Engineering Standards

These rules exist so the codebase stays clean and understandable as it grows. They apply whether you're a human developer or Claude Code.

---

### Code quality

**Keep components small.** If a component file is getting long, split it. A good rule of thumb: if it scrolls for more than a screen, it probably does too much. Ensure that before implementing a new component, you check for reusable components in codebase. If there is a similar component, use that instead of creating a new one, and abstract if necessary.

**One responsibility per file.** A file either defines types, holds seed/fixture data (e.g. `supabase/seed.ts`, `seedProgrammeData.ts`), performs calculations, or renders UI. Not more than one. Never put large hardcoded data arrays inside a component.

**Extract hooks and utilities before they're needed.** When adding behaviour to a component, ask whether it belongs in the component at all. Stateful logic with no JSX → custom hook (`use*.ts`). Pure functions with no React → utility module. Constants with no imports → constants file. Do not let components accumulate logic that could be split out. A component file that imports more than ~5 hooks or has more than ~150 lines of non-JSX logic is a sign that extraction is overdue.

**Name files by what they contain, not where they're used.** `forecastCellUtils.ts` not `ForecastAgGridHelpers.ts`. `useCellStore.ts` not `useForecastGridState.ts`. The name should describe the responsibility, not the consumer.

**Types first.** Before writing a new component or function, check `src/types/` to see if the data shape already exists. If it doesn't, define it there before writing the component. This prevents duplicate or conflicting shapes emerging in different files.

**Internal types belong near their module, not in `src/types/`.** Domain types (shapes that cross feature boundaries or map to DB rows) go in `src/types/`. Implementation-specific types that are internal to a feature module (e.g. `RowData`, `SelRange` inside the forecast grid) go in a `*Types.ts` file co-located with that feature. Never pollute `src/types/` with library-specific or internal shapes.

**Separate domain vs database types.** When data comes from Supabase, define two explicit shapes where needed: a domain/app type (camelCase, e.g. `Project`) and a DB row type (snake_case, suffixed `DbRow`, e.g. `ProjectDbRow`). Perform mapping at repository/DB boundary functions (e.g. `rowToProject`) so DB naming never leaks into UI/business code.

**No raw hex colours.** Always use design system tokens (see Design System section). The only exception is Recharts, which requires inline colour strings — use `var(--color-chart-1)` etc.

**Dates are ISO 8601 internally.** Store and pass dates as `YYYY-MM-DD` strings. Only format for display at the render layer using `formatDate()` from `src/lib/utils.ts`. Non-standard formats (like `dd-Mon-yy`) are only acceptable when importing/exporting external files.

**No `any`.** TypeScript strict mode is on. If you don't know the type, look it up or define it in `src/types/`.

---

### Architecture

**Business logic does not live in components.** Calculations like CVR, EAC, progress rollups, and hour aggregation should live in `src/api/services/` — not inside component files. Components receive computed values as props; they do not compute them.

**Project and programme data come from Supabase.** The project page loads the project row (`projects` table), programme tree, and engineer pool on the server; components receive data and persistence callbacks as props — they do not call Supabase directly.

**Default to Server Components.** Only add `"use client"` when you need browser interactivity (click handlers, useState, useEffect). Data fetching should happen server-side where possible — not in `useEffect`.

---

### Security (scaffolding — implement when each piece is added)

These rules don't require action now, but must be followed when the relevant feature is built.

**Environment variables**

- `NEXT_PUBLIC_*` variables are visible in the browser — never put secrets here
- The Supabase anon key is safe to expose (Supabase Row Level Security controls access)
- Any service role key must be server-only, never `NEXT_PUBLIC_*`
- Never commit `.env.local` — it is gitignored

**When Supabase database tables are created**

- Enable Row Level Security on every table before it goes live
- The default policy denies all — add explicit allow policies
- Store migration SQL in `supabase/migrations/` so it is version-controlled

**When authentication is added**

- Use Supabase Auth. Route protection goes in `src/middleware.ts` — not repeated in every page
- Never trust the client for user identity or role — always verify server-side
- Roles: `admin`, `pm`, `engineer`, `viewer` — store in Supabase, not in the JWT

**When API routes are created**

- All routes that mutate data require authentication
- Validate all inputs before touching the database — never trust raw request data
- Use parameterised queries only — never build raw SQL strings

**Always**

- Never use `dangerouslySetInnerHTML` — React escapes JSX output by default
- Run `npm audit` before adding a new dependency

---

### Error handling (scaffolding — implement as features are built)

- Every page should have an `error.tsx` alongside it (Next.js App Router pattern) so errors don't show a blank screen
- Every async data fetch should have a loading state — show a skeleton, not nothing
- Never expose raw error messages or stack traces to the UI — log server-side, show a calm human message to the user

---

### Design System

All UI must follow these standards. Tokens are defined in `src/app/globals.css`.

**Typography**

- **Font**: Inter (Notion-style sans-serif)
- **Page title**: `text-2xl font-semibold text-foreground`
- **Section heading**: `text-sm font-semibold text-foreground`
- **Table / data label**: `text-xs font-medium uppercase tracking-wide text-muted-foreground`
- **Body**: `text-sm text-foreground`
- **Caption / helper**: `text-xs text-muted-foreground`

**Colour tokens** (use these, not raw hex)
| Token | Value | Use |
|---|---|---|
| `bg-background` | #f9f9f9 | Page background |
| `bg-card` | #ffffff | Card / panel surface |
| `text-foreground` | #18181b | Primary text |
| `text-muted-foreground` | #71717a | Secondary / label text |
| `border-border` | #e4e4e7 | Dividers, card borders |
| `bg-gold` / `text-gold` | **#e4a824** | Brand accent — sacred, never adjust |
| `text-status-healthy` / `bg-status-healthy-bg` | green | On track |
| `text-status-warning` / `bg-status-warning-bg` | gold | At risk |
| `text-status-critical` / `bg-status-critical-bg` | red | Overspend / blocked |
| `text-status-info` / `bg-status-info-bg` | blue | Progress, neutral info |

**Radius**: Base 8px. `rounded-lg` for cards/panels, `rounded-md` for inputs/badges, `rounded-sm` for tight elements.

**Elevation**: Cards always use `shadow-card`. Dropdowns/popovers use `shadow-elevated`. Modals use `shadow-overlay`. Never flat white on flat white.

**Spacing**

- Page padding: `p-6` desktop / `p-4` mobile
- Card internal padding: `p-5`
- Section gap: `gap-4` or `gap-6`
- Table row: `py-3 px-4` / compact: `py-2 px-4`

**Chart colours** (always in this order)

1. Blue `--chart-1` — progress / forecast
2. Green `--chart-2` — healthy / on track
3. Gold `--chart-3` — brand / budget reference
4. Red `--chart-4` — critical / overspend
5. Grey `--chart-5` — neutral comparison

**Rules**

- Never use raw hex in components — always tokens
- Gold is sacred — never adjust `#e4a824`
- Status indicators always use the four semantic tokens
- Charts use `var(--color-chart-N)` for stroke/fill values

---

## Development

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build — run before pushing
npm run lint         # Linter
```

## Environment

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Configure Supabase in `.env.local` (see `.env.local.example`):

- **Hosted**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the project dashboard.
- **Local (CLI)**: `npm run db:start`, then `npm run db:status` for the API URL and anon key. You can set `NEXT_PUBLIC_SUPABASE_USE_LOCAL=true` and only the anon key; the API URL defaults to `http://127.0.0.1:54321` (see `supabase/config.toml`). Apply migrations (`npm run db:push` or reset) and seed (`npm run seed`) against the same target as in `.env.local`.

Without valid credentials, the programme tab shows a load error and an empty tree.

**Never commit `.env.local`.**

---

## Daily Workflow

### Starting your day

```bash
cd ~/Desktop/Projects/project-management
git pull
npm install
npm run dev
```

### Before you start working on something

Always create a branch first. Never work directly on `main`.

```bash
git checkout main
git pull
git checkout -b meryl/what-you-are-working-on
```

Name your branches like: `meryl/budget-cards`, `meryl/task-table`, `meryl/fix-chart-label`.

### Before opening a pull request

```bash
npm run build        # must pass — no type errors, no broken imports
npm run lint         # must pass
```

### Saving your work

```bash
git status
git add .
git commit -m "add budget overview cards to project page"
git push
```

### When you're done for the day

```bash
git add .
git commit -m "wip: still working on task table"
git push
```

---

## Schema Updates

**Migrations** change the database **structure** (tables, columns, indexes, policies). **Seed** inserts or upserts **sample rows** for dev. They are separate steps; both should match whatever URL is in `.env.local`.

### 1. Add a migration (always a new file)

- Create a **new** SQL file under `supabase/migrations/`, with a **timestamp prefix** so order is clear, e.g. `20260330120000_add_foo_column.sql`.
- Put only forward schema changes there. **Do not rewrite migrations that have already been applied** on shared or production databases; add a follow-up migration instead.
- If you add columns, update app types (`src/types/…`) and any queries that read/write those columns.

### 2. Update seed data (optional but common for dev)

- **`supabase/seed.ts`** — orchestrates upserts (projects, engineer pool, programme nodes, scope engineers).
- **`src/lib/programme/seedConfig.ts`** — sample project row, engineer codes, re-exports programme tree.
- **`src/lib/programme/seedProgrammeData.ts`** — large static WBS used only by the seed script.

Seed uses **upserts** where possible; re-running is usually safe for demo data.

### 3. Apply migrations to the database you are using

| Target                      | What to run                                        | Notes                                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local Supabase (Docker)** | `npx supabase db reset --local`                    | Wipes local data, reapplies **all** migrations from `supabase/migrations/`. Use when you want a clean dev DB.                                                                               |
| **Hosted Supabase**         | `npx supabase db push` (same as `npm run db:push`) | Applies **pending** migrations to the **linked** remote project (`npx supabase link` once per machine/repo). Does **not** apply to your Docker DB unless you use a local-specific workflow. |

**Important:** `npm run db:push` talks to the **remote** project when the CLI is linked. For **local** Docker, prefer **`db reset --local`** (or another local migration command you standardise on), not `db:push`, unless you know you intend to push to remote.

### 4. Seed that same database

```bash
npm run seed
```

Uses `.env.local` (then `.env`) — so it hits **whichever** Supabase URL/keys you configured. After a **local reset**, run seed again if you want the sample project and programme tree back.

### 5. Commit and PR

Commit the new migration SQL together with related TypeScript changes. Run `npm run build` before opening a PR.

## Troubleshooting

### "npm run dev" shows an error

```bash
rm -rf node_modules && npm install && npm run dev
```

### "Your branch is behind main"

```bash
git pull origin main
```

### The page looks broken / blank

Check the terminal where `npm run dev` is running. Copy any red error text and paste it to Claude Code.

### "I messed something up and want to start fresh"

```bash
git checkout .      # undo all changes since last commit
git checkout main && git pull
```

---

## Commit Message Style

Short and descriptive:

```
add budget overview cards
fix chart label alignment
update task table to use Scope type
wip: working on CSV import
```
