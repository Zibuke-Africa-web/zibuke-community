import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminNav } from "./admin-nav";
import { adminAccess } from "@/lib/admin-access";

export const metadata: Metadata = {
  title: "Admin · Zibuke Community",
  description: "Internal dashboard for Zibuke Community.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await adminAccess()).allowed) {
    redirect("/directory");
  }

  return <section className="space-y-5"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={18} />Administration</div><nav aria-label="Admin"><AdminNav variant="tabs" /></nav>{children}</section>;
}
