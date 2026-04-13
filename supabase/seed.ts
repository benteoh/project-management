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
  SEED_LONDON_OFFICE_ID,
  SEED_OFFICES,
  SEED_PROJECT_ENGINEER_RATE_ROWS,
  SEED_PROJECT_ID,
  SEED_PROJECT_TEST_ID,
  SEED_PROJECT_TEST_NODE_ID_PREFIX,
  seedProjectRow,
  seedProjectTestRow,
} from "../src/lib/programme/seedConfig";
import { programmeNodesWithPrefixedIds } from "../src/lib/programme/seedProgrammeClone";
import { resolveSupabaseEnvConfig } from "../src/lib/supabase/resolve-config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });
config({ path: resolve(__dirname, "..", ".env"), quiet: true, override: true });

const { url, anonKey } = resolveSupabaseEnvConfig();
const supabase = createClient(url, anonKey);

async function seed() {
  console.log("Seeding Supabase...");

  const { error: officeErr } = await supabase.from("offices").upsert([...SEED_OFFICES], {
    onConflict: "id",
  });
  if (officeErr) throw new Error(`offices: ${officeErr.message}`);
  console.log(`\u2713 ${SEED_OFFICES.length} offices`);

  const { error: projectErr } = await supabase
    .from("projects")
    .upsert([seedProjectRow, seedProjectTestRow], { onConflict: "id" });
  if (projectErr) throw new Error(`projects: ${projectErr.message}`);
  console.log("\u2713 projects (Euston + Euston Test)");

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
      office_id: SEED_LONDON_OFFICE_ID,
    };
  });

  const { error: poolErr } = await supabase
    .from("engineer_pool")
    .upsert(poolUpsertRows, { onConflict: "code" });
  if (poolErr) throw new Error(`engineer_pool: ${poolErr.message}`);
  console.log(`✓ ${SEED_ENGINEER_ROWS.length} engineers`);

  const codeToId = new Map(poolUpsertRows.map((r) => [r.code, r.id]));
  const programmeNodes = buildProgrammeNodesFromSeed(codeToId);
  const programmeNodesTest = programmeNodesWithPrefixedIds(
    programmeNodes,
    SEED_PROJECT_TEST_NODE_ID_PREFIX
  );

  const primary = flattenTree(programmeNodes, SEED_PROJECT_ID);
  const test = flattenTree(programmeNodesTest, SEED_PROJECT_TEST_ID);
  const nodeRows = [...primary.nodeRows, ...test.nodeRows];
  const engineerRows = [...primary.engineerRows, ...test.engineerRows];

  const { error: nodesErr } = await supabase
    .from("programme_nodes")
    .upsert(nodeRows, { onConflict: "id" });
  if (nodesErr) throw new Error(`programme_nodes: ${nodesErr.message}`);
  console.log(`\u2713 ${nodeRows.length} programme nodes (2 projects)`);

  if (engineerRows.length > 0) {
    const { error: engErr } = await supabase
      .from("scope_engineers")
      .upsert(engineerRows, { onConflict: "scope_id,engineer_id" });
    if (engErr) throw new Error(`scope_engineers: ${engErr.message}`);
    console.log(`✓ ${engineerRows.length} scope-engineer rows`);
  }

  const projectEngineerRows = [SEED_PROJECT_ID, SEED_PROJECT_TEST_ID].flatMap((projectId) =>
    SEED_PROJECT_ENGINEER_RATE_ROWS.map((r) => {
      const engineerId = codeToId.get(r.code);
      if (!engineerId) {
        throw new Error(`project_engineers: no engineer_pool id for code ${r.code}`);
      }
      return {
        project_id: projectId,
        engineer_id: engineerId,
        rate_a: r.rateA,
        rate_b: r.rateB,
        rate_c: null as number | null,
        rate_d: null as number | null,
        rate_e: null as number | null,
      };
    })
  );

  const { error: peErr } = await supabase
    .from("project_engineers")
    .upsert(projectEngineerRows, { onConflict: "project_id,engineer_id" });
  if (peErr) throw new Error(`project_engineers: ${peErr.message}`);
  console.log(`✓ ${projectEngineerRows.length} project-engineer rate rows`);

  // ---- Timesheet sample data -------------------------------------------
  // Same rows for both seed projects; distinct file names keep deletes idempotent per project.
  const SEED_TIMESHEET_FILE = "Euston_Timesheet_March2025.xlsx";
  const SEED_TIMESHEET_FILE_TEST = "Euston_Timesheet_March2025_Test.xlsx";

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

  async function seedTimesheetForProject(projectId: string, fileName: string) {
    await supabase
      .from("timesheet_uploads")
      .delete()
      .eq("project_id", projectId)
      .eq("file_name", fileName);

    const { data: uploadData, error: uploadErr } = await supabase
      .from("timesheet_uploads")
      .insert({
        project_id: projectId,
        file_name: fileName,
        row_count: seedEntries.length,
      })
      .select()
      .single();
    if (uploadErr) throw new Error(`timesheet_uploads: ${uploadErr.message}`);
    const uploadId = (uploadData as { id: string }).id;

    const entryRows = seedEntries.map((e, i) => {
      const engineerId = codeToId.get(e.code) ?? null;
      const raw_data: Record<string, string> = {
        Date: e.date.split("-").reverse().join("/"),
        Code: e.code,
        Hours: String(e.hours),
        Rate: e.rate,
        Amount: `£${e.amount.toFixed(2)}`,
        Description: e.description,
      };
      return {
        upload_id: uploadId,
        project_id: projectId,
        row_index: i,
        engineer_id: engineerId,
        entry_date: e.date,
        hours: e.hours,
        scope_id: null,
        activity_id: null,
        notes: e.description,
        raw_data,
      };
    });

    const { error: entryErr } = await supabase.from("timesheet_entries").insert(entryRows);
    if (entryErr) throw new Error(`timesheet_entries: ${entryErr.message}`);
    console.log(`\u2713 ${entryRows.length} timesheet entries (${fileName})`);
  }

  await seedTimesheetForProject(SEED_PROJECT_ID, SEED_TIMESHEET_FILE);
  await seedTimesheetForProject(SEED_PROJECT_TEST_ID, SEED_TIMESHEET_FILE_TEST);

  console.log("Done.");
}

seed().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
