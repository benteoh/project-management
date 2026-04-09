import type { ProgrammeNode } from "@/components/programme/types";

import { rollupStatusInTree } from "./statusRollup";
import { rollupTotalHoursInTree } from "./totalHoursRollup";

/** Total hours first, then status (both are bottom-up; order between them does not matter). */
export function applyProgrammeRollups(nodes: ProgrammeNode[]): ProgrammeNode[] {
  return rollupStatusInTree(rollupTotalHoursInTree(nodes));
}
