"use client";

import type { ActivityStateSummary } from "@/lib/programme/activityStateSummary";

export type ActivityFilterKey = "upcoming" | "inProgress" | "warning" | "late";

const FILTER_CARDS: {
  key: ActivityFilterKey;
  label: string;
  title: string;
  tone: "neutral" | "info" | "warning" | "critical";
}[] = [
  {
    key: "upcoming",
    label: "Upcoming",
    title: "Not started, with a start date within the next 5 days",
    tone: "neutral",
  },
  { key: "inProgress", label: "In Progress", title: "Activities in progress", tone: "info" },
  {
    key: "warning",
    label: "Warning",
    title: "Near end of window or high elapsed duration vs schedule",
    tone: "warning",
  },
  {
    key: "late",
    label: "Late",
    title: "Past finish date and not completed",
    tone: "critical",
  },
];

function Stat({
  label,
  title,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  title: string;
  value: number;
  tone: "neutral" | "info" | "warning" | "critical";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "critical"
      ? "text-status-critical"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "info"
          ? "text-status-info"
          : "text-foreground";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-left transition-colors ${
        active ? "bg-foreground/10 ring-foreground/20 ring-1" : "bg-muted/40 hover:bg-muted/70"
      }`}
    >
      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </button>
  );
}

export function ProjectActivityStateWidget({
  summary,
  activeFilter,
  onSelectFilter,
}: {
  summary: ActivityStateSummary;
  activeFilter: ActivityFilterKey | null;
  onSelectFilter: (filter: ActivityFilterKey) => void;
}) {
  const counts: Record<ActivityFilterKey, number> = {
    upcoming: summary.upcoming,
    inProgress: summary.inProgress,
    warning: summary.warning,
    late: summary.late,
  };

  return (
    <div className="border-border bg-card shadow-card rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Activities
      </p>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {FILTER_CARDS.map((card) => (
          <Stat
            key={card.key}
            label={card.label}
            title={card.title}
            value={counts[card.key]}
            tone={card.tone}
            active={activeFilter === card.key}
            onClick={() => onSelectFilter(card.key)}
          />
        ))}
      </div>
    </div>
  );
}
