export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

import type { NextRequest } from "next/server";

const runIdFromRequest = (request: NextRequest) => {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const runsIdx = segments.findIndex((segment) => segment === "runs");
  if (runsIdx >= 0 && runsIdx + 1 < segments.length) {
    return segments[runsIdx + 1];
  }
  return segments.pop() ?? "";
};

export async function GET(request: NextRequest) {
  const runId = runIdFromRequest(request);
  const response = await fetch(`${apiServerUrl}/api/runs/${runId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(request: NextRequest) {
  const payload = await request.text();
  const runId = runIdFromRequest(request);
  const response = await fetch(`${apiServerUrl}/api/runs/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
