import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_FLAG = "cor_logged_in";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/certificates",
  "/users",
  "/grading",
  "/skills",
  "/courses",
  "/reports",
  "/catalog",
  "/announcements",
  "/community",
  "/learning-paths",
  "/enrollments",
  "/organization",
  "/analytics",
  "/question-banks",
  "/learn",
  "/platform",
];

function isProtected(pathname: string): boolean {
  if (pathname === "/platform/login" || pathname.startsWith("/platform/login/")) return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  if (!isProtected(request.nextUrl.pathname)) return NextResponse.next();
  if (request.cookies.get(AUTH_FLAG)?.value === "1") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = request.nextUrl.pathname.startsWith("/platform") ? "/platform/login" : "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/certificates/:path*",
    "/users/:path*",
    "/grading/:path*",
    "/skills/:path*",
    "/courses/:path*",
    "/reports/:path*",
    "/catalog/:path*",
    "/announcements/:path*",
    "/community/:path*",
    "/learning-paths/:path*",
    "/enrollments/:path*",
    "/organization/:path*",
    "/analytics/:path*",
    "/question-banks/:path*",
    "/learn/:path*",
    "/platform/:path*",
    "/dashboard",
    "/settings",
    "/certificates",
    "/users",
    "/courses",
    "/learn",
    "/platform",
  ],
};
