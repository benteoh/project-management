// src/components/programme/csvParser.ts
import type { ActivityStatus } from "@/types/programme-node";

export type ParsedRowType = "skip" | "scope" | "task" | "subtask" | "activity";

export interface ParsedRow {
  rowType: ParsedRowType;
  name: string;
  activityId?: string;
  /** Normalised "dd-Mon-yy". Undefined when cell is empty or unparseable. */
  start?: string;
  finish?: string;
  status?: ActivityStatus;
  /** Original value when start could not be parsed (for warnings). */
  startRaw?: string;
  finishRaw?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const VALID_STATUSES = new Set<string>(["Not Started", "In Progress", "Completed"]);
const REQUIRED_COLUMNS = [
  "Activity ID",
  "Activity Name",
  "Start",
  "Finish",
  "Activity Status",
] as const;

function parseDate(raw: string): string | undefined {
  if (!raw.trim()) return undefined;

  // "01-Sep-25 16:00 A" → "01-Sep-25"
  const monMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
  if (monMatch) {
    return `${monMatch[1].padStart(2, "0")}-${monMatch[2]}-${monMatch[3]}`;
  }

  // "12/05/2025 9:00" → "12-May-25"
  const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = MONTHS[parseInt(dmyMatch[2], 10) - 1];
    const year = dmyMatch[3].slice(2);
    if (!month) return undefined;
    return `${day}-${month}-${year}`;
  }

  return undefined;
}

function parseStatus(raw: string): ActivityStatus | undefined {
  const s = raw.trim();
  return VALID_STATUSES.has(s) ? (s as ActivityStatus) : undefined;
}

function detectRowType(activityId: string, name: string): ParsedRowType {
  if (activityId.trim()) return "activity";
  const t = name.trim();
  // Order matters: subtask (\d+.\d+.\d+) must be checked before task (\d+.\d+)
  if (/^\d+\.\d+\.\d+/.test(t)) return "subtask";
  if (/^\d+\.\d+/.test(t)) return "task";
  if (/^\d+\.\s+/.test(t)) return "scope";
  return "skip";
}

export function parseCsv(csvString: string): ParsedRow[] {
  const lines = csvString.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new Error("File is empty");

  const headers = lines[0].split("\t");
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(", ")}`);

  const idx = {
    id: headers.indexOf("Activity ID"),
    name: headers.indexOf("Activity Name"),
    start: headers.indexOf("Start"),
    finish: headers.indexOf("Finish"),
    status: headers.indexOf("Activity Status"),
  };

  return lines.slice(1).map((line): ParsedRow => {
    const cols = line.split("\t");
    const activityId = cols[idx.id]?.trim() ?? "";
    const name = cols[idx.name]?.trim() ?? "";
    const startRaw = cols[idx.start]?.trim() ?? "";
    const finishRaw = cols[idx.finish]?.trim() ?? "";
    const statusRaw = cols[idx.status]?.trim() ?? "";

    const rowType = detectRowType(activityId, name);
    const start = parseDate(startRaw);
    const finish = parseDate(finishRaw);
    const status = parseStatus(statusRaw);

    return {
      rowType,
      name,
      ...(activityId ? { activityId } : {}),
      ...(start !== undefined ? { start } : {}),
      ...(finish !== undefined ? { finish } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(start === undefined && startRaw ? { startRaw } : {}),
      ...(finish === undefined && finishRaw ? { finishRaw } : {}),
    };
  });
}
