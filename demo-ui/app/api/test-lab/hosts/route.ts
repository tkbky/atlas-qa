export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

export async function GET() {
  const response = await fetch(`${apiServerUrl}/api/test-lab/hosts`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
