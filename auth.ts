import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Instagram from "next-auth/providers/instagram";
import TikTok from "next-auth/providers/tiktok";
import Resend from "next-auth/providers/resend";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });

  return {
    trustHost: true,
    secret: env.AUTH_SECRET,
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
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      }),
      Facebook({
        clientId: env.AUTH_FACEBOOK_ID,
        clientSecret: env.AUTH_FACEBOOK_SECRET,
      }),
      Instagram({
        clientId: env.AUTH_INSTAGRAM_ID,
        clientSecret: env.AUTH_INSTAGRAM_SECRET,
      }),
      TikTok({
        clientId: env.AUTH_TIKTOK_ID,
        clientSecret: env.AUTH_TIKTOK_SECRET,
      }),
      Resend({
        apiKey: env.AUTH_RESEND_KEY,
        from: env.AUTH_RESEND_FROM,
      }),
    ],
  };
});
