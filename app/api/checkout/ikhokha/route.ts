import { createCheckout } from "@/lib/payment-server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return createCheckout(request, "ikhokha"); }
