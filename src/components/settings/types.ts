import {
  DEFAULT_CAPACITY_PER_WEEK,
  DEFAULT_ENGINEER_CAPACITY_DAYS,
  type EngineerCapacityDays,
} from "@/types/engineer-pool";

export type SettingsTabId = "engineers" | "projects";

export type EngineerCapacityPayload = {
  capacityPerWeek: number | null;
  capacityDays: EngineerCapacityDays;
};

export const DEFAULT_ENGINEER_CAPACITY: EngineerCapacityPayload = {
  capacityPerWeek: DEFAULT_CAPACITY_PER_WEEK,
  capacityDays: DEFAULT_ENGINEER_CAPACITY_DAYS,
};

export type EngineerCreatePayload = {
  firstName: string;
  lastName: string;
  isActive: boolean;
} & EngineerCapacityPayload;

export type EngineerUpdatePayload = EngineerCreatePayload & { id: string };
