export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * Proxy endpoint to the standalone ATLAS API server
 *
 * This route simply forwards SSE events from the backend API server
 * to avoid webpack bundling issues with Node.js-specific dependencies.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Get the API server URL from environment or use default
  const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

  // Build the upstream URL with query params
  const upstreamUrl = new URL(`${apiServerUrl}/api/atlas/stream`);
  searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  try {
    // Fetch from the upstream API server
    const response = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!response.ok) {
      throw new Error(`API server responded with ${response.status}: ${response.statusText}`);
    }

    // Forward the SSE stream
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Return an SSE error event
    const errorEvent = `event: error\ndata: ${JSON.stringify({
      type: "error",
      message: `Failed to connect to ATLAS API server: ${errorMessage}. Make sure the API server is running at ${apiServerUrl}`
    })}\n\n`;

    return new Response(errorEvent, {
      status: 200, // Keep 200 for SSE compatibility
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
}
