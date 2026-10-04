import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";

const SAFE_KEY = /^uploads\/[A-Za-z0-9._-]+$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (!(await auth())?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { key } = await params;
  const objectKey = key.join("/");

  if (!SAFE_KEY.test(objectKey)) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.ZIBUKE_BUCKET.get(objectKey);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
