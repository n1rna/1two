import { apiFetch } from "@/lib/api-fetch";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const res = await apiFetch(`/api/v1/logo/s/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    return new Response(res.status === 404 ? "Logo not found" : "Server error", {
      status: res.status,
    });
  }

  const body = res.body;
  const contentType = res.headers.get("content-type") || "image/png";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
