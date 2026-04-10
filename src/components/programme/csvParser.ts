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

/** RFC 4180-style: commas split fields; doubled quotes escape; quoted fields may contain commas. */
function splitCommaCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  let field = "";
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      out.push(field);
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  out.push(field);
  return out.map((s) => s.trimEnd().replace(/\r$/, ""));
}

function headersHaveRequired(headers: string[]): boolean {
  return REQUIRED_COLUMNS.every((c) => headers.includes(c));
}

function detectDelimiterAndHeaders(headerLine: string): {
  delimiter: "\t" | ",";
  headers: string[];
} {
  const tabHeaders = headerLine.split("\t").map((h) => h.trim());
  if (headersHaveRequired(tabHeaders)) {
    return { delimiter: "\t", headers: tabHeaders };
  }
  const commaHeaders = splitCommaCsvLine(headerLine).map((h) => h.trim());
  if (headersHaveRequired(commaHeaders)) {
    return { delimiter: ",", headers: commaHeaders };
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !commaHeaders.includes(c));
  throw new Error(`Missing required columns: ${missing.join(", ")}`);
}

function splitDataLine(line: string, delimiter: "\t" | ","): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((c) => c.trimEnd().replace(/\r$/, ""));
  }
  return splitCommaCsvLine(line);
}

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

/**
 * WBS / summary rows from Primavera often put the full label in **Activity ID** with **Activity Name**
 * empty. Classify structure from either column before treating Activity ID as an activity code.
 * Order: subtask (1.2.3) before task (1.2) before scope (1. ).
 */
function classifyStructural(text: string): ParsedRowType | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+\.\d+\.\d+/.test(t)) return "subtask";
  if (/^\d+\.\d+/.test(t)) return "task";
  if (/^\d+\.\s+/.test(t)) return "scope";
  return null;
}

/**
 * P6 sometimes omits WBS numbers on summary rows (e.g. "AIP (Agreement in Principle)").
 * Must run after numbered structural checks; must not match activity codes or EPS-style titles.
 */
function classifyUnnumberedScope(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 120) return false;
  if (classifyStructural(t)) return false;
  if (looksLikeActivityCode(t)) return false;
  // Short token + parenthetical (e.g. "AIP (Agreement in Principle)"); not "Phase 2 (…)" task titles
  return /^[A-Za-z]{2,6}\s*\([^)]+\)/.test(t);
}

/**
 * True when Activity ID looks like a P6 activity code (e.g. A1000), not a WBS title or EPS name.
 * Must contain a digit; prose titles without digits are rejected.
 */
function looksLikeActivityCode(activityId: string): boolean {
  const t = activityId.trim();
  if (t.length < 2 || t.length > 32) return false;
  if (/\s/.test(t)) return false;
  if (!/\d/.test(t)) return false;
  if (/^[A-Za-z]{1,4}\d{1,6}$/.test(t)) return true;
  if (/^\d{4,}$/.test(t)) return true;
  if (/^[A-Za-z0-9][A-Za-z0-9_-]{0,30}$/.test(t)) return true;
  return false;
}

function detectRowType(activityId: string, name: string): ParsedRowType {
  const id = activityId.trim();
  const nm = name.trim();
  const structural = classifyStructural(id) ?? classifyStructural(nm);
  if (structural) return structural;
  if (classifyUnnumberedScope(id) || classifyUnnumberedScope(nm)) return "scope";
  if (id && looksLikeActivityCode(id)) return "activity";
  return "skip";
}

export function parseCsv(csvString: string): ParsedRow[] {
  const lines = csvString.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new Error("File is empty");

  const { delimiter, headers } = detectDelimiterAndHeaders(lines[0]);

  const idx = {
    id: headers.indexOf("Activity ID"),
    name: headers.indexOf("Activity Name"),
    start: headers.indexOf("Start"),
    finish: headers.indexOf("Finish"),
    status: headers.indexOf("Activity Status"),
  };

  return lines.slice(1).map((line): ParsedRow => {
    const cols = splitDataLine(line, delimiter);
    const activityId = cols[idx.id]?.trim() ?? "";
    const nameCol = cols[idx.name]?.trim() ?? "";
    const startRaw = cols[idx.start]?.trim() ?? "";
    const finishRaw = cols[idx.finish]?.trim() ?? "";
    const statusRaw = cols[idx.status]?.trim() ?? "";

    const rowType = detectRowType(activityId, nameCol);
    /** Structural / skip rows may carry the WBS label in Activity ID when Activity Name is empty (P6). */
    const name = rowType === "activity" ? nameCol : nameCol || activityId;
    const start = parseDate(startRaw);
    const finish = parseDate(finishRaw);
    const status = parseStatus(statusRaw);

    return {
      rowType,
      name,
      ...(rowType === "activity" && activityId ? { activityId } : {}),
      ...(start !== undefined ? { start } : {}),
      ...(finish !== undefined ? { finish } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(start === undefined && startRaw ? { startRaw } : {}),
      ...(finish === undefined && finishRaw ? { finishRaw } : {}),
    };
  });
}
