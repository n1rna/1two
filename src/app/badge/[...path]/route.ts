import { apiFetch } from "@/lib/api-fetch";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const badgePath = path.join("/");
  const url = new URL(request.url);
  const qs = url.search; // includes the ?

  const res = await apiFetch(`/api/v1/badge/${badgePath}${qs}`);

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
