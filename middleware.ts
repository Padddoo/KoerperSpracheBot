import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/favicon.ico",
  "/icon.svg",
  "/manifest.webmanifest",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const expected = process.env.ACCESS_CODE;
  // Wenn kein ACCESS_CODE gesetzt ist, App offen (lokale Dev-Umgebung ohne Code)
  if (!expected) return NextResponse.next();

  const cookie = request.cookies.get("fred-auth")?.value;
  if (cookie === expected) return NextResponse.next();

  // API-Requests antworten mit 401, keine Redirects
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
