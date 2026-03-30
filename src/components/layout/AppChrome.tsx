"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createEngineerAction,
  deleteEngineerAction,
  updateEngineerAction,
} from "@/app/settings/actions";
import type { Engineer } from "@/types/engineer-pool";

type Tab = "engineers";

export function AppChrome({
  children,
  initialEngineers,
}: {
  children: React.ReactNode;
  initialEngineers: Engineer[];
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab] = useState<Tab>("engineers");
  const [engineers, setEngineers] = useState<Engineer[]>(initialEngineers);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedEngineers = useMemo(
    () =>
      [...engineers].sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.code.localeCompare(b.code)
      ),
    [engineers]
  );

  const runMutation = (fn: () => Promise<void>) => {
    startTransition(() => {
      void fn();
    });
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border bg-card shadow-card sticky top-0 z-40 border-b px-4 py-2">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between">
          <p className="text-foreground text-sm font-semibold">DSP Project Intelligence</p>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            Settings
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      {isSettingsOpen && (
        <SettingsModal
          activeTab={activeTab}
          engineers={sortedEngineers}
          isPending={isPending}
          error={error}
          onClose={() => {
            setIsSettingsOpen(false);
            setError(null);
          }}
          onCreate={(payload) => {
            runMutation(async () => {
              const res = await createEngineerAction(payload);
              if (!res.ok) return setError(res.error);
              setEngineers(res.engineers);
              setError(null);
            });
          }}
          onUpdate={(payload) => {
            runMutation(async () => {
              const res = await updateEngineerAction(payload);
              if (!res.ok) return setError(res.error);
              setEngineers(res.engineers);
              setError(null);
            });
          }}
          onDelete={(id) => {
            runMutation(async () => {
              const res = await deleteEngineerAction(id);
              if (!res.ok) return setError(res.error);
              setEngineers(res.engineers);
              setError(null);
            });
          }}
        />
      )}
    </div>
  );
}

function SettingsModal({
  activeTab,
  engineers,
  isPending,
  error,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  activeTab: Tab;
  engineers: Engineer[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (payload: {
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }) => void;
  onUpdate: (payload: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="border-border bg-card shadow-overlay flex h-[80vh] w-full max-w-4xl rounded-lg border">
          <aside className="border-border w-44 border-r p-3">
            <button
              type="button"
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                activeTab === "engineers"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Engineers
            </button>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-foreground text-base font-semibold">Settings</h2>
                <p className="text-muted-foreground text-xs">Manage engineer records</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4">
              {error && (
                <div className="border-border bg-status-critical-bg text-status-critical mb-3 rounded-md border px-3 py-2 text-sm">
                  {error}
                </div>
              )}
              <EngineerManager
                engineers={engineers}
                isPending={isPending}
                onCreate={onCreate}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function EngineerManager({
  engineers,
  isPending,
  onCreate,
  onUpdate,
  onDelete,
}: {
  engineers: Engineer[];
  isPending: boolean;
  onCreate: (payload: {
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }) => void;
  onUpdate: (payload: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isActive, setIsActive] = useState(true);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <form
        className="border-border bg-background grid grid-cols-5 items-end gap-2 rounded-lg border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ code, firstName, lastName, isActive });
          setCode("");
          setFirstName("");
          setLastName("");
          setIsActive(true);
        }}
      >
        <Field label="Code">
          <input
            className="border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="JDo"
          />
        </Field>
        <Field label="First name">
          <input
            className="border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="John"
          />
        </Field>
        <Field label="Last name">
          <input
            className="border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
          />
        </Field>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm disabled:opacity-60"
        >
          Add engineer
        </button>
      </form>

      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="border-border bg-muted grid grid-cols-[1.2fr_1.4fr_1.4fr_0.8fr_120px] gap-2 border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase">
          <span>Code</span>
          <span>First Name</span>
          <span>Last Name</span>
          <span>Active</span>
          <span>Actions</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {engineers.map((engineer) => (
            <EngineerRow
              key={engineer.id}
              engineer={engineer}
              isPending={isPending}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
          {engineers.length === 0 && (
            <p className="text-muted-foreground p-4 text-sm">No engineers yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EngineerRow({
  engineer,
  isPending,
  onUpdate,
  onDelete,
}: {
  engineer: Engineer;
  isPending: boolean;
  onUpdate: (payload: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [code, setCode] = useState(engineer.code);
  const [firstName, setFirstName] = useState(engineer.firstName);
  const [lastName, setLastName] = useState(engineer.lastName);
  const [isActive, setIsActive] = useState(engineer.isActive);

  return (
    <div className="border-border grid grid-cols-[1.2fr_1.4fr_1.4fr_0.8fr_120px] gap-2 border-b px-3 py-2">
      <input
        className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <input
        className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onUpdate({ id: engineer.id, code, firstName, lastName, isActive })}
          className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onDelete(engineer.id)}
          className="text-status-critical border-border rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
