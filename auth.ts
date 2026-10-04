import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Facebook from "next-auth/providers/facebook";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });

  // Fallback to older variable names so the login works regardless of what is saved in Cloudflare
  const facebookId = env.AUTH_FACEBOOK_ID || env.FACEBOOK_CLIENT_ID || env.FACEBOOK_ID;
  const facebookSecret = env.AUTH_FACEBOOK_SECRET || env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_SECRET;

  return {
    trustHost: true,
    secret: env.AUTH_SECRET,
    pages: { signIn: "/login", error: "/login" },
    session: { strategy: "database" },
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
        clientId: facebookId,
        clientSecret: facebookSecret,
      }),
    ],
  };
});