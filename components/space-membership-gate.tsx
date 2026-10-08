import { auth } from "@/auth";
import { getSpaceAccess } from "@/lib/space-access";
import { SpacePaywall } from "@/components/space-paywall";
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { SubscriptionControls } from "@/components/subscription-controls";
import { CheckoutFeedback } from "@/components/checkout-feedback";

export async function SpaceMembershipGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const userId = (await auth())?.user?.id;
  const { space, allowed } = await getSpaceAccess(slug, userId);
  if (!space) return <p role="alert" className="rounded-xl border border-black bg-white p-6 text-black">This space is not available yet.</p>;
  if (!allowed) return <SpacePaywall space={space} signedIn={!!userId} />;
  const [monthly] = userId ? await (await getDb()).select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.spaceSlug, slug), eq(subscriptions.status, "active"), eq(subscriptions.billingCycle, "monthly"), gt(subscriptions.currentPeriodEnd, new Date()))).limit(1) : [];
  return <><CheckoutFeedback slug={slug} />{monthly && <SubscriptionControls id={monthly.id} end={monthly.currentPeriodEnd.toISOString()} />}{children}</>;
}
