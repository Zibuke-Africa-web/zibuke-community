import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlatformShell } from "./platform-shell";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <PlatformShell userId={session?.user?.id} userName={session?.user?.name ?? "Your profile"}>{children}</PlatformShell>;
}
