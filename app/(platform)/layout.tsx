import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlatformShell } from "./platform-shell";
import { getActiveSpark } from "@/lib/daily-spark-server";
import { getLeaderboard } from "@/actions/gamification";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [spark, champions] = await Promise.all([getActiveSpark(), getLeaderboard()]);
  return <PlatformShell spark={spark} champions={champions} userId={session?.user?.id} userName={session?.user?.name ?? "Your profile"}>{children}</PlatformShell>;
}
