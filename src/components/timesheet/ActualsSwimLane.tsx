"use client";

import type { EngineerPoolEntry } from "@/types/engineer-pool";

// Data visualization colours — these are chart/avatar colours, not semantic UI tokens.
const ENG_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export function engineerColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ENG_COLORS[h % ENG_COLORS.length];
}

export function engineerInitials(engineerId: string, pool: EngineerPoolEntry[]): string {
  const eng = pool.find((e) => e.id === engineerId);
  if (!eng) return "??";
  if (eng.firstName && eng.lastName) return (eng.firstName[0] + eng.lastName[0]).toUpperCase();
  return eng.code.slice(0, 2).toUpperCase();
}

export function engineerDisplayName(engineerId: string, pool: EngineerPoolEntry[]): string {
  const eng = pool.find((e) => e.id === engineerId);
  if (!eng) return "Unknown";
  if (eng.firstName && eng.lastName) return `${eng.firstName} ${eng.lastName}`;
  return eng.code;
}

// ---------------------------------------------------------------------------
// Bar
// ---------------------------------------------------------------------------

interface BarProps {
  actualHours: number;
  budgetHours: number | null;
  forecastHours: number | null;
  isOver: boolean;
}

function SwimLaneBar({ actualHours, budgetHours, forecastHours, isOver }: BarProps) {
  const max = Math.max(budgetHours ?? 0, actualHours, forecastHours ?? 0);
  const scale = max > 0 ? max * 1.2 : 1;

  const actualPct = Math.min((actualHours / scale) * 100, 100);
  const forecastPct = forecastHours !== null ? Math.min((forecastHours / scale) * 100, 100) : null;
  const budgetPct = budgetHours !== null ? (budgetHours / scale) * 100 : null;

  return (
    <div className="relative h-4 overflow-visible rounded" style={{ background: "var(--muted)" }}>
      {/* Forecast fill — behind actuals */}
      {forecastPct !== null && forecastPct > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: `${forecastPct}%`, background: "var(--status-info-bg)" }}
        />
      )}

      {/* Actuals fill */}
      {actualHours > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{
            width: `${actualPct}%`,
            background: isOver ? "var(--status-critical)" : "#475569",
          }}
        />
      )}

      {/* Budget checkpoint — primary visual anchor */}
      {budgetPct !== null && (
        <div
          style={{
            position: "absolute",
            left: `${budgetPct}%`,
            top: "-6px",
            width: "3px",
            height: "calc(100% + 12px)",
            background: "var(--foreground)",
            borderRadius: "2px",
            zIndex: 5,
            transform: "translateX(-1.5px)",
          }}
        >
          {/* Dot at top */}
          <div
            style={{
              position: "absolute",
              top: "-1px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "9px",
              height: "9px",
              background: "var(--foreground)",
              borderRadius: "50%",
            }}
          />
          {/* Budget label */}
          <div
            className="border-border bg-card text-foreground"
            style={{
              position: "absolute",
              top: "-20px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "9px",
              fontWeight: 700,
              whiteSpace: "nowrap",
              padding: "1px 4px",
              borderRadius: "3px",
              border: "1px solid",
            }}
          >
            {budgetHours}h
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill
// ---------------------------------------------------------------------------

interface PillProps {
  initials: string;
  color: string;
  actualHours: number;
  /** plannedHrs from allocation, or forecastHours — whichever is most meaningful */
  comparedHours: number | null;
}

function EngineerPill({ initials, color, actualHours, comparedHours }: PillProps) {
  return (
    <div className="border-border flex items-center gap-1 rounded-full border bg-transparent py-0.5 pr-2 pl-0.5 text-xs">
      <div
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: color, fontSize: "8px", fontWeight: 800 }}
      >
        {initials}
      </div>
      <span className="text-foreground font-semibold">{actualHours}h</span>
      {comparedHours !== null && <span className="text-muted-foreground">/{comparedHours}h</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lane
// ---------------------------------------------------------------------------

export interface SwimLanePill {
  engineerId: string;
  actualHours: number;
  comparedHours: number | null;
}

export interface SwimLaneProps {
  name: string;
  subLabel: string;
  actualHours: number;
  budgetHours: number | null;
  forecastHours: number | null;
  delta: number | null;
  pills: SwimLanePill[];
  engineerPool: EngineerPoolEntry[];
  isEven: boolean;
}

export function ActualsSwimLane({
  name,
  subLabel,
  actualHours,
  budgetHours,
  forecastHours,
  delta,
  pills,
  engineerPool,
  isEven,
}: SwimLaneProps) {
  const isOver = delta !== null && delta > 0;
  const isWarn = delta !== null && delta <= 0 && delta > -(budgetHours ?? 0) * 0.15;

  const deltaBadge =
    delta === null ? null : delta > 0 ? (
      <span className="bg-status-critical-bg text-status-critical min-w-[76px] rounded-md px-2.5 py-1 text-center text-xs font-bold whitespace-nowrap">
        +{delta}h over
      </span>
    ) : isWarn ? (
      <span className="bg-status-warning-bg text-status-warning min-w-[76px] rounded-md px-2.5 py-1 text-center text-xs font-bold whitespace-nowrap">
        {Math.abs(delta)}h left
      </span>
    ) : (
      <span className="bg-status-healthy-bg text-status-healthy min-w-[76px] rounded-md px-2.5 py-1 text-center text-xs font-bold whitespace-nowrap">
        −{Math.abs(delta)}h left
      </span>
    );

  return (
    <div
      className="border-border grid items-start gap-3 border-b px-4 py-3 last:border-0"
      style={{
        gridTemplateColumns: "180px 1fr auto",
        background: isEven ? "var(--card)" : "hsl(var(--muted) / 0.3)",
      }}
    >
      {/* Name column */}
      <div className="pt-0.5">
        <div className="text-foreground text-xs leading-tight font-semibold">{name}</div>
        <div className="text-muted-foreground mt-1 text-[10px]">{subLabel}</div>
      </div>

      {/* Bar + pills */}
      <div className="pt-1.5">
        <SwimLaneBar
          actualHours={actualHours}
          budgetHours={budgetHours}
          forecastHours={forecastHours}
          isOver={isOver}
        />
        {pills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pills.map((p) => (
              <EngineerPill
                key={p.engineerId}
                initials={engineerInitials(p.engineerId, engineerPool)}
                color={engineerColor(p.engineerId)}
                actualHours={p.actualHours}
                comparedHours={p.comparedHours}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delta badge */}
      <div className="flex items-start pt-0.5">{deltaBadge}</div>
    </div>
  );
}
