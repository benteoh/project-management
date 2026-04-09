# Forecast Persistence — Design Spec

**Date:** 2026-04-09
**Status:** Approved

---

## Problem

The demand forecast grid is fully functional but entirely in-memory. Cell values (hours per engineer per task per day) are lost on page reload. PMs have no way to save their work.

---

## User Story

As a PM, I want to add, remove, and update forecasted hours for engineers across their tasks per day, with a manual save that pushes to the database and a draft backup in localStorage so I never lose in-progress work.

---

## Approach

Normalized `forecast_entries` table in Supabase (one row per scope × engineer × date). Manual save button pushes all values at once. localStorage auto-saves a draft on every edit. On load, if both draft and saved data exist, the PM is prompted to choose.

---

## 1. Data Model

### New table: `forecast_entries`

| Column        | Type                             | Notes                                |
| ------------- | -------------------------------- | ------------------------------------ |
| `id`          | `uuid` PK                        | auto-generated (`gen_random_uuid()`) |
| `project_id`  | `text` FK → `projects.id`        | for project-scoped queries           |
| `scope_id`    | `text` FK → `programme_nodes.id` | the scope row                        |
| `engineer_id` | `uuid` FK → `engineer_pool.id`   | the engineer                         |
| `date`        | `text`                           | ISO date `YYYY-MM-DD`                |
| `hours`       | `numeric`                        | integer in practice, 0–24            |

**Unique constraint:** `(project_id, scope_id, engineer_id, date)` — saves are upserts.

**Row deletion:** Cells cleared to 0 or null are removed from the table (not stored as 0).

**RLS:** Enabled. Follow same pattern as other tables — explicit allow policies.

### New types: `src/types/forecast-entry.ts`

```ts
// Domain type — used throughout UI/business logic
export interface ForecastEntry {
  id: string;
  projectId: string;
  scopeId: string;
  engineerId: string;
  date: string; // ISO YYYY-MM-DD
  hours: number;
}

// DB row type — only used at repository boundary
export interface ForecastEntryDbRow {
  id: string;
  project_id: string;
  scope_id: string;
  engineer_id: string;
  date: string;
  hours: number;
}
```

---

## 2. Load & Conflict Flow

On `ForecastTab` mount:

1. **Fetch from Supabase** — `loadForecastEntries(projectId)` returns all entries, mapped to `Record<rowId, Record<isoDate, number>>` where `rowId = "${scopeId}-${engineerId}"`
2. **Check localStorage** — key `forecast_draft_${projectId}`. Shape: `{ values: CellValues, savedAt: string (ISO timestamp) }`
3. **Resolve conflict:**
   - Both exist → show conflict banner (see §4)
   - Draft only → restore silently
   - Supabase only → load silently
   - Neither → grid starts empty
4. **Loading state** — grid shows skeleton while fetch is in flight

---

## 3. Save & Draft Flow

### Draft (automatic, localStorage)

- Triggered on every cell change via `onChange` callback from `useCellStore`
- Debounced 300ms to avoid thrashing
- Stored as `{ values: snapshot of cellValuesRef, savedAt: ISO timestamp }`
- Cleared on successful manual save
- Fails silently (localStorage write errors are non-critical)

### Manual Save (Supabase)

- PM clicks **Save** button in forecast toolbar
- Button shows spinner while in-flight
- **Upsert:** All non-null, non-zero cell values → `forecast_entries` (batch upsert on unique constraint)
- **Delete:** On save, the function fetches existing entries for the project, diffs against `currentValues`, and deletes any `(scope_id, engineer_id, date)` rows not present in the current snapshot
- On success: clear localStorage draft, reset unsaved indicator
- On failure: toast error message, draft preserved, unsaved indicator remains

### Unsaved indicator

- Amber dot (`text-status-warning`) on the Save button
- Appears on first cell edit after load or after last save
- Disappears on successful save

---

## 4. UI Changes

### Conflict banner

Appears above the toolbar when both a localStorage draft and Supabase data exist on load. Dismisses once the PM picks an option.

> _"You have a local draft from [formatted time]. Restore draft or use saved version?"_
> **[Restore draft]** &nbsp; **[Use saved]**

Styled with `bg-status-warning-bg` / `text-status-warning` tokens. Not a modal — grid is visible behind it.

### Save button

Added to the right side of the existing forecast toolbar. Label: **Save**. Shows amber dot when unsaved changes exist. Shows spinner on save in-flight. Disabled while save is in progress.

---

## 5. Files

### New

| File                                                          | Purpose                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `supabase/migrations/20260409000000_add_forecast_entries.sql` | Table DDL, unique constraint, RLS                                                 |
| `src/types/forecast-entry.ts`                                 | `ForecastEntry` + `ForecastEntryDbRow` types                                      |
| `src/lib/forecast/forecastDb.ts`                              | `loadForecastEntries(projectId)`, `saveForecastEntries(projectId, currentValues)` |
| `src/lib/forecast/forecastDraft.ts`                           | `loadDraft(projectId)`, `saveDraft(projectId, values)`, `clearDraft(projectId)`   |

### Modified

| File                                           | Change                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `src/components/forecast/ForecastTab.tsx`      | Load on mount, draft conflict banner, save button, unsaved state |
| `src/components/forecast/useCellStore.ts`      | Expose `onChange` callback for cell changes                      |
| `src/components/forecast/forecastGridTypes.ts` | Add `DraftConflict` type for banner state                        |

### Untouched

`ForecastAgGrid.tsx`, `forecastColumnDefs.ts`, `useGridHistory.ts`, `useGridSelection.ts`, `useGridKeyboard.ts` — no changes required.

---

## 6. Out of Scope

- Auto-save to Supabase (not manual) — deliberately excluded; PMs want control
- Per-row or per-scope save granularity — whole project saves at once
- Real-time conflict resolution between multiple PMs editing simultaneously — v1 ignores this; last save wins
- Annual leave dates — tracked in AUTOFILL_PLAN.md as v2
