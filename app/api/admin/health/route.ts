import { adminAccess } from "@/lib/admin-access";
import { operatorHealth } from "@/lib/operator-health";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const access = await adminAccess();
    if (!access.allowed) return Response.json({ error: "Admin access required" }, { status: access.status, headers });
    return Response.json(await operatorHealth(), { headers });
  } catch { return Response.json({ error: "Health checks are unavailable" }, { status: 503, headers }); }
}
