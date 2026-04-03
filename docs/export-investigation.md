# Export Investigation: CSV & XLSX for Programme and Demand Forecast

## What We're Exporting

Two data types, both available via the existing server-side data load:

| Export              | Source data                                                         | Primary use                                           |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| **Programme WBS**   | `ProgrammeNode[]` tree (programme_nodes + scope_engineers)          | Hand off scope breakdown to client or share with team |
| **Demand Forecast** | `scope_engineers` (planned_hrs / forecast_hrs per scope × engineer) | PM planning, comparing allocation against budget      |

> Note: The per-day hour grid in the Forecast tab currently has no DB backing — cells are empty. The allocation data that _is_ stored is `planned_hrs` and `forecast_hrs` on `scope_engineers`, which is what the forecast export uses.

---

## Approach Comparison

### Approach 1 — Manual CSV + SheetJS (xlsx)

**CSV**: Build the string manually — join columns with commas, quote cells that contain commas/newlines. No library needed.

**XLSX**: SheetJS community edition (`xlsx` package, ~1 MB).

| Feature             | Support                                               |
| ------------------- | ----------------------------------------------------- |
| Merged cells        | ✅ via `ws['!merges']`                                |
| Column widths       | ✅ via `ws['!cols']`                                  |
| Bold / cell colours | ❌ Community edition only — requires paid Pro licence |
| Frozen header rows  | ✅                                                    |

**Pros**: Single package for both CSV and XLSX, very widely used, small API surface.  
**Cons**: No cell styling without Pro. Headers would look identical to data rows.

---

### Approach 2 — Manual CSV + ExcelJS ✅ Recommended

**CSV**: Same manual approach — no library.

**XLSX**: ExcelJS (`exceljs` package, ~500 KB, fully open-source).

| Feature             | Support                                |
| ------------------- | -------------------------------------- |
| Merged cells        | ✅ `ws.mergeCells(r1, c1, r2, c2)`     |
| Column widths       | ✅ `ws.columns = [{ width: 40 }, ...]` |
| Bold / cell colours | ✅ `cell.font`, `cell.fill`            |
| Frozen header rows  | ✅ `ws.views`                          |

**Pros**: Full formatting for free. Bold scope rows, gold title bar, frozen headers — matches the DSP design system.  
**Cons**: Slightly more verbose API than SheetJS.

**Decision**: ExcelJS. The design system has specific tokens (gold `#E4A824`, muted headers, etc.) that we want reflected in the exported file. SheetJS can't do this without Pro.

---

## Proposed File Layout

```
src/
├── lib/
│   └── export/
│       ├── programmeExport.ts    # toProgrammeCsv(), toProgrammeXlsx()
│       └── forecastExport.ts     # toForecastCsv(), toForecastXlsx()
└── app/
    └── api/
        └── export/
            └── route.ts          # GET /api/export?projectId=X&format=csv|xlsx&type=programme|forecast
```

No new UI components needed yet — exports are triggered by direct URL or a simple download button added to the existing tab headers.

---

## Export Formats

### Programme WBS

**CSV columns**:

```
Level, Type, Name, Activity ID, Total Hours, Forecast Hours, Start Date, End Date, Status
1, scope, Network Rail Boiler Room, , 500, , 2026-01-01, 2026-06-30,
1.1, task, Removal of infill panels, , 100, , 2026-01-01, 2026-03-31, In Progress
1.1.1, subtask, Site inspection, , 20, , 2026-01-01, 2026-01-15, Completed
```

Level numbers are dotted (`1`, `1.1`, `1.1.2`) — mirrors the visual hierarchy in the Programme tab.

**XLSX layout**:

- Row 1: `{Project Name}  ·  {Client}  ·  Fixed Fee: £{fixedFee}` — merged across all columns, gold background (`#E4A824`), bold
- Row 2: Column headers — bold, light grey background, frozen
- Scope rows: bold + light grey tint to distinguish from tasks/activities

**Merged cells used**: Project title row (row 1) merged across all 9 columns.

---

### Demand Forecast

**CSV columns**:

```
Scope, Engineer Code, Engineer Name, Planned Hours, Forecast Hours
Network Rail Boiler Room, JB, Joe Bloggs, 40, 45
Network Rail Boiler Room, MW, Meryl Williams, 30, 35
Endwalls Design, JB, Joe Bloggs, 80, 90
```

**XLSX layout**:

- Row 1: `DEMAND FORECAST: {Project Name}` — merged across all columns, gold background
- Row 2: Column headers — bold, frozen
- Scope column: merged across all engineer rows within that scope (e.g. if "Network Rail Boiler Room" has 3 engineers, the scope cell spans 3 rows)

**Merged cells used**: Scope name column merged per scope group — this is the primary demonstration of ExcelJS's merge capability.

---

## API Route

```
GET /api/export?projectId=X&format=csv&type=programme
GET /api/export?projectId=X&format=xlsx&type=programme
GET /api/export?projectId=X&format=csv&type=forecast
GET /api/export?projectId=X&format=xlsx&type=forecast
```

Response headers set `Content-Disposition: attachment; filename="{project_slug}_{type}.{ext}"` so the browser triggers a file download.

Data is fetched server-side (reuses `loadProjectById` + `loadProgrammeFromDb` — the same functions used by the project page). No new DB queries needed.

---

## Out of Scope (for now)

- Per-day hour grid export (no DB data exists yet for this)
- Budget Tracker export (feature not built yet)
- Authentication/authorisation on the export route (follow existing pattern when auth is added)
- Trigger UI (button in tab header) — can be added as a follow-up once the route is confirmed working
