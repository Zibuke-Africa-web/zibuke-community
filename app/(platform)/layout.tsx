import { auth } from "@/auth";
import { PlatformShell } from "./platform-shell";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return <PlatformShell userId={session?.user?.id} userName={session?.user?.name ?? "Your profile"}>{children}</PlatformShell>;
}
