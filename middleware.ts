import { NextResponse, type NextRequest } from "next/server";

// Access control.
// - Sample/demo mode (no WEBCRM_TOKEN): public, nothing to protect.
// - Live mode (WEBCRM_TOKEN set): every page and API route requires
//   DASHBOARD_PASSWORD (browser basic-auth prompt, any username).
//   If the password is missing the app fails closed instead of exposing CRM data.
export function middleware(req: NextRequest) {
  const live = !!process.env.WEBCRM_TOKEN;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!live && !password) return NextResponse.next();
  if (live && !password) {
    return new NextResponse("Live CRM mode is locked: set DASHBOARD_PASSWORD to enable access.", { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Account Growth"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
