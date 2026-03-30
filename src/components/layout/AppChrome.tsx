"use client";

import { useState } from "react";

import { EngineerManager } from "@/components/settings/EngineerManager";
import { SettingsModal } from "@/components/settings/SettingsModal";
import type { SettingsTabId } from "@/components/settings/types";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab] = useState<SettingsTabId>("engineers");

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
        <SettingsModal initialTab={activeTab} onClose={() => setIsSettingsOpen(false)}>
          <EngineerManager />
        </SettingsModal>
      )}
    </div>
  );
}
