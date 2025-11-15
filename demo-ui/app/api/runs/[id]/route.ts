export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiServerUrl = process.env.ATLAS_API_URL || "http://localhost:4000";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const response = await fetch(`${apiServerUrl}/api/runs/${context.params.id}`, {
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

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const payload = await request.text();
  const response = await fetch(`${apiServerUrl}/api/runs/${context.params.id}`, {
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
