import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import Resend from "next-auth/providers/resend";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { recordActivity } from "@/lib/gamification";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });
  const emailEnv = env as typeof env & { EMAIL_FROM?: string; RESEND_API_KEY?: string };
  // Cloudflare bindings are authoritative; .dev.vars is not a Next.js .env file.
  const configuredFrom = (emailEnv.EMAIL_FROM || process.env.EMAIL_FROM || "").trim();
  const emailFrom = (configuredFrom || "Zibuke Community <noreply@zibukeafrica.com>")
    .replace(/^([^<>]+?)\s+([^\s<>]+@[^\s<>]+)$/, "$1 <$2>");

  return {
    trustHost: true,
    secret: env.AUTH_SECRET,
    pages: { signIn: "/login", error: "/login" },
    session: { strategy: "database" },
    events: { async signIn({ user }) { if (user.id) await recordActivity(user.id).catch(() => {}); } },
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
    providers: [
      Facebook({
        // The 'as string' assertion prevents any remaining TypeScript string/undefined mismatches
        clientId: env.AUTH_FACEBOOK_ID as string,
        clientSecret: env.AUTH_FACEBOOK_SECRET as string,
      }),
      Google({
        clientId: process.env.AUTH_GOOGLE_ID || "508155139796-t8tsrimj6o873k41gods9eskauuqkv75.apps.googleusercontent.com",
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
      LinkedIn({
        clientId: process.env.AUTH_LINKEDIN_ID || "78gaenvt8cg1i0",
        clientSecret: process.env.AUTH_LINKEDIN_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: { params: { scope: "openid profile email" } },
      }),
      Resend({
        apiKey: emailEnv.AUTH_RESEND_KEY || emailEnv.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY,
        from: emailFrom,
        maxAge: 60 * 30,
      }),
    ],
  };
});
