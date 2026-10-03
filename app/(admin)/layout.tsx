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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900 md:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-800 px-4">
          <ShieldCheck aria-hidden="true" className="size-4 text-brand-400" />
          <span className="text-sm font-semibold text-white">Zibuke</span>
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
            Admin
          </span>
        </div>
        <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto">
          <AdminNav variant="sidebar" />
        </nav>
      </aside>

      <div className="md:pl-56">
        <header className="border-b border-gray-800 bg-gray-900 md:hidden">
          <div className="flex h-12 items-center gap-2 px-3">
            <ShieldCheck aria-hidden="true" className="size-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">Zibuke</span>
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Admin
            </span>
          </div>
          <nav aria-label="Admin" className="bg-gray-950">
            <AdminNav variant="tabs" />
          </nav>
        </header>

        <main className="min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
