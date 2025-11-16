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

export async function POST(request: NextRequest) {
  const runId = runIdFromRequest(request);
  const upstreamUrl = `${apiServerUrl}/api/runs/${runId}/retry`;
  const response = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
