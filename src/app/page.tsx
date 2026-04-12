import Link from "next/link";
import { Building2 } from "lucide-react";

import { listProjectsFromDb } from "@/lib/projects/projectDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Project } from "@/types/project";

type OfficeGroup = {
  name: string;
  ongoingCount: number;
  completedCount: number;
  totalCount: number;
};

function groupByOffice(projects: Project[]): OfficeGroup[] {
  const map = new Map<string, OfficeGroup>();
  for (const p of projects) {
    const existing = map.get(p.officeName) ?? {
      name: p.officeName,
      ongoingCount: 0,
      completedCount: 0,
      totalCount: 0,
    };
    existing.totalCount += 1;
    if (p.status === "complete") existing.completedCount += 1;
    else if (p.status === "active") existing.ongoingCount += 1;
    map.set(p.officeName, existing);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default async function HomePage() {
  let offices: OfficeGroup[] = [];
  let error: string | null = null;

  try {
    const client = await createServerSupabaseClient();
    const result = await listProjectsFromDb(client);
    if ("projects" in result) {
      offices = groupByOffice(result.projects);
    } else {
      error = result.error;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load offices";
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-8">
        <h1 className="text-foreground text-2xl font-semibold">Select Office</h1>
        <p className="text-muted-foreground mt-1 text-sm">Choose your office to view projects</p>
      </div>

      {error && <p className="text-status-critical mb-4 text-sm">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offices.map((office) => (
          <Link
            key={office.name}
            href={`/${encodeURIComponent(office.name)}`}
            className="group border-border bg-card shadow-card hover:border-foreground/20 hover:shadow-elevated block rounded-lg border p-5 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-muted-foreground shrink-0" />
                  <h2 className="text-foreground truncate text-base font-semibold">
                    {office.name}
                  </h2>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {office.totalCount} project{office.totalCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="bg-gold mt-1.5 ml-3 h-2 w-2 shrink-0 rounded-full" />
            </div>

            <div className="mt-4 flex items-end gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Ongoing
                </p>
                <p className="text-foreground text-2xl font-semibold">{office.ongoingCount}</p>
              </div>
              <div className="bg-border h-8 w-px" />
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Completed
                </p>
                <p className="text-muted-foreground text-2xl font-semibold">
                  {office.completedCount}
                </p>
              </div>
            </div>
          </Link>
        ))}

        {offices.length === 0 && !error && (
          <p className="text-muted-foreground col-span-full text-sm">No offices found.</p>
        )}
      </div>
    </div>
  );
}
