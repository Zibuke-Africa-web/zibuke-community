import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function adminAccess() {
  const session = await auth();
  if (!session?.user?.id) return { allowed: false, status: 401 } as const;
  const [user] = await (await getDb()).select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  return user?.role === "admin" ? { allowed: true, status: 200 } as const : { allowed: false, status: 403 } as const;
}
