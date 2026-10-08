import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { posts, spaces, users } from "@/db/schema";
import { constantEqual, readLimitedBody } from "@/lib/payments";
import { parseBotPost, PULSE_EMAIL, PULSE_ID } from "@/lib/bot-post";

// OpenNext's Node runtime deploys to Workers; all request/crypto APIs are web APIs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const secret = process.env.BOT_POST_SECRET;
  const authorization = request.headers.get("authorization");
  const custom = request.headers.get("x-bot-secret");
  if (!secret || !((authorization && constantEqual(`Bearer ${secret}`, authorization)) || (custom && constantEqual(secret, custom)))) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Use application/json" }, { status: 415, headers });
  }
  let input: ReturnType<typeof parseBotPost>;
  try { input = parseBotPost(JSON.parse(await readLimitedBody(request, 65536))); }
  catch { return Response.json({ error: "Invalid post. Check field types, lengths and HTTPS URLs; total formatted text must fit 5,000 characters." }, { status: 400, headers }); }
  try {
    const db = await getDb();
    const [space] = await db.select({ id: spaces.id, slug: spaces.slug }).from(spaces).where(and(
      eq(spaces.slug, input.spaceSlug), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false),
    )).limit(1);
    if (!space) return Response.json({ error: "Public space not found" }, { status: 404, headers });
    let authors = await db.select({ id: users.id, role: users.role }).from(users).where(sql`lower(${users.email})=${PULSE_EMAIL}`).limit(2);
    if (!authors.length) {
      await db.insert(users).values({ id: PULSE_ID, email: PULSE_EMAIL, name: input.authorName || "Zibuke Pulse", image: input.authorAvatar || null, role: "system", locationCity: "" }).onConflictDoNothing();
      authors = await db.select({ id: users.id, role: users.role }).from(users).where(sql`lower(${users.email})=${PULSE_EMAIL}`).limit(2);
    }
    // Never elevate or take over an ordinary account with a matching email.
    if (authors.length !== 1 || authors[0].role !== "system") return Response.json({ error: "Bot identity needs administrator review" }, { status: 409, headers });
    const author = authors[0];
    // Optional author fields configure the shared bot profile, not per-post identities.
    if (input.authorName || input.authorAvatar) await db.update(users).set({ name: input.authorName, image: input.authorAvatar }).where(and(eq(users.id, author.id), eq(users.role, "system")));
    const id = crypto.randomUUID();
    const [created] = await db.insert(posts).select(db.select({
      id: sql<string>`${id}`.as("id"), userId: sql<string>`${author.id}`.as("user_id"), groupId: sql<null>`null`.as("group_id"), spaceId: spaces.id,
      content: sql<string>`${input.content}`.as("content"), mediaUrl: sql<null>`null`.as("media_url"), createdAt: sql<Date>`unixepoch()`.as("created_at"), updatedAt: sql<null>`null`.as("updated_at"),
    }).from(spaces).where(and(eq(spaces.id, space.id), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))))
      .returning({ id: posts.id });
    if (!created) return Response.json({ error: "Public space not found" }, { status: 404, headers });
    revalidatePath("/"); revalidatePath("/feed"); revalidatePath("/spaces"); revalidatePath(`/spaces/${space.slug}`);
    return Response.json({ success: true, postId: created.id }, { status: 201, headers });
  } catch { return Response.json({ error: "Post ingestion is unavailable" }, { status: 503, headers }); }
}

function methodNotAllowed() { return new Response(null, { status: 405, headers: { ...headers, Allow: "POST" } }); }
export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
