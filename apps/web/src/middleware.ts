import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based routing for the Kim subdomain.
 *
 * - On `kim.1tt.dev` (and `kim.localhost` for dev), `/foo` is rewritten
 *   internally to `/tools/life/foo` so the physical file tree doesn't need
 *   to change. `usePathname()` still returns the clean visible URL.
 * - On the main domain, any request for `/tools/life/*` is redirected to
 *   the Kim subdomain so old bookmarks keep working.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const isKim = isKimHost(host);

  const p = req.nextUrl.pathname;

  // Always pass through API / static / auth / Next internals.
  if (
    p.startsWith("/api/") ||
    p.startsWith("/_next/") ||
    p.startsWith("/favicon") ||
    p.startsWith("/public/")
  ) {
    return NextResponse.next();
  }

  if (isKim) {
    // Shared auth pages live at the root of the main app tree. Let them
    // through unchanged so the kim subdomain can render them directly.
    if (
      p === "/login" ||
      p === "/signup" ||
      p === "/register" ||
      p.startsWith("/login/") ||
      p.startsWith("/signup/") ||
      p.startsWith("/register/")
    ) {
      return NextResponse.next();
    }

    // Rewrite clean URLs to the internal /tools/life/* tree.
    if (!p.startsWith("/tools/life")) {
      const url = req.nextUrl.clone();
      url.pathname = p === "/" ? "/tools/life" : `/tools/life${p}`;
      return NextResponse.rewrite(url);
    }
    // Already an internal path — pass through.
    return NextResponse.next();
  }

  // Main domain: redirect legacy /tools/life/* URLs to the Kim subdomain.
  if (p.startsWith("/tools/life")) {
    const stripped = p.replace(/^\/tools\/life/, "") || "/";
    const kimOrigin = resolveKimOrigin(host);
    const target = new URL(stripped, kimOrigin);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

function isKimHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "kim.1tt.dev" ||
    h.startsWith("kim.") ||
    h.startsWith("kim-") // preview deploys like kim-pr-123.vercel.app
  );
}

function resolveKimOrigin(currentHost: string): string {
  // Production — always canonical kim subdomain.
  if (currentHost.endsWith("1tt.dev") || currentHost.endsWith("1two.dev")) {
    return "https://kim.1tt.dev";
  }
  const [hostname, port] = currentHost.split(":");
  const portSuffix = port ? `:${port}` : "";
  const protocol = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".lvh.me") || hostname === "lvh.me"
    ? "http"
    : "https";
  // Preserve whichever dev host family the user is on (lvh.me or localhost).
  if (hostname.endsWith("lvh.me")) {
    return `${protocol}://kim.lvh.me${portSuffix}`;
  }
  return `${protocol}://kim.localhost${portSuffix}`;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/* (handled in middleware explicitly)
     * - /_next/* (Next internals)
     * - static files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
