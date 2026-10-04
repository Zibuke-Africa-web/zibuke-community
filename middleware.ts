import { NextResponse } from "next/server";
import { auth } from "@/auth";

// 1. Define the Auth.js logic as a separate variable
const authMiddleware = auth((req) => {
  if (!req.auth?.user?.id) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

// 2. Export an EXPLICIT function to satisfy OpenNext's strict parser
export default async function middleware(req: any) {
  // @ts-ignore
  return authMiddleware(req);
}

export const config = {
  matcher: [
    "/", "/feed/:path*", "/directory/:path*", "/groups/:path*",
    "/events/:path*", "/profile/:path*", "/friends/:path*",
    "/messages/:path*", "/settings/:path*", "/dashboard/:path*",
    "/users/:path*", "/media/:path*",
  ],
};