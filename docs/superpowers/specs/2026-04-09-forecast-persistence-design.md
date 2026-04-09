# Forecast Persistence — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

**Companion spec:** [`src/components/forecast/AUTOFILL_PLAN.md`](../../../src/components/forecast/AUTOFILL_PLAN.md) — spreadsheet autofill (preview, Apply/Discard, distribution). Persistence and autofill share the same **committed grid state** (`cellValuesRef` / `CellValues`); this document covers **load**, **manual save to Supabase**, and **localStorage drafts** only.

---

## Problem

The demand forecast grid is fully functional but entirely in-memory. Cell values (hours per engineer per task per day) are lost on page reload. PMs have no way to save their work.

---

## User Story

As a PM, I want to add, remove, and update forecasted hours for engineers across their tasks per day, with a manual save that pushes to the database and a draft backup in localStorage so I never lose in-progress work.

---

## Approach

Normalized `forecast_entries` table in Supabase (one row per scope × engineer × date). Manual **Save** pushes the **current committed grid snapshot** at once. localStorage auto-saves a draft on every change to that committed state. On load, if both draft and saved data exist, the PM is prompted to choose.

**Alignment with autofill (AUTOFILL_PLAN):**

| Topic                    | Persistence behaviour                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Row identity**         | Same as autofill: stable `` rowId = `${scopeId}-${engineerId}` `` — must match AUTOFILL_PLAN §2 / §4.5 when mapping DB rows ↔ grid.                                                               |
| **Cell values shape**    | `CellValues` = `Record<rowId, Record<field, unknown>>` where date columns are ISO `YYYY-MM-DD` field keys (AUTOFILL_PLAN §5.1). Load/save round-trips this structure.                             |
| **Hours**                | **Integer hours only** for stored values (AUTOFILL_PLAN §2 / §13). Validate or round at the save boundary; DB `numeric` still fine.                                                               |
| **Autofill preview**     | `pendingValuesRef` / `pendingFill` is **not** persisted and **does not** count as unsaved until **Apply** merges into `cellValuesRef` (AUTOFILL_PLAN §7). Tab refresh loses preview — acceptable. |
| **After autofill Apply** | Treated like any other edit: draft debounce + unsaved indicator + eligible for **Save** to Supabase.                                                                                              |
| **Undo**                 | After Apply, existing grid history applies; successful **Save** does not add a separate undo concept — DB is source of truth post-save.                                                           |

---

## 1. Data Model

### New table: `forecast_entries`

| Column        | Type                             | Notes                                             |
| ------------- | -------------------------------- | ------------------------------------------------- |
| `id`          | `uuid` PK                        | auto-generated (`gen_random_uuid()`)              |
| `project_id`  | `text` FK → `projects.id`        | for project-scoped queries                        |
| `scope_id`    | `text` FK → `programme_nodes.id` | the scope row                                     |
| `engineer_id` | `uuid` FK → `engineer_pool.id`   | the engineer                                      |
| `date`        | `text`                           | ISO date `YYYY-MM-DD`                             |
| `hours`       | `numeric`                        | **integer in practice** (0–24), per AUTOFILL_PLAN |

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

1. **Fetch from Supabase** — `loadForecastEntries(projectId)` returns all entries, mapped to `Record<rowId, Record<isoDate, number>>` where `rowId = "${scopeId}-${engineerId}"` (same convention as AUTOFILL_PLAN §2 / §4.5).
2. **Check localStorage** — key `forecast_draft_${projectId}`. Shape: `{ values: CellValues, savedAt: string (ISO timestamp) }` (same `CellValues` as autofill §5.1).
3. **Resolve conflict:**
   - Both exist → show conflict banner (see §4)
   - Draft only → restore silently
   - Supabase only → load silently
   - Neither → grid starts empty
4. **Loading state** — grid shows skeleton while fetch is in flight

**Note:** If autofill preview were active (not realistically on cold load), there is no persisted preview — only draft vs server matters here.

---

## 3. Save & Draft Flow

### Draft (automatic, localStorage)

- Triggered on every change to **committed** cell state: `onChange` from `useCellStore` **and** any path that merges autofill **Apply** into `cellValuesRef` (same underlying ref).
- Debounced 300ms to avoid thrashing
- Stored as `{ values: snapshot of cellValuesRef, savedAt: ISO timestamp }`
- Cleared on successful manual save
- Fails silently (localStorage write errors are non-critical)

**Preview-only autofill:** No draft write — preview does not mutate `cellValuesRef` until Apply (AUTOFILL_PLAN §7.3–7.4).

### Manual Save (Supabase)

- PM clicks **Save** in the forecast toolbar (alongside autofill actions per AUTOFILL_PLAN §9.1)
- Button shows spinner while in-flight
- **Upsert:** All non-null, non-zero cell values → `forecast_entries` (batch upsert on unique constraint)
- **Delete:** On save, the function fetches existing entries for the project, diffs against `currentValues`, and deletes any `(scope_id, engineer_id, date)` rows not present in the current snapshot
- On success: clear localStorage draft, reset unsaved indicator
- On failure: toast error message, draft preserved, unsaved indicator remains

### Unsaved indicator

- Amber dot (`text-status-warning`) on the Save button
- Appears on first change to committed grid state after load or after last save (including after **Autofill → Apply**)
- Disappears on successful save
- **Not** shown for autofill preview alone (only after Apply or manual edits)

---

## 4. UI Changes

### Conflict banner

Appears above the toolbar when both a localStorage draft and Supabase data exist on load. Dismisses once the PM picks an option.

> _"You have a local draft from [formatted time]. Restore draft or use saved version?"_  
> **[Restore draft]** &nbsp; **[Use saved]**

Styled with `bg-status-warning-bg` / `text-status-warning` tokens. Not a modal — grid is visible behind it.

### Toolbar layout (persistence + autofill)

- **Left / centre:** Existing forecast controls; **Autofill (all)** / **Autofill (selection)** per AUTOFILL_PLAN §9.1
- **Right:** **Save** — amber dot when unsaved, spinner when in-flight, disabled while save is in progress

While an autofill **preview** is active, autofill buttons follow AUTOFILL_PLAN §9.1 (e.g. discard first); **Save** persists **committed** values only (preview not included until Apply).

---

## 5. Files

### New

| File                                                          | Purpose                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `supabase/migrations/20260409000000_add_forecast_entries.sql` | Table DDL, unique constraint, RLS                                                 |
| `src/types/forecast-entry.ts`                                 | `ForecastEntry` + `ForecastEntryDbRow` types                                      |
| `src/lib/forecast/forecastDb.ts`                              | `loadForecastEntries(projectId)`, `saveForecastEntries(projectId, currentValues)` |
| `src/lib/forecast/forecastDraft.ts`                           | `loadDraft(projectId)`, `saveDraft(projectId, values)`, `clearDraft(projectId)`   |

### Modified (this feature)

| File                                           | Change                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/forecast/ForecastTab.tsx`      | Load on mount, conflict banner, Save, unsaved state, wire draft + save |
| `src/components/forecast/useCellStore.ts`      | Expose `onChange` (or equivalent) for draft + unsaved tracking         |
| `src/components/forecast/forecastGridTypes.ts` | `DraftConflict` (or banner state type) if needed                       |

### Autofill (separate track — AUTOFILL_PLAN §10)

Autofill adds e.g. `forecastAutofillUtils.ts`, `useAutofill.ts`, enriched `ForecastGridRow`, toolbar buttons, preview bar, and optional `ForecastAgGrid.tsx` / `forecastColumnDefs.ts` changes. **Persistence does not duplicate that work** but **must** subscribe to the same `cellValuesRef` / Apply path so Save and draft see autofill-applied hours.

### Grid / keyboard — persistence-only

No **additional** changes required **for persistence alone** if all mutations flow through `ForecastTab` + cell store. Autofill may still touch `ForecastAgGrid.tsx`, `forecastColumnDefs.ts`, `useGridKeyboard.ts` per AUTOFILL_PLAN — coordinate so Escape/undo behaviour matches §9.5 there.

---

## 6. Out of Scope

- Auto-save to Supabase (not manual) — deliberately excluded; PMs want control
- Per-row or per-scope save granularity — whole project saves at once
- Real-time conflict resolution between multiple PMs editing simultaneously — v1 ignores this; last save wins
- Annual leave, scope-end **clipping** for autofill, half-day holidays — see AUTOFILL_PLAN (§2, §12–13)
- **Server-side behaviour of autofill** — autofill remains client-side; Save is the only path to `forecast_entries` in this spec
