import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function OwnProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=%2Fprofile");
  redirect(`/profile/${encodeURIComponent(session.user.id)}`);
}
