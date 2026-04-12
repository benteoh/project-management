"use client";

import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import type { Office } from "@/types/office";
import type { ProjectStatus } from "@/types/project";

import { Field } from "./Field";
import type { ProjectCreatePayload } from "./types";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "bid", label: "Bid" },
  { value: "on_hold", label: "On Hold" },
];

const SELECT_CLASS =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-foreground transition-colors hover:border-border hover:bg-muted/50 focus:border-ring focus:bg-card focus:outline-none focus:ring-1 focus:ring-ring/40 cursor-pointer";

export function ProjectFormFields({
  value,
  offices,
  disabled,
  onChange,
}: {
  value: ProjectCreatePayload;
  offices: Office[];
  disabled?: boolean;
  onChange: (next: ProjectCreatePayload) => void;
}) {
  const set = <K extends keyof ProjectCreatePayload>(key: K, v: ProjectCreatePayload[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <Field label="Project name">
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={value.name}
            required
            disabled={disabled}
            placeholder="Euston Station"
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Client">
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={value.client}
            required
            disabled={disabled}
            placeholder="HS2 Ltd"
            onChange={(e) => set("client", e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <Field label="Office">
          <select
            className={SELECT_CLASS}
            value={value.officeId}
            required
            disabled={disabled}
            onChange={(e) => set("officeId", e.target.value)}
          >
            <option value="">Select office…</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={value.status}
            disabled={disabled}
            onChange={(e) => set("status", e.target.value as ProjectStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project code">
          <input
            className={SUBTLE_FORM_INPUT_CLASS}
            value={value.projectCode ?? ""}
            disabled={disabled}
            placeholder="489"
            onChange={(e) => set("projectCode", e.target.value || null)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <Field label="Fixed fee (£)">
          <input
            type="number"
            min={0}
            step={1}
            className={SUBTLE_FORM_INPUT_CLASS}
            value={value.fixedFee}
            disabled={disabled}
            onChange={(e) => set("fixedFee", Number(e.target.value))}
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            className={SUBTLE_FORM_INPUT_CLASS}
            value={value.startDate}
            disabled={disabled}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            className={SUBTLE_FORM_INPUT_CLASS}
            value={value.endDate}
            disabled={disabled}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
