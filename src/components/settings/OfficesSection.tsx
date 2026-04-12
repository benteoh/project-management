"use client";

import { useEffect, useState, useTransition } from "react";

import {
  createOfficeAction,
  deleteOfficeAction,
  loadOfficesAction,
  updateOfficeAction,
} from "@/app/settings/officeActions";
import { SUBTLE_FORM_INPUT_CLASS } from "@/components/ui/InlineEditableText";
import type { Office } from "@/types/office";

import { OfficeRow } from "./OfficeRow";

export function OfficesSection({ compact = false }: { compact?: boolean } = {}) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLocation, setAddLocation] = useState("");

  useEffect(() => {
    void loadOfficesAction().then((r) => {
      setIsLoading(false);
      if (r.ok) setOffices(r.offices);
      else setError(r.error);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAdd(true);
    const r = await createOfficeAction({ name: addName, location: addLocation });
    setIsSavingAdd(false);
    if (r.ok) {
      setOffices(r.offices);
      setAddName("");
      setAddLocation("");
      setShowAddForm(false);
      setError(null);
    } else {
      setError(r.error);
    }
  };

  const handleUpdate = (id: string, draft: { name: string; location: string }) => {
    startTransition(async () => {
      const r = await updateOfficeAction(id, draft);
      if (r.ok) {
        setOffices(r.offices);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const r = await deleteOfficeAction(id);
      if (r.ok) {
        setOffices(r.offices);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className={`flex flex-col gap-4 ${compact ? "max-h-72 min-h-0" : "min-h-0 flex-1 gap-6"}`}>
      {isLoading && <p className="text-muted-foreground text-sm">Loading offices…</p>}

      {error && (
        <div className="border-border bg-status-critical-bg text-status-critical rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {!showAddForm ? (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="border-border bg-background text-foreground hover:bg-muted w-fit rounded-md border px-4 py-2 text-sm font-medium"
        >
          Add office
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="border-border bg-card/40 shadow-card rounded-lg border p-4"
        >
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
                Name
              </span>
              <input
                className={SUBTLE_FORM_INPUT_CLASS}
                value={addName}
                autoFocus
                required
                placeholder="London"
                onChange={(e) => setAddName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
                Location
              </span>
              <input
                className={SUBTLE_FORM_INPUT_CLASS}
                value={addLocation}
                required
                placeholder="London, United Kingdom"
                onChange={(e) => setAddLocation(e.target.value)}
              />
            </label>
          </div>
          <div className="border-border mt-4 flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddName("");
                setAddLocation("");
              }}
              className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingAdd}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Save office
            </button>
          </div>
        </form>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {offices.map((office) => (
          <OfficeRow
            key={office.id}
            office={office}
            isPending={isPending}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        {!isLoading && offices.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">No offices yet.</p>
        )}
      </div>
    </div>
  );
}
