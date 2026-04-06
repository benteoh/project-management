"use client";

import type { SheetData } from "./types";

export function TimesheetTable({ sheet }: { sheet: SheetData }) {
  const hoursIdx = sheet.headers.findIndex((h) => h.trim().toLowerCase() === "hours");
  return (
    <table className="border-border w-max border-collapse text-sm">
      <thead className="bg-card sticky top-0 z-10">
        <tr>
          <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right text-xs font-medium tracking-wide whitespace-nowrap uppercase select-none">
            No.
          </th>
          <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase">
            Alert
          </th>
          <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase">
            Details
          </th>
          {sheet.headers.map((h, i) => (
            <th
              key={i}
              className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase"
            >
              {h || <span className="text-muted-foreground/40">—</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, ri) => {
          const hoursVal = hoursIdx >= 0 ? parseFloat(row[hoursIdx] ?? "") : NaN;
          const exceeded = !isNaN(hoursVal) && hoursVal > 8;
          return (
            <tr key={ri} className="hover:bg-background">
              <td className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right whitespace-nowrap tabular-nums select-none">
                {ri + 1}
              </td>
              <td className="border-border text-status-critical border-r border-b px-4 py-2 font-medium whitespace-nowrap">
                {exceeded ? "1" : ""}
              </td>
              <td className="border-border text-muted-foreground border-r border-b px-4 py-2 whitespace-nowrap">
                {exceeded ? "Hours exceed 8" : ""}
              </td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-border text-foreground border-r border-b px-4 py-2 whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
