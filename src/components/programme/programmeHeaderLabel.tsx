import type { ReactNode } from "react";

/**
 * Long uppercase header labels: split on a word boundary into two balanced lines.
 * Short labels render on one line.
 */
export function renderProgrammeHeaderLabel(label: string): ReactNode {
  if (label.length <= 10) return <span>{label}</span>;

  const words = label.split(" ");
  if (words.length < 2) return <span className="break-all">{label}</span>;

  let splitIndex = 1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(" ").length;
    const right = words.slice(i).join(" ").length;
    const delta = Math.abs(left - right);
    if (delta < bestDelta) {
      bestDelta = delta;
      splitIndex = i;
    }
  }

  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{words.slice(0, splitIndex).join(" ")}</span>
      <span>{words.slice(splitIndex).join(" ")}</span>
    </span>
  );
}
