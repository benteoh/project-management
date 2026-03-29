"use client";

import { useState } from "react";
import { mockProject } from "@/mocks/projects";
import { formatDate } from "@/lib/utils";
import { ProgrammeTab } from "@/components/programme/ProgrammeTab";

const TABS = ["Programme", "Forecast"] as const;
type Tab = (typeof TABS)[number];

export default function ProjectPage() {
  const project = mockProject;
  const [activeTab, setActiveTab] = useState<Tab>("Programme");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <p className="text-sm text-muted-foreground">{project.client}</p>
        <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(project.startDate)} – {formatDate(project.endDate)} ·{" "}
          {project.office} · {project.status}
        </p>

        {/* Tabs */}
        <div className="mt-5 flex items-end gap-0.5 border-b border-border">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                  isActive
                    ? "relative z-10 -mb-px rounded-t-lg border-l border-r border-t border-border bg-card text-foreground"
                    : "rounded-t-lg text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-6 flex flex-1 flex-col border-x border-b border-border bg-card overflow-hidden">
        {activeTab === "Programme" && <ProgrammeTab />}
        {activeTab === "Forecast" && <div className="flex-1" />}
      </div>
    </div>
  );
}
