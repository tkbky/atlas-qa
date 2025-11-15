export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const upstreamUrl = `${apiServerUrl}/api/runs/${context.params.id}/stream`;

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
          runId: context.params.id,
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
      runId: context.params.id,
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
