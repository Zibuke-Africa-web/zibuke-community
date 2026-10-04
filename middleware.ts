import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Keep the Edge middleware convention for the Cloudflare OpenNext deployment.
// Auth.js validates the opaque session token against D1, including expiry.
export default auth((request) => {
  if (!request.auth?.user?.id) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/", "/feed/:path*", "/directory/:path*", "/groups/:path*",
    "/events/:path*", "/profile/:path*", "/friends/:path*",
    "/messages/:path*", "/settings/:path*", "/dashboard/:path*",
    "/users/:path*", "/media/:path*",
  ],
};
