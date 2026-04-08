"use client";

import type { ICellRendererParams } from "ag-grid-community";

import type { RowData } from "./forecastGridTypes";

export function NoColumnRenderer(params: ICellRendererParams<RowData>) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
      <span className="text-muted-foreground text-xs">{params.value}</span>
    </div>
  );
}
