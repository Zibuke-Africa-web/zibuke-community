import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export async function middleware(request: NextRequest) {
  // Call auth() directly to get the session inside a standard function
  const session = await auth();
  
  if (!session?.user?.id) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/", "/feed/:path*", "/directory/:path*", "/groups/:path*",
    "/events/:path*", "/profile/:path*", "/friends/:path*",
    "/messages/:path*", "/settings/:path*", "/dashboard/:path*",
    "/users/:path*", "/media/:path*",
  ],
};