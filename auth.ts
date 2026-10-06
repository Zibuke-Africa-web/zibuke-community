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
        clientId: env.AUTH_GOOGLE_ID as string,
        clientSecret: env.AUTH_GOOGLE_SECRET as string,
      }),
      LinkedIn({
        clientId: env.AUTH_LINKEDIN_ID as string,
        clientSecret: env.AUTH_LINKEDIN_SECRET as string,
        authorization: { params: { scope: "openid profile email" } },
      }),
      // The built-in Resend provider sends via HTTPS fetch, not SMTP sockets.
      Resend({
        apiKey: env.AUTH_RESEND_KEY as string,
        from: env.AUTH_RESEND_FROM as string,
        maxAge: 60 * 30,
      }),
    ],
  };
});
