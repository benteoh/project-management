/**
 * Seeds the online Supabase database with programme nodes and engineer pool.
 *
 * 1. Create tables: npm run db:link && npm run db:push (or run migration SQL in Dashboard).
 * 2. Load data: npm run seed
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { initialProgrammeData } from "../src/mocks/programme";
import { flattenTree } from "../src/lib/programme/programmeTree";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });
config({ path: resolve(__dirname, "..", ".env"), quiet: true, override: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ENGINEER_POOL = [
  "AFe",
  "AGa",
  "AMa",
  "AMo",
  "ANa",
  "ANi",
  "ARa",
  "ATa",
  "BHa",
  "BLy",
  "DMo",
  "EBa",
  "JCh",
  "JWr",
  "KLa",
  "KOl",
  "LCh",
  "MDe",
  "MWo",
  "PHa",
  "ROl",
  "SFl",
  "SSi",
  "TRe",
  "TSc",
].sort();

async function seed() {
  console.log("Seeding Supabase...");

  const { error: poolErr } = await supabase.from("engineer_pool").upsert(
    ENGINEER_POOL.map((code) => ({ code })),
    { onConflict: "code" }
  );
  if (poolErr) throw new Error(`engineer_pool: ${poolErr.message}`);
  console.log(`✓ ${ENGINEER_POOL.length} engineers`);

  const { nodeRows, engineerRows } = flattenTree(initialProgrammeData);
  const { error: nodesErr } = await supabase
    .from("programme_nodes")
    .upsert(nodeRows, { onConflict: "id" });
  if (nodesErr) throw new Error(`programme_nodes: ${nodesErr.message}`);
  console.log(`✓ ${nodeRows.length} nodes`);

  if (engineerRows.length > 0) {
    const { error: engErr } = await supabase
      .from("scope_engineers")
      .upsert(engineerRows, { onConflict: "scope_id,engineer_code" });
    if (engErr) throw new Error(`scope_engineers: ${engErr.message}`);
    console.log(`✓ ${engineerRows.length} scope-engineer rows`);
  }

  console.log("Done.");
}

seed().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
