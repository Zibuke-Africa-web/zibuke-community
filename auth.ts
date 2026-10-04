import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Facebook from "next-auth/providers/facebook";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });

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
        // The 'as string' assertion prevents any remaining TypeScript string/undefined mismatches
        clientId: env.AUTH_FACEBOOK_ID as string,
        clientSecret: env.AUTH_FACEBOOK_SECRET as string,
      }),
    ],
  };
});