"use client";

import { useEffect, useState } from "react";

import { getCvrTableAction } from "@/app/[office]/project/[id]/actions";
import { cn, formatCurrency } from "@/lib/utils";
import type { CvrTransposedTable } from "@/lib/budget/cvrScopeTable";

function formatMoneyCell(value: number | null): string {
  if (value === null) return "—";
  return formatCurrency(value);
}

function formatMonthHeading(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return ym;
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

/** Expected variance: green when positive, red when negative (design-system status tokens). */
function expectedVarianceCellTone(value: number): string {
  if (value > 0) return "text-status-healthy bg-status-healthy-bg";
  if (value < 0) return "text-status-critical bg-status-critical-bg";
  return "text-foreground";
}

/** Minimum table width so many columns still scroll instead of crushing cells. */
const LABEL_COL_REM = 10;
const SCOPE_COL_REM = 8;
const TOTAL_COL_REM = 7;

/** Label + scope + total columns as % of viewport (must sum to 100). */
const LABEL_COL_PCT = 16;
const TOTAL_COL_PCT = 12;

/** Row-label column: grey-blue surface (status info token). */
function cvrLabelCell(...extra: (string | undefined)[]) {
  return cn(
    "border-border bg-status-info-bg sticky left-0 z-20 box-border border-r border-b px-3 py-3 text-left",
    ...extra
  );
}

/** Data columns: internal grid + alternating stripe by column index. */
function cvrScopeCell(colIndex: number, ...extra: (string | undefined)[]) {
  return cn(
    "border-border box-border border-r border-b px-2 py-3",
    colIndex % 2 === 0 ? "bg-card" : "bg-muted/50",
    ...extra
  );
}

/** Totals column: distinct tint, not part of scope alternation. */
function cvrTotalCell(...extra: (string | undefined)[]) {
  return cn("border-border box-border border-r border-b bg-secondary/40 px-2 py-3", ...extra);
}

/** Calendar "today" in the browser timezone (ISO date). */
function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CvrTab({ projectId }: { projectId: string }) {
  const [table, setTable] = useState<CvrTransposedTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCvrTableAction(projectId, localTodayIso()).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setTable(result.table);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-status-info bg-status-info-bg rounded-md px-2 py-0.5 text-xs font-medium">
            Example chart — full CVR coming soon
          </span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cvr-chart.png"
          alt="Example CVR chart"
          className="max-h-[min(420px,40vh)] max-w-full object-contain"
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Scope cost summary</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Each column is one scope. Planned budget is your main quote plus the extra quote line.
            Spent so far is the total from saved timesheets (costed rows with dates). Upcoming rows
            are forecast work dated after today, by month. Variance is planned budget minus spent so
            far. Expected variance subtracts upcoming forecast too; that row turns green when
            you&apos;re likely to finish under budget, red when over.
          </p>
        </div>

        {error && <p className="text-status-critical text-sm">{error}</p>}

        {loading && !error && (
          <p className="text-muted-foreground text-sm">Loading costs and forecast…</p>
        )}

        {!loading && !error && table && table.scopes.length === 0 && (
          <p className="text-muted-foreground text-sm">No scopes in the programme yet.</p>
        )}

        {!loading && !error && table && table.scopes.length > 0 && (
          <div className="border-border bg-card shadow-card w-full max-w-full min-w-0 overflow-x-auto rounded-lg border">
            <table
              className="border-border w-full min-w-full table-fixed border-collapse border text-sm"
              style={{
                minWidth: `${LABEL_COL_REM + table.scopes.length * SCOPE_COL_REM + TOTAL_COL_REM}rem`,
              }}
            >
              <colgroup>
                <col style={{ width: `${LABEL_COL_PCT}%` }} />
                {table.scopes.map((s) => (
                  <col
                    key={s.id}
                    style={{
                      width: `${(100 - LABEL_COL_PCT - TOTAL_COL_PCT) / table.scopes.length}%`,
                    }}
                  />
                ))}
                <col style={{ width: `${TOTAL_COL_PCT}%` }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    className={cvrLabelCell(
                      "text-muted-foreground text-xs font-medium tracking-wide uppercase"
                    )}
                  >
                    {/* row labels */}
                  </th>
                  {table.scopes.map((s, colIndex) => (
                    <th
                      key={s.id}
                      className={cvrScopeCell(
                        colIndex,
                        "text-muted-foreground text-center text-xs font-medium tracking-wide uppercase"
                      )}
                    >
                      <span
                        className="text-foreground block truncate font-semibold normal-case"
                        title={s.name}
                      >
                        {s.name}
                      </span>
                    </th>
                  ))}
                  <th
                    className={cvrTotalCell(
                      "text-muted-foreground text-right text-xs font-medium tracking-wide uppercase"
                    )}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className={cvrLabelCell(
                      "text-muted-foreground text-xs font-medium tracking-wide uppercase"
                    )}
                  >
                    Quotation
                  </th>
                  {table.scopes.map((s, colIndex) => (
                    <td
                      key={s.id}
                      className={cvrScopeCell(
                        colIndex,
                        "text-foreground text-right whitespace-nowrap tabular-nums"
                      )}
                    >
                      {formatMoneyCell(table.byScopeId[s.id]?.quotation ?? null)}
                    </td>
                  ))}
                  <td
                    className={cvrTotalCell(
                      "text-foreground text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                    )}
                  >
                    {formatMoneyCell(table.totals.quotation)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className={cvrLabelCell(
                      "text-muted-foreground text-xs font-medium tracking-wide uppercase"
                    )}
                  >
                    Quotation EW
                  </th>
                  {table.scopes.map((s, colIndex) => (
                    <td
                      key={s.id}
                      className={cvrScopeCell(
                        colIndex,
                        "text-foreground text-right whitespace-nowrap tabular-nums"
                      )}
                    >
                      {formatMoneyCell(table.byScopeId[s.id]?.quotationEw ?? null)}
                    </td>
                  ))}
                  <td
                    className={cvrTotalCell(
                      "text-foreground text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                    )}
                  >
                    {formatMoneyCell(table.totals.quotationEw)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className={cvrLabelCell(
                      "border-border text-muted-foreground border-b-4 border-double text-xs font-medium tracking-wide uppercase"
                    )}
                  >
                    Approved budget
                  </th>
                  {table.scopes.map((s, colIndex) => (
                    <td
                      key={s.id}
                      className={cvrScopeCell(
                        colIndex,
                        "border-border text-foreground border-b-4 border-double text-right whitespace-nowrap tabular-nums"
                      )}
                    >
                      {formatCurrency(table.byScopeId[s.id]?.approvedBudget ?? 0)}
                    </td>
                  ))}
                  <td
                    className={cvrTotalCell(
                      "border-border text-foreground border-b-4 border-double text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                    )}
                  >
                    {formatCurrency(table.totals.approvedBudget)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className={cvrLabelCell(
                      "border-border text-foreground border-t-2 text-xs font-semibold tracking-wide uppercase"
                    )}
                  >
                    Spent so far
                  </th>
                  {table.scopes.map((s, colIndex) => (
                    <td
                      key={s.id}
                      className={cvrScopeCell(
                        colIndex,
                        "border-border text-foreground border-t-2 text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                      )}
                    >
                      {formatCurrency(table.byScopeId[s.id]?.spentSoFar ?? 0)}
                    </td>
                  ))}
                  <td
                    className={cvrTotalCell(
                      "border-border text-foreground border-t-2 text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                    )}
                  >
                    {formatCurrency(table.totals.spentSoFar)}
                  </td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className={cvrLabelCell(
                      "text-muted-foreground text-xs font-medium tracking-wide uppercase"
                    )}
                  >
                    Variance
                  </th>
                  {table.scopes.map((s, colIndex) => (
                    <td
                      key={s.id}
                      className={cvrScopeCell(
                        colIndex,
                        "text-foreground text-right whitespace-nowrap tabular-nums"
                      )}
                    >
                      {formatCurrency(table.byScopeId[s.id]?.variance ?? 0)}
                    </td>
                  ))}
                  <td
                    className={cvrTotalCell(
                      "text-foreground text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                    )}
                  >
                    {formatCurrency(table.totals.variance)}
                  </td>
                </tr>
                {table.upcomingMonths.length === 0 ? (
                  <tr>
                    <th
                      scope="row"
                      className={cvrLabelCell(
                        "border-border text-muted-foreground border-t-4 border-double text-xs font-medium tracking-wide uppercase"
                      )}
                    >
                      Upcoming (forecast)
                    </th>
                    {table.scopes.map((s, colIndex) => (
                      <td
                        key={s.id}
                        className={cvrScopeCell(
                          colIndex,
                          "border-border text-foreground border-t-4 border-double text-right whitespace-nowrap tabular-nums"
                        )}
                      >
                        {formatCurrency(table.byScopeId[s.id]?.upcomingForecastGbp ?? 0)}
                      </td>
                    ))}
                    <td
                      className={cvrTotalCell(
                        "border-border text-foreground border-t-4 border-double text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                      )}
                    >
                      {formatCurrency(table.totals.upcomingForecast)}
                    </td>
                  </tr>
                ) : (
                  table.upcomingMonths.map((ym, i) => (
                    <tr key={`up-${ym}`}>
                      <th
                        scope="row"
                        className={cvrLabelCell(
                          i === 0
                            ? "border-border text-muted-foreground border-t-4 border-double text-xs font-medium tracking-wide uppercase"
                            : "text-muted-foreground text-xs font-medium tracking-wide uppercase"
                        )}
                      >
                        Upcoming · {formatMonthHeading(ym)}
                      </th>
                      {table.scopes.map((s, colIndex) => (
                        <td
                          key={s.id}
                          className={cvrScopeCell(
                            colIndex,
                            i === 0
                              ? "border-border text-foreground border-t-4 border-double text-right whitespace-nowrap tabular-nums"
                              : "text-foreground text-right whitespace-nowrap tabular-nums"
                          )}
                        >
                          {formatCurrency(table.byScopeId[s.id]?.upcomingMonthly[ym] ?? 0)}
                        </td>
                      ))}
                      <td
                        className={cvrTotalCell(
                          i === 0
                            ? "border-border text-foreground border-t-4 border-double text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                            : "text-foreground text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                        )}
                      >
                        {formatCurrency(table.totals.upcomingMonthly[ym] ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
                <tr>
                  <th
                    scope="row"
                    className={cvrLabelCell(
                      "text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                    )}
                  >
                    Expected variance
                  </th>
                  {table.scopes.map((s, colIndex) => {
                    const ev = table.byScopeId[s.id]?.expectedVariance ?? 0;
                    return (
                      <td
                        key={s.id}
                        className={cvrScopeCell(
                          colIndex,
                          cn(
                            "text-right text-xs font-semibold whitespace-nowrap tabular-nums",
                            expectedVarianceCellTone(ev)
                          )
                        )}
                      >
                        {formatCurrency(ev)}
                      </td>
                    );
                  })}
                  <td
                    className={cvrTotalCell(
                      cn(
                        "text-right text-xs font-semibold whitespace-nowrap tabular-nums",
                        expectedVarianceCellTone(table.totals.expectedVariance)
                      )
                    )}
                  >
                    {formatCurrency(table.totals.expectedVariance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
