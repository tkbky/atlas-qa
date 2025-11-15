export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

export async function POST(_request: Request, context: { params: { id: string } }) {
  const upstreamUrl = `${apiServerUrl}/api/runs/${context.params.id}/stop`;
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
