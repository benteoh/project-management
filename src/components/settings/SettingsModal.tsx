"use client";

import type { SettingsTabId } from "./types";

export function SettingsModal({
  activeTab,
  onTabChange,
  onClose,
  children,
}: {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="border-border bg-card shadow-overlay flex h-[min(92vh,900px)] w-full max-w-6xl rounded-lg border">
          <aside className="border-border w-44 border-r p-3">
            <button
              type="button"
              onClick={() => onTabChange("engineers")}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                activeTab === "engineers"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Engineers
            </button>
            <button
              type="button"
              onClick={() => onTabChange("projects")}
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                activeTab === "projects"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Projects
            </button>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex items-center justify-between border-b p-4">
              <h2 className="text-foreground text-base font-semibold">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">{children}</div>
          </section>
        </div>
      </div>
    </>
  );
}
