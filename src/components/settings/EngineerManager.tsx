"use client";

import { useEffect, useMemo, useState } from "react";

import { loadOfficesAction } from "@/app/settings/officeActions";
import { deriveEngineerCodeBase } from "@/lib/engineers/engineerCode";
import { reconcileEngineerCapacityForSave } from "@/lib/engineers/engineerCapacity";
import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import type { Office } from "@/types/office";
import type { Engineer } from "@/types/engineer-pool";

import { EngineerCapacityFields } from "./EngineerCapacityFields";
import { EngineerRow } from "./EngineerRow";
import { Field } from "./Field";
import { DEFAULT_ENGINEER_CAPACITY } from "./types";
import { useEngineerManager } from "./useEngineerManager";

type OfficeEngineerSection = {
  office: Office | null;
  heading: string;
  subheading: string | null;
  engineers: Engineer[];
};

function sectionTabKey(section: OfficeEngineerSection): string {
  if (section.office) return section.office.id;
  const first = section.engineers[0];
  if (first?.officeId == null) return "unassigned";
  return `legacy-${first.officeId}`;
}

function buildSections(offices: Office[], engineers: Engineer[]): OfficeEngineerSection[] {
  if (offices.length === 0) {
    if (engineers.length === 0) return [];
    const byOfficeId = new Map<string | null, Engineer[]>();
    for (const e of engineers) {
      const key = e.officeId;
      const list = byOfficeId.get(key) ?? [];
      list.push(e);
      byOfficeId.set(key, list);
    }
    return Array.from(byOfficeId.entries()).map(([officeId, group]) => ({
      office: null,
      heading: officeId == null ? "Unassigned" : (group[0]?.officeName ?? "Engineers"),
      subheading: null,
      engineers: group,
    }));
  }

  const officeIds = new Set(offices.map((o) => o.id));
  const sections: OfficeEngineerSection[] = offices.map((office) => ({
    office,
    heading: office.name,
    subheading: office.location || null,
    engineers: engineers.filter((e) => e.officeId === office.id),
  }));

  const orphan = engineers.filter((e) => e.officeId == null || !officeIds.has(e.officeId));
  if (orphan.length === 0) return sections;

  const orphanByKey = new Map<string, Engineer[]>();
  for (const e of orphan) {
    const key = e.officeId ?? "unassigned";
    const list = orphanByKey.get(key) ?? [];
    list.push(e);
    orphanByKey.set(key, list);
  }
  for (const group of orphanByKey.values()) {
    const first = group[0];
    const unassigned = first?.officeId == null;
    sections.push({
      office: null,
      heading: unassigned ? "Unassigned" : (first?.officeName ?? "Other"),
      subheading: unassigned ? null : "Office record missing or removed",
      engineers: group,
    });
  }
  return sections;
}

function createTargetOfficeId(section: OfficeEngineerSection): string | null | undefined {
  if (section.office) return section.office.id;
  if (section.subheading === "Office record missing or removed") return undefined;
  if (section.engineers.length === 0) return null;
  if (section.engineers.every((e) => e.officeId == null)) return null;
  return section.engineers[0]?.officeId ?? null;
}

/** Office id implied by this section / tab (used when saving engineer rows). */
function sectionContextOfficeId(section: OfficeEngineerSection): string | null {
  if (section.office) return section.office.id;
  if (section.engineers.length === 0 || section.engineers.every((e) => e.officeId == null)) {
    return null;
  }
  return section.engineers[0]?.officeId ?? null;
}

export function EngineerManager() {
  const vm = useEngineerManager();

  const [offices, setOffices] = useState<Office[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxDailyHours, setMaxDailyHours] = useState<number | null>(
    DEFAULT_ENGINEER_CAPACITY.maxDailyHours
  );
  const [maxWeeklyHours, setMaxWeeklyHours] = useState<number | null>(
    DEFAULT_ENGINEER_CAPACITY.maxWeeklyHours
  );
  /** Office for the in-progress add form (`null` = unassigned). */
  const [createOfficeId, setCreateOfficeId] = useState<string | null>(null);

  const sections = useMemo(
    () => buildSections(offices, vm.sortedEngineers),
    [offices, vm.sortedEngineers]
  );

  /** User-picked tab; when null or stale, the first section tab is used. */
  const [pickedOfficeTabId, setPickedOfficeTabId] = useState<string | null>(null);

  const activeOfficeTabId = useMemo(() => {
    const keys = sections.map(sectionTabKey);
    if (keys.length === 0) return null;
    if (pickedOfficeTabId != null && keys.includes(pickedOfficeTabId)) return pickedOfficeTabId;
    return keys[0]!;
  }, [sections, pickedOfficeTabId]);

  useEffect(() => {
    let cancelled = false;
    void loadOfficesAction().then((res) => {
      if (cancelled) return;
      if (res.ok) setOffices(res.offices);
      setOfficesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const codePreview = useMemo(
    () => deriveEngineerCodeBase(firstName, lastName),
    [firstName, lastName]
  );

  const resetAddForm = () => {
    setFirstName("");
    setLastName("");
    setIsActive(true);
    setMaxDailyHours(DEFAULT_ENGINEER_CAPACITY.maxDailyHours);
    setMaxWeeklyHours(DEFAULT_ENGINEER_CAPACITY.maxWeeklyHours);
    setCreateOfficeId(null);
  };

  const handleCancelAdd = () => {
    resetAddForm();
    setShowAddForm(false);
  };

  const openAddForm = (targetOfficeId: string | null) => {
    setCreateOfficeId(targetOfficeId);
    setShowAddForm(true);
  };

  const listLoading = vm.isLoading || officesLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-xs">Manage engineer records by office.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Pick an office tab to see and add engineers for that location.
        </p>
      </div>
      {vm.error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-md border px-3 py-2 text-sm">
          {vm.error}
        </div>
      )}

      {listLoading && vm.sortedEngineers.length === 0 && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {!listLoading && offices.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Add at least one office in the Offices tab before you can assign engineers to a location.
        </p>
      )}

      {!listLoading && showAddForm && (
        <form
          className="border-border bg-card/40 shadow-card rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setIsSavingAdd(true);
              try {
                const cap = reconcileEngineerCapacityForSave(maxDailyHours, maxWeeklyHours);
                const ok = await vm.create({
                  firstName,
                  lastName,
                  isActive,
                  officeId: createOfficeId,
                  maxDailyHours: cap.maxDailyHours,
                  maxWeeklyHours: cap.maxWeeklyHours,
                });
                if (ok) {
                  resetAddForm();
                  setShowAddForm(false);
                }
              } finally {
                setIsSavingAdd(false);
              }
            })();
          }}
        >
          <p className="text-foreground mb-3 text-sm font-medium">
            New engineer
            {createOfficeId == null
              ? " · Unassigned"
              : ` · ${offices.find((o) => o.id === createOfficeId)?.name ?? "Office"}`}
          </p>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <div className="w-[3.25rem] shrink-0">
              <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium tracking-wide uppercase">
                Code
              </span>
              <p className="text-muted-foreground text-xs leading-tight tabular-nums">
                {firstName.trim() && lastName.trim() ? (
                  <span className="text-foreground block truncate font-medium" title={codePreview}>
                    {codePreview}
                  </span>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <Field label="First name">
              <input
                className={SUBTLE_FORM_INPUT_CLASS}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                autoFocus
                required
              />
            </Field>
            <Field label="Last name">
              <input
                className={SUBTLE_FORM_INPUT_CLASS}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </Field>
          </div>

          <EngineerCapacityFields
            maxDailyHours={maxDailyHours}
            maxWeeklyHours={maxWeeklyHours}
            disabled={vm.isPending || isSavingAdd}
            onCapacityCommit={(d, w) => {
              setMaxDailyHours(d);
              setMaxWeeklyHours(w);
            }}
          />

          <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="border-border rounded"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCancelAdd}
                className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={vm.isPending || isSavingAdd}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Save engineer
              </button>
            </div>
          </div>
        </form>
      )}

      {!listLoading && sections.length > 0 && activeOfficeTabId && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {sections.length > 1 && (
            <div
              role="tablist"
              aria-label="Office"
              className="border-border flex shrink-0 flex-wrap gap-0.5 border-b"
            >
              {sections.map((section) => {
                const key = sectionTabKey(section);
                const isActive = key === activeOfficeTabId;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    id={`office-engineer-tab-${key}`}
                    onClick={() => setPickedOfficeTabId(key)}
                    className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                      isActive
                        ? "border-border bg-card text-foreground relative z-10 -mb-px border-t border-r border-l"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.heading}
                  </button>
                );
              })}
            </div>
          )}

          {(() => {
            const section =
              sections.find((s) => sectionTabKey(s) === activeOfficeTabId) ?? sections[0];
            if (!section) return null;
            const multiOffice = sections.length > 1;
            const targetOfficeId = createTargetOfficeId(section);
            const contextOfficeId = sectionContextOfficeId(section);
            const showAdd = !showAddForm && targetOfficeId !== undefined;
            return (
              <section
                role={multiOffice ? "tabpanel" : "region"}
                aria-labelledby={
                  multiOffice ? `office-engineer-tab-${activeOfficeTabId}` : undefined
                }
                aria-label={multiOffice ? undefined : `Engineers for ${section.heading}`}
                className="flex min-h-0 flex-1 flex-col gap-3"
              >
                {!multiOffice && (
                  <div>
                    <h4 className="text-foreground text-sm font-semibold">{section.heading}</h4>
                    {section.subheading ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">{section.subheading}</p>
                    ) : null}
                  </div>
                )}
                {multiOffice && section.subheading ? (
                  <p className="text-muted-foreground text-xs">{section.subheading}</p>
                ) : null}

                {showAdd && (
                  <div className="flex shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (targetOfficeId === undefined) return;
                        openAddForm(targetOfficeId);
                      }}
                      className="border-border bg-background text-foreground hover:bg-muted w-fit rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      Add engineer
                    </button>
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
                  {section.engineers.map((engineer) => (
                    <EngineerRow
                      key={engineer.id}
                      engineer={engineer}
                      sectionOfficeId={contextOfficeId}
                      isPending={vm.isPending}
                      onUpdate={vm.update}
                    />
                  ))}
                  {!vm.isLoading && section.engineers.length === 0 && (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                      No engineers in this office yet.
                    </p>
                  )}
                </div>
              </section>
            );
          })()}
        </div>
      )}
    </div>
  );
}
