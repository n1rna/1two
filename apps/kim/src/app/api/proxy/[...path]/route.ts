import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { apiFetch } from "@/lib/api-fetch";

const API_BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8080";

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = path.join("/");

  // Build URL path with query params
  const url = new URL(`/api/v1/${targetPath}`, API_BACKEND_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Get session from better-auth (non-critical - don't block proxy on auth failure)
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch (err) {
    console.warn("[proxy] auth.getSession failed:", err);
  }

  // Build forwarded headers
  const forwardHeaders: Record<string, string> = {
    "x-forwarded-for": req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "",
  };

  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders["content-type"] = contentType;
  }

  if (session?.session) {
    forwardHeaders["x-session-token"] = session.session.token;
    forwardHeaders["x-user-id"] = session.user.id;
  } else {
    // Mobile clients have no cookie jar and send `Authorization: Bearer <token>`
    // directly. Pass it through so the Go middleware (which already accepts
    // bearer after QBL-70) can look up the session itself.
    const authz = req.headers.get("authorization");
    if (authz) forwardHeaders["authorization"] = authz;
  }

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined;

  const fetchUrl = url.pathname + url.search;

  try {
    const response = await apiFetch(fetchUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
