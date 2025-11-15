export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upstreamUrl = new URL(`${apiServerUrl}/api/knowledge`);
  searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const response = await fetch(upstreamUrl, {
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
