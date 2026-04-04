import { NextRequest, NextResponse } from "next/server";

import { buildCsv, buildXlsx } from "@/lib/export/exportBuilder";
import { getForecastSheet } from "@/lib/export/forecastExport";
import { getProgrammeSheet } from "@/lib/export/programmeExport";
import { loadProgrammeFromDb } from "@/lib/programme/programmeDb";
import { loadProjectById } from "@/lib/projects/projectDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const format = searchParams.get("format");
  const type = searchParams.get("type");

  if (!projectId || !format || !type) {
    return NextResponse.json(
      { error: "Missing required query params: projectId, format, type" },
      { status: 400 }
    );
  }
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "format must be csv or xlsx" }, { status: 400 });
  }
  if (type !== "programme" && type !== "forecast") {
    return NextResponse.json({ error: "type must be programme or forecast" }, { status: 400 });
  }

  const client = await createServerSupabaseClient();

  const [projectResult, programmeResult] = await Promise.all([
    loadProjectById(client, projectId),
    loadProgrammeFromDb(client, projectId),
  ]);

  if ("error" in projectResult) {
    return NextResponse.json({ error: projectResult.error }, { status: 500 });
  }
  if ("error" in programmeResult) {
    return NextResponse.json({ error: programmeResult.error }, { status: 500 });
  }

  const { project } = projectResult;
  const { tree, engineerPool } = programmeResult;

  const slug = project.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const filename = `${slug}_${type}.${format}`;

  if (format === "csv") {
    const csv =
      type === "programme"
        ? buildCsv(getProgrammeSheet(tree, project))
        : buildCsv(getForecastSheet(tree, engineerPool, project));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const buffer =
    type === "programme"
      ? await buildXlsx(getProgrammeSheet(tree, project))
      : await buildXlsx(getForecastSheet(tree, engineerPool, project));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
