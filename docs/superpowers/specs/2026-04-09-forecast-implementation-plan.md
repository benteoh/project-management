# Forecast — Implementation plan

**Date:** 2026-04-09  
**Specs:** [`AUTOFILL_PLAN.md`](../../../src/components/forecast/AUTOFILL_PLAN.md) · [`2026-04-09-forecast-persistence-design.md`](./2026-04-09-forecast-persistence-design.md)

This plan orders work by dependency: **shared foundations → autofill (algorithm + UX) → persistence (DB + client) → integration & verification**. Autofill and persistence can be developed in parallel on separate branches after Phase A, but **ForecastTab integration** should land once both are ready (or persistence first with Save disabled until autofill Apply path is wired).

---

## 1. Goals & success criteria

| Track           | Done when                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Autofill**    | Preview/Apply/Discard per AUTOFILL_PLAN; `autofill()` covered by unit tests for §11 cases; toolbar + confirmation bar; no duplicate `(scopeId, engineerId)` rows; stable row ids. |
| **Persistence** | `forecast_entries` migration applied; load/save + draft + conflict banner per persistence spec; Save commits only **committed** `cellValuesRef` (preview excluded until Apply).   |
| **Integration** | One toolbar: autofill actions + Save; unsaved dot after edits or Apply; draft debounce; `npm run build` / `npm run lint` clean.                                                   |

---

## 2. Phase A — Shared foundations

**Purpose:** Everything the grid, autofill, and persistence agree on.

| Step | Task                                          | Notes                                                                                                                                                             |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A.1  | **`ForecastGridRow` enrichment** (`types.ts`) | Add `scopeEndDate`, `scopeStartDate`, `scopeStatus`, `plannedHrs`, `maxDailyHours` / `maxWeeklyHours` per AUTOFILL_PLAN §4.5.                                     |
| A.2  | **Build rows in `ForecastTab`**               | Map programme tree → one row per `(scope, engineer)` with stable `` `${scopeId}-${engineerId}` `` row ids; dedupe; sort if needed for display.                    |
| A.3  | **Engineer caps**                             | Prefer `engineer_pool.max_daily_hours` / `max_weekly_hours` when the project load exposes them; else `DEFAULT_*` from `@/types/engineer-pool` (document in code). |
| A.4  | **`CellValues` / `PendingFill`**              | Centralise in `forecastGridTypes.ts` (or `types.ts`) so `useAutofill`, `useCellStore`, and draft/save share one shape.                                            |

**Exit:** Grid rows carry all metadata the autofill algorithm needs; row ids stable across filters.

---

## 3. Phase B — Autofill core (pure)

**Purpose:** Testable distribution without React.

| Step | Task                           | Notes                                                                                                                                                                         |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B.1  | **`forecastAutofillUtils.ts`** | Implement `autofill(input): AutofillOutput`, week keys (ISO Monday), eligibility (weekend, BH, scope start, completed scope, null planned, row allowance, daily/weekly caps). |
| B.2  | **Row ordering**               | Sort by `scopeEndDate` asc, nulls last, tie-break `scope.id` (§5.4).                                                                                                          |
| B.3  | **Front-load loop**            | Integer hours only; seed running totals from `currentValues` + `allRowIds` (§5.3).                                                                                            |
| B.4  | **Selection**                  | Build `targetCells` from `SelRange` + `dateColFields`; empty selection → warning, no changes.                                                                                 |
| B.5  | **Unit tests**                 | `forecastAutofillUtils.test.ts` — cover AUTOFILL_PLAN §11 checklist.                                                                                                          |

**Exit:** `autofill()` runs headless with no grid; tests green.

---

## 4. Phase C — Autofill UX

**Purpose:** Preview, Apply, Discard, and grid wiring.

| Step | Task                                | Notes                                                                                                                                                                                |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C.1  | **`useAutofill.ts`**                | `pendingValuesRef`, `pendingFill`, `triggerAutofill` (all \| selection), `approveFill` / `discardFill`; merge into `cellValuesRef` + `setCellValue` + single `pushHistory` on Apply. |
| C.2  | **`ForecastAgGrid.tsx`**            | Merge pending → `rowData`; pass `pendingSet` into column defs.                                                                                                                       |
| C.3  | **`forecastColumnDefs.ts`**         | Ghost cell style when `(rowId, field)` in pending set.                                                                                                                               |
| C.4  | **Toolbar + confirmation bar**      | Autofill (all) / (selection); disable rules §9.1; bar copy §9.2; “nothing to fill” §9.3.                                                                                             |
| C.5  | **`useGridKeyboard.ts` (optional)** | Escape → discard preview; coordinate with undo §9.5.                                                                                                                                 |

**Exit:** Full autofill UX without Supabase; Apply updates committed store and history.

---

## 5. Phase D — Persistence backend

**Purpose:** Database and repository boundary.

| Step | Task                                                           | Notes                                                                                                                |
| ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| D.1  | **Migration** `supabase/migrations/…_add_forecast_entries.sql` | Table, unique `(project_id, scope_id, engineer_id, date)`, RLS policies matching other tables.                       |
| D.2  | **`src/types/forecast-entry.ts`**                              | `ForecastEntry`, `ForecastEntryDbRow`.                                                                               |
| D.3  | **`src/lib/forecast/forecastDb.ts`**                           | `loadForecastEntries` → `{ rowId, CellValues }` shape; `saveForecastEntries` upsert + delete diff for cleared cells. |
| D.4  | **Apply migration**                                            | Local: `db reset` / push per team workflow; never rewrite old migrations.                                            |

**Exit:** Can load/save from a script or temporary server action with valid Supabase client.

---

## 6. Phase E — Persistence client

**Purpose:** Draft, conflict, Save, unsaved state.

| Step | Task                   | Notes                                                                                                                  |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| E.1  | **`forecastDraft.ts`** | `loadDraft` / `saveDraft` (debounced 300ms) / `clearDraft`; key `forecast_draft_${projectId}`.                         |
| E.2  | **`useCellStore`**     | Expose `onChange` (or equivalent) for **committed** changes only — fires after autofill Apply when cell store updates. |
| E.3  | **`ForecastTab` load** | Skeleton while fetching; map DB → `cellValuesRef`; then draft vs server conflict flow §2 of persistence.               |
| E.4  | **Conflict banner**    | Restore draft vs use saved; dismiss once chosen.                                                                       |
| E.5  | **Save button**        | Spinner, disabled while saving; `saveForecastEntries`; on success clear draft + clear unsaved.                         |
| E.6  | **Unsaved indicator**  | Amber dot on Save; **not** on preview-only autofill.                                                                   |

**Exit:** Reload restores from DB or draft; manual Save persists; draft clears on success.

---

## 7. Phase F — Integration & polish

| Step | Task                  | Notes                                                                                                           |
| ---- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| F.1  | **Toolbar layout**    | Single strip: filters + autofill + **Save** (persistence spec §4).                                              |
| F.2  | **Preview + Save**    | Document in code: Save serializes `cellValuesRef` only — preview excluded until Apply.                          |
| F.3  | **Filters hide rows** | Apply still merges by `rowId` (AUTOFILL_PLAN §9.4).                                                             |
| F.4  | **Verification**      | `npm run build`, `npm run lint`, run unit tests for autofill; manual smoke on conflict + save + autofill Apply. |

---

## 8. Suggested sequencing & branches

| Order         | Rationale                                                                   |
| ------------- | --------------------------------------------------------------------------- |
| **A → B → C** | Autofill can ship as a feature branch without DB.                           |
| **A → D → E** | Persistence can ship in parallel once A defines `CellValues` + row ids.     |
| **F last**    | Merges both tracks; resolves toolbar and any duplicate `ForecastTab` edits. |

If one developer: **A → B → C → D → E → F**. If two: **Developer 1:** A → B → C; **Developer 2:** A (shared) → D → E; then **F** together.

---

## 9. Explicitly deferred

See AUTOFILL_PLAN §12–13 and persistence spec §6: annual leave, scope-end clipping, half-day holidays, multi-PM sync, autosave to Supabase, autofill across projects.

---

## 10. Verification checklist (release)

- [ ] `forecastAutofillUtils.test.ts` — critical cases from §11 pass
- [ ] Manual: conflict banner → restore / use saved
- [ ] Manual: edit → draft survives refresh (same browser)
- [ ] Manual: Save → reload → data matches
- [ ] Manual: autofill preview → Save does not persist preview; Apply → Save persists
- [ ] `npm run build` && `npm run lint`
