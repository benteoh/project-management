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
├── app/                    # Pages (Next.js App Router)
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── projects/
│       └── [id]/           # Project detail pages
├── components/
│   ├── ui/                 # shadcn components (button, card, etc.)
│   ├── grid/               # AG Grid wrappers
│   └── charts/             # Recharts wrappers
├── types/                  # TypeScript types — the API contract
│   ├── project.ts          # Project, Task, ProjectRate
│   ├── timesheet.ts        # TimesheetEntry, Engineer
│   └── api.ts              # API response shapes (ProjectCVR, etc.)
├── mocks/                  # Mock data for development
│   └── projects.ts         # Realistic Euston project data
├── api/                    # Backend logic
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic (CVR calculations, EAC)
│   └── db/                 # Supabase queries
├── lib/
│   ├── supabase/           # Supabase client setup
│   └── utils.ts            # Shared utilities
data/                       # Real Excel/CSV files from DSP (not in src/)
docs/                       # Design sketches, domain logic, feedback
```

## Development

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build (check before pushing)
npm run lint         # Run linter
```

## Environment

Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Set `NEXT_PUBLIC_USE_MOCKS=true` to work without Supabase.

---

## Daily Workflow

### Starting your day

```bash
cd ~/Desktop/Projects/project-management

# Get latest changes from Ben
git pull

# Install any new dependencies Ben may have added
npm install

# Start the dev server
npm run dev
```

### Before you start working on something

Always create a branch first. Never work directly on `main`.

```bash
# Make sure you're on main and up to date
git checkout main
git pull

# Create your branch
git checkout -b meryl/what-you-are-working-on
```

Name your branches like: `meryl/budget-cards`, `meryl/task-table`, `meryl/fix-chart-label`.

### Saving your work

```bash
# See what you changed
git status

# Stage all your changes
git add .

# Save with a message describing what you did
git commit -m "add budget overview cards to project page"

# Push to GitHub
git push
```

If it's your first push on a new branch, git will tell you to run a longer command — just copy-paste what it suggests.

### Creating a pull request

After pushing, go to GitHub. It will show a yellow banner saying "meryl/your-branch had recent pushes — Compare & pull request". Click it.

Or use the terminal:
```bash
gh pr create --title "Add budget overview cards" --body "Added the 4 summary cards showing fee, spent, profit, and EAC"
```

Ben will review and merge it.

### When you're done for the day

```bash
# Save everything, even if unfinished
git add .
git commit -m "wip: still working on task table"
git push
```

`wip:` means "work in progress" — Ben will know it's not finished.

---

## Using Claude Code to Build Things

Open Claude Code in this project folder. Then describe what you want in plain English:

**Good prompts:**
- "Create a new page at /projects/1 that shows the project name, client, and fixed fee using data from src/mocks/projects.ts"
- "Add a card component that shows a label and a value formatted as currency. Use shadcn Card."
- "Build a line chart using Recharts that shows progressPercent and budgetConsumedPercent from mockCVR.weeklyTrend"
- "The budget card should turn red when budgetConsumedPercent is higher than progressPercent"

**Tips:**
- Always mention which mock data to use
- Reference existing files: "follow the same pattern as src/app/page.tsx"
- If something breaks, paste the error message and say "fix this"
- Say "use shadcn" for buttons, cards, modals — it keeps the style consistent
- After Claude makes changes, check the browser to see if it looks right

---

## Troubleshooting

### "npm run dev" shows an error
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

### "Your branch is behind main"
```bash
git pull origin main
```

If it shows merge conflicts (files with <<<<<<), ask Ben or tell Claude Code "fix the merge conflicts".

### "Changes not staged for commit"
You have unsaved changes. Either commit them or stash them:
```bash
# Save them
git add .
git commit -m "save my work"

# Or temporarily stash them
git stash           # hides your changes
git stash pop       # brings them back
```

### The page looks broken / blank
Check the terminal where `npm run dev` is running. Copy any red error text and paste it to Claude Code.

### "I messed something up and want to start fresh"
```bash
# Undo all changes since your last commit (careful — this deletes your work!)
git checkout .

# Or go back to main
git checkout main
git pull
```

---

## Commit Message Style

Keep it short and descriptive:
```
add budget overview cards
fix chart label alignment
update task table columns
wip: working on CSV import
```

No need for prefixes like `feat:` or `fix:` — just describe what you did.
