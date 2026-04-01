import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** Filled funnel for column filters (inherits `currentColor` from parent). */
export function FilterFunnelIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="currentColor"
      className={cn("size-3 shrink-0", className)}
      aria-hidden
      {...props}
    >
      <path d="M1 2h10L7 6.5V11L5 10V6.5L1 2z" />
    </svg>
  );
}
