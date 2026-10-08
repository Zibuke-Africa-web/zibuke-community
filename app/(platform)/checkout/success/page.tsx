import { CheckoutResult } from "@/components/checkout-result";
export const dynamic = "force-dynamic";
export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ space?: string; order?: string }> }) { return <CheckoutResult params={await searchParams} />; }
