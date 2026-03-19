import { NextRequest, NextResponse } from "next/server";

import { executeAlfredScenario, planAlfredScenario } from "@/lib/execution";
import { getScenarioById } from "@/lib/scenarios";

export async function GET(request: NextRequest) {
  const scenarioId = request.nextUrl.searchParams.get("scenario") ?? undefined;
  const scenario = getScenarioById(scenarioId ?? "");

  return NextResponse.json(await planAlfredScenario(scenario));
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { scenario?: string };
  const scenario = getScenarioById(payload.scenario ?? "");

  return NextResponse.json(await executeAlfredScenario(scenario));
}
