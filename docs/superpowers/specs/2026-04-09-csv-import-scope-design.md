# CSV Import for Programme Scopes — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

---

## Overview

Allow PMs to import a Primavera P6 CSV export to set up a new programme tree or update existing activity-level data. The import merges into the existing tree rather than replacing it, preserving engineer allocations and manual edits.

---

## UI & Flow

An **Import CSV** button sits in the Programme tab toolbar alongside existing actions.

Clicking opens a modal with two steps:

1. **Upload step** — file input (`.csv` only). On file selection, the CSV is parsed immediately in the browser (no server round-trip).
2. **Preview step** — modal transitions to a diff summary:
   - "X activities updated" — collapsible list of Activity ID + name + what changed
   - "Y activities added" — ID + name + which scope they land under
   - "Z scopes/tasks created" — names of new structural nodes
   - Warnings for any rows with unrecognised date formats or missing parent context
   - "No changes detected" state with disabled confirm button if CSV produces no diff
3. **Confirm / Cancel** — Confirm merges changes into the in-memory tree and triggers the existing save flow. Cancel discards. The operation is undoable via the existing undo stack.

---

## CSV Format

Source: Primavera P6 export (tab-separated CSV).

**Columns used:**

| CSV column        | Programme node field |
| ----------------- | -------------------- |
| `Activity ID`     | `activityId`         |
| `Activity Name`   | `name`               |
| `Start`           | `start`              |
| `Finish`          | `finish`             |
| `Activity Status` | `status`             |

All other columns are ignored.

**Date normalisation** — two formats appear in P6 exports:

- `12/05/2025 9:00` → parsed as DD/MM/YYYY
- `01-Sep-25 16:00 A` → parsed as DD-Mon-YY (trailing ` A` stripped)

Both are normalised to `dd-Mon-yy` (e.g. `12-May-25`) to match the existing programme node format.

**Activity Status** values map directly to the `status` enum: `"Completed"`, `"In Progress"`, `"Not Started"`, `""`.

---

## Hierarchy Detection

Rows are read top-to-bottom. Node type is inferred from the `Activity ID` cell and the name pattern:

| Row shape                                   | Node type      | Rule                           |
| ------------------------------------------- | -------------- | ------------------------------ |
| No Activity ID, no number prefix            | Project header | Skip                           |
| No Activity ID, name matches `^\d+\.\s`     | Scope          | e.g. `"1. GMA Scoping..."`     |
| No Activity ID, name matches `^\s*\d+\.\d+` | Task / Subtask | e.g. `"1.1 Phase 2 report..."` |
| Has Activity ID                             | Activity       | Activity ID cell non-empty     |

A "current parent" stack is maintained as rows are processed:

```
"1. GMA Scoping..."          → push as current Scope
A1000                        → child of current Scope
"1.1 Phase 2 report..."      → push as current Task (child of current Scope)
A1070                        → child of current Task
"2. Building Impact..."      → pop to root, push as new Scope
```

A scope-level row always resets the parent stack to root before pushing itself. A task/subtask row is always pushed as a child of the most recent scope.

---

## Merge Logic

### Scope / Task / Subtask rows (no Activity ID)

Matched by name. When found, `start` and `finish` are updated. Name is never updated (it is the match key). Engineer allocations and hours are untouched.

- **Scope rows** — matched against existing tree by full name including prefix (e.g. `"1. GMA Scoping / Assumptions and CGMM"`).
- **Task/subtask rows** — number prefix is stripped before matching (e.g. `"1.1 Phase 2 report..."` → match against `"Phase 2 report..."`).

Match outcomes:

- **Found** → update `start` and `finish`; use as current parent context.
- **Not found** → create new node. Scopes stored with prefix; tasks/subtasks stored without prefix.

### Activity rows (has Activity ID)

- **Activity ID found** in existing tree → update `name`, `start`, `finish`, `status` only. Parent position, `totalHours`, `forecastTotalHours`, and engineer allocations are untouched.
- **Activity ID not found** → create new activity under the current parent.

### Re-parenting

If an activity's Activity ID exists in the tree but is now under a different scope in the CSV, its fields are updated but it is **not re-parented**. Re-parenting is a manual operation in the app.

---

## Error Handling

**Blocking errors** (shown before preview, import cannot proceed):

- No `.csv` file selected.
- File is missing required column headers (`Activity ID`, `Activity Name`, `Start`, `Finish`, `Activity Status`).

**Warnings** (shown in preview, import can still proceed):

- Row has Activity ID but unparseable date — those date fields are skipped, rest of row imports.
- Row has Activity ID but no parent scope/task identified — activity is added at root level.

---

## Files

All co-located in `src/components/programme/`:

| File                 | Responsibility                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `csvParser.ts`       | Pure function: CSV string → typed parsed rows. No tree knowledge.     |
| `csvMerge.ts`        | Pure function: parsed rows + existing tree → `{ updatedTree, diff }`. |
| `CsvImportModal.tsx` | Modal UI: file upload → preview → confirm/cancel.                     |
| `ProgrammeTab.tsx`   | Add Import button, wire modal, apply diff to tree on confirm.         |

`csvParser.ts` and `csvMerge.ts` are pure functions with no React — unit-testable in isolation.
