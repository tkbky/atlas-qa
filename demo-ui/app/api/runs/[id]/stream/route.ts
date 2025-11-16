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
  const upstreamUrl = `${apiServerUrl}/api/runs/${runId}/stream`;

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
    });

    if (!response.ok && response.body === null) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({
          type: "error",
          message: `Failed to connect to run stream (${response.status})`,
          runId,
        })}\n\n`,
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const data = `event: error\ndata: ${JSON.stringify({
      type: "error",
      message: `Failed to connect to run stream: ${message}`,
      runId,
    })}\n\n`;
    return new Response(data, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}
