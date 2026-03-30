export type SettingsTabId = "engineers";

export type EngineerCreatePayload = {
  code: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

export type EngineerUpdatePayload = EngineerCreatePayload & { id: string };
