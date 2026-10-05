import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlatformShell } from "./platform-shell";
import { getActiveSpark } from "@/lib/daily-spark-server";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const spark = await getActiveSpark();
  return <PlatformShell spark={spark} userId={session?.user?.id} userName={session?.user?.name ?? "Your profile"}>{children}</PlatformShell>;
}
