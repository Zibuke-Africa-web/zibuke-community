import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminNav } from "./admin-nav";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Admin · Zibuke Community",
  description: "Internal dashboard for Zibuke Community.",
};

async function isAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const db = await getDb();
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  return user?.role === "admin";
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) {
    redirect("/directory");
  }

  return <section className="space-y-5"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={18} />Administration</div><nav aria-label="Admin"><AdminNav variant="tabs" /></nav>{children}</section>;
}
