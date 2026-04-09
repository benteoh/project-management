import type { CellValues } from "@/components/forecast/forecastGridTypes";

export type ForecastDraftPayload = {
  values: CellValues;
  savedAt: string;
};

function key(projectId: string): string {
  return `forecast_draft_${projectId}`;
}

export function loadDraft(projectId: string): ForecastDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ForecastDraftPayload;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.values ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(projectId: string, values: CellValues): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ForecastDraftPayload = {
      values: structuredClone(values),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key(projectId), JSON.stringify(payload));
  } catch {
    // non-critical
  }
}

export function clearDraft(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(projectId));
  } catch {
    // non-critical
  }
}
