# DSP Project Intelligence — Tool 1: Budget Tracker

A budget health tracker for engineering projects. Shows actual spend vs budget, weekly trends, and alerts when projects are going over budget.

Built for DSP, a tunnel engineering consultancy. PMs currently track everything in Excel and can't see budget health until it's too late.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui (buttons, cards, modals), AG Grid (spreadsheet-like tables)
- **Charts**: Recharts
- **Database**: Supabase (Postgres)
- **Hosting**: Vercel (frontend), Supabase (backend)

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

# Guide for Meryl

## First Time Setup (One-Time)

### 1. Install tools

Open Terminal (Cmd + Space → type "Terminal") and run these one at a time:

```bash
# Install Node.js (needed to run the project)
brew install node

# Install Git (for version control)
brew install git

# Check they worked
node --version    # should show v20+ or v22+
git --version     # should show a version number
```

### 2. Clone the project

```bash
cd ~/Desktop/Projects
git clone git@github.com:benteohmes/project-management.git
cd project-management
npm install
```

### 3. Set up environment

```bash
cp .env.local.example .env.local
```

No need to edit it — mocks are on by default.

### 4. Run the project

```bash
npm run dev
```

Open http://localhost:3000 in your browser. You should see the app.

To stop the server: press `Ctrl + C` in the terminal.

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
