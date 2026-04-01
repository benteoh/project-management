import { DEFAULT_MAX_DAILY_HOURS, DEFAULT_MAX_WEEKLY_HOURS } from "@/types/engineer-pool";

export type SettingsTabId = "engineers" | "projects";

export type EngineerCapacityPayload = {
  maxDailyHours: number | null;
  maxWeeklyHours: number | null;
};

export const DEFAULT_ENGINEER_CAPACITY: EngineerCapacityPayload = {
  maxDailyHours: DEFAULT_MAX_DAILY_HOURS,
  maxWeeklyHours: DEFAULT_MAX_WEEKLY_HOURS,
};

export type EngineerCreatePayload = {
  firstName: string;
  lastName: string;
  isActive: boolean;
} & EngineerCapacityPayload;

export type EngineerUpdatePayload = EngineerCreatePayload & { id: string };
