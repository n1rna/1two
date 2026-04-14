import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirect legacy kim URLs off 1tt.dev.
 *
 * kim used to live at /tools/life/* (and briefly at kim.1tt.dev). It's now
 * a separate app at kim1.ai. Any old bookmark that hits this worker gets
 * permanently redirected to the equivalent kim1.ai URL.
 */
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (!p.startsWith("/tools/life")) return NextResponse.next();

  const stripped = p.replace(/^\/tools\/life/, "") || "/";
  const target = new URL(stripped, "https://kim1.ai");
  target.search = req.nextUrl.search;
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/tools/life/:path*"],
};
