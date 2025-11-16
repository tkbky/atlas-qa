export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

import type { NextRequest } from "next/server";

const resolveHost = (request: NextRequest) => {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const hostsIdx = segments.findIndex((segment) => segment === "hosts");
  if (hostsIdx >= 0 && hostsIdx + 1 < segments.length) {
    return segments[hostsIdx + 1];
  }
  return segments.pop() ?? "";
};

export async function POST(request: NextRequest) {
  const host = resolveHost(request);
  const payload = await request.text();
  const response = await fetch(`${apiServerUrl}/api/test-lab/hosts/${host}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
