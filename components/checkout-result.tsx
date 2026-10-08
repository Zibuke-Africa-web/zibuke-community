import Link from "next/link";
import { auth } from "@/auth";
import { checkoutStatus } from "@/lib/checkout-status";
import { isPaidSlug } from "@/lib/payments";
import { CheckoutFeedback } from "@/components/checkout-feedback";
export async function CheckoutResult({ params, cancelled = false }: { params: { space?: string; order?: string }; cancelled?: boolean }) {
  const userId = (await auth())?.user?.id;
  const slug = isPaidSlug(params.space) ? params.space : null;
  const validOrder = params.order && /^[a-zA-Z0-9-]{1,100}$/.test(params.order) ? params.order : undefined;
  const result = userId && slug && validOrder ? await checkoutStatus(userId, slug, validOrder).catch(() => null) : null;
  const paid = result?.status === "paid";
  return <section className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-slate-300 bg-white p-8 text-slate-900"><span className="rounded-full bg-[#ccff00] px-3 py-1 text-sm font-bold text-black">Your membership</span><h1 className="text-3xl font-black">{paid ? "Payment confirmed" : cancelled ? "Checkout was not completed" : "Check your payment"}</h1><p className="leading-7">{result?.message || "Returning from checkout does not confirm a charge. Check your membership or contact support before paying again if you were charged."}</p>{slug && <CheckoutFeedback slug={slug} />}<div className="flex flex-wrap gap-3"><Link href="/feed" className="rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">Return to Community Feed</Link><Link href={slug ? `/spaces/${slug}` : "/spaces"} className="rounded-full border border-black bg-white px-5 py-3 font-bold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">{slug ? "View membership" : "Explore spaces"}</Link></div></section>;
}
