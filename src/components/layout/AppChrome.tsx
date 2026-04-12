"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { EngineerManager } from "@/components/settings/EngineerManager";
import { OfficesSection } from "@/components/settings/OfficesSection";
import { ProjectSettingsSection } from "@/components/settings/ProjectSettingsSection";
import { SidebarTabsModal } from "@/components/settings/SidebarTabsModal";
import type { SettingsTabId } from "@/components/settings/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
  { id: "engineers", label: "Engineers" },
  { id: "offices", label: "Offices" },
  { id: "projects", label: "Projects" },
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsModalKey, setSettingsModalKey] = useState(0);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("engineers");
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (pathname === "/login") {
    return <div className="bg-background flex min-h-screen flex-col">{children}</div>;
  }

  async function onSignOut() {
    setIsSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
    setIsSigningOut(false);
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border bg-card shadow-card sticky top-0 z-40 border-b px-4 py-2">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col leading-tight">
            <p className="text-foreground text-sm font-semibold">Kite</p>
            <p className="text-muted-foreground text-xs">Project management</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSettingsModalKey((k) => k + 1);
                setIsSettingsOpen(true);
              }}
              className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={onSignOut}
              disabled={isSigningOut}
              className="border-border bg-background text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {isSettingsOpen && (
        <SidebarTabsModal
          key={settingsModalKey}
          title="Settings"
          activeTab={settingsTab}
          tabs={SETTINGS_TABS}
          onTabChange={setSettingsTab}
          onClose={() => {
            setIsSettingsOpen(false);
            setSettingsTab("engineers");
          }}
        >
          {settingsTab === "engineers" ? (
            <EngineerManager />
          ) : settingsTab === "offices" ? (
            <OfficesSection />
          ) : (
            <ProjectSettingsSection />
          )}
        </SidebarTabsModal>
      )}
    </div>
  );
}
