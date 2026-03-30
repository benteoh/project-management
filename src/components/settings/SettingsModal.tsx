"use client";

import { useState } from "react";

import type { SettingsTabId } from "./types";

export function SettingsModal({
  initialTab,
  onClose,
  children,
}: {
  initialTab: SettingsTabId;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [activeTab] = useState<SettingsTabId>(initialTab);

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
              <h2 className="text-foreground text-base font-semibold">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              {activeTab === "engineers" && children}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
