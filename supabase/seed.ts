/**
 * Seeds Supabase with programme nodes and engineer pool.
 * npm run seed  (loads .env.local then .env)
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { clampCapacityDay, clampCapacityWeek } from "../src/lib/engineers/engineerCapacity";
import { deriveEngineerCodeBase } from "../src/lib/engineers/engineerCode";
import { flattenTree } from "../src/lib/programme/programmeTree";
import {
  buildProgrammeNodesFromSeed,
  SEED_ENGINEER_ROWS,
  SEED_PROJECT_ENGINEER_RATE_ROWS,
  SEED_PROJECT_ID,
  seedProjectRow,
} from "../src/lib/programme/seedConfig";
import { resolveSupabaseEnvConfig } from "../src/lib/supabase/resolve-config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });
config({ path: resolve(__dirname, "..", ".env"), quiet: true, override: true });

const { url, anonKey } = resolveSupabaseEnvConfig();
const supabase = createClient(url, anonKey);

async function seed() {
  console.log("Seeding Supabase...");

  const { error: projectErr } = await supabase
    .from("projects")
    .upsert(seedProjectRow, { onConflict: "id" });
  if (projectErr) throw new Error(`projects: ${projectErr.message}`);
  console.log("✓ project");

  const { data: existingPool, error: existingPoolErr } = await supabase
    .from("engineer_pool")
    .select("id, code");
  if (existingPoolErr) throw new Error(`engineer_pool select: ${existingPoolErr.message}`);
  const codeToExistingId = new Map(
    (existingPool ?? []).map((r: { id: string; code: string }) => [r.code, r.id])
  );

  const poolUpsertRows = SEED_ENGINEER_ROWS.map((row) => {
    const code = deriveEngineerCodeBase(row.firstName, row.lastName);
    const id = codeToExistingId.get(code) ?? randomUUID();
    const w = clampCapacityWeek(row.maxWeeklyHours);
    const d = clampCapacityDay(row.maxDailyHours);
    return {
      id,
      code,
      first_name: row.firstName,
      last_name: row.lastName,
      is_active: true,
      max_daily_hours: d,
      max_weekly_hours: w,
    };
  });

  const { error: poolErr } = await supabase
    .from("engineer_pool")
    .upsert(poolUpsertRows, { onConflict: "code" });
  if (poolErr) throw new Error(`engineer_pool: ${poolErr.message}`);
  console.log(`✓ ${SEED_ENGINEER_ROWS.length} engineers`);

  const codeToId = new Map(poolUpsertRows.map((r) => [r.code, r.id]));
  const programmeNodes = buildProgrammeNodesFromSeed(codeToId);

  const { nodeRows, engineerRows } = flattenTree(programmeNodes, SEED_PROJECT_ID);
  const { error: nodesErr } = await supabase
    .from("programme_nodes")
    .upsert(nodeRows, { onConflict: "id" });
  if (nodesErr) throw new Error(`programme_nodes: ${nodesErr.message}`);
  console.log(`✓ ${nodeRows.length} nodes`);

  if (engineerRows.length > 0) {
    const { error: engErr } = await supabase
      .from("scope_engineers")
      .upsert(engineerRows, { onConflict: "scope_id,engineer_id" });
    if (engErr) throw new Error(`scope_engineers: ${engErr.message}`);
    console.log(`✓ ${engineerRows.length} scope-engineer rows`);
  }

  const projectEngineerRows = SEED_PROJECT_ENGINEER_RATE_ROWS.map((r) => {
    const engineerId = codeToId.get(r.code);
    if (!engineerId) {
      throw new Error(`project_engineers: no engineer_pool id for code ${r.code}`);
    }
    return {
      project_id: SEED_PROJECT_ID,
      engineer_id: engineerId,
      rate_a: r.rateA,
      rate_b: r.rateB,
      rate_c: null as number | null,
      rate_d: null as number | null,
      rate_e: null as number | null,
    };
  });

  const { error: peErr } = await supabase
    .from("project_engineers")
    .upsert(projectEngineerRows, { onConflict: "project_id,engineer_id" });
  if (peErr) throw new Error(`project_engineers: ${peErr.message}`);
  console.log(`✓ ${projectEngineerRows.length} project-engineer rate rows`);

  // ---- Timesheet sample data -------------------------------------------
  // Delete existing seed upload (identified by file name) to keep seed idempotent.
  const SEED_TIMESHEET_FILE = "Euston_Timesheet_March2025.xlsx";
  await supabase
    .from("timesheet_uploads")
    .delete()
    .eq("project_id", SEED_PROJECT_ID)
    .eq("file_name", SEED_TIMESHEET_FILE);

  // Sample entries: one week (2025-03-03 → 2025-03-07), five engineers.
  // Rate links to project_engineers.rate_a / rate_b for each engineer.
  type SeedEntry = {
    code: string;
    date: string;
    hours: number;
    rate: "A" | "B";
    amount: number;
    description: string;
  };
  const seedEntries: SeedEntry[] = [
    // Meryl Wong (MWo) — rate A: £82.31
    {
      code: "MWo",
      date: "2025-03-03",
      hours: 7.5,
      rate: "A",
      amount: 617.33,
      description: "Structural modelling",
    },
    {
      code: "MWo",
      date: "2025-03-04",
      hours: 8.0,
      rate: "A",
      amount: 658.48,
      description: "Structural modelling",
    },
    {
      code: "MWo",
      date: "2025-03-05",
      hours: 6.5,
      rate: "A",
      amount: 535.02,
      description: "Report writing",
    },
    // Andreas Feiersinger (AFe) — rate A: £171.56, rate B: £191.53
    {
      code: "AFe",
      date: "2025-03-03",
      hours: 8.0,
      rate: "A",
      amount: 1372.48,
      description: "Technical review",
    },
    {
      code: "AFe",
      date: "2025-03-04",
      hours: 9.0,
      rate: "A",
      amount: 1544.04,
      description: "Technical review",
    },
    {
      code: "AFe",
      date: "2025-03-05",
      hours: 8.0,
      rate: "B",
      amount: 1532.24,
      description: "Technical review",
    },
    // Laurence Chaplin (LCh) — rate A: £131.875, rate B: £147.22
    {
      code: "LCh",
      date: "2025-03-03",
      hours: 7.0,
      rate: "B",
      amount: 1030.54,
      description: "CAD drafting",
    },
    {
      code: "LCh",
      date: "2025-03-04",
      hours: 8.0,
      rate: "B",
      amount: 1177.76,
      description: "CAD drafting",
    },
    {
      code: "LCh",
      date: "2025-03-05",
      hours: 5.0,
      rate: "A",
      amount: 659.38,
      description: "Report writing",
    },
    // Arthur Nixon (ANi) — rate A: £104.375
    {
      code: "ANi",
      date: "2025-03-03",
      hours: 8.0,
      rate: "A",
      amount: 835.0,
      description: "Site visit",
    },
    {
      code: "ANi",
      date: "2025-03-04",
      hours: 7.5,
      rate: "A",
      amount: 782.81,
      description: "Site visit",
    },
    {
      code: "ANi",
      date: "2025-03-05",
      hours: 8.0,
      rate: "A",
      amount: 835.0,
      description: "Concept design",
    },
    // Emma Barnes (EBa) — rate A: £60.00
    {
      code: "EBa",
      date: "2025-03-03",
      hours: 7.5,
      rate: "A",
      amount: 450.0,
      description: "CAD drafting",
    },
    {
      code: "EBa",
      date: "2025-03-04",
      hours: 8.0,
      rate: "A",
      amount: 480.0,
      description: "CAD drafting",
    },
    {
      code: "EBa",
      date: "2025-03-05",
      hours: 10.5,
      rate: "A",
      amount: 630.0,
      description: "CAD drafting",
    },
  ];

  const { data: uploadData, error: uploadErr } = await supabase
    .from("timesheet_uploads")
    .insert({
      project_id: SEED_PROJECT_ID,
      file_name: SEED_TIMESHEET_FILE,
      row_count: seedEntries.length,
    })
    .select()
    .single();
  if (uploadErr) throw new Error(`timesheet_uploads: ${uploadErr.message}`);
  const uploadId = (uploadData as { id: string }).id;

  const entryRows = seedEntries.map((e, i) => {
    const engineerId = codeToId.get(e.code) ?? null;
    // Raw data mirrors what a real DSP Excel export would contain.
    const raw_data: Record<string, string> = {
      Date: e.date.split("-").reverse().join("/"), // DD/MM/YYYY
      Code: e.code,
      Hours: String(e.hours),
      Rate: e.rate,
      Amount: `£${e.amount.toFixed(2)}`,
      Description: e.description,
    };
    return {
      upload_id: uploadId,
      project_id: SEED_PROJECT_ID,
      row_index: i,
      engineer_id: engineerId,
      engineer_code: e.code,
      entry_date: e.date,
      hours: e.hours,
      rate_slot: e.rate,
      amount: e.amount,
      description: e.description,
      raw_data,
    };
  });

  const { error: entryErr } = await supabase.from("timesheet_entries").insert(entryRows);
  if (entryErr) throw new Error(`timesheet_entries: ${entryErr.message}`);
  console.log(`✓ ${entryRows.length} timesheet entries (${SEED_TIMESHEET_FILE})`);

  console.log("Done.");
}

seed().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
