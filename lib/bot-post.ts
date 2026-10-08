import { normalizeSpaceContent } from "@/lib/space-post-input";

export const PULSE_EMAIL = "pulse@zibukecommunity.co.za";
export const PULSE_ID = "system-zibuke-pulse";

function optional(input: Record<string, unknown>, key: string, max: number) {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Invalid ${key}`);
  return value.trim() || undefined;
}

function httpsUrl(value: string | undefined) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use an HTTPS URL");
  return url.href;
}

export function parseBotPost(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid payload");
  const input = value as Record<string, unknown>;
  const content = normalizeSpaceContent(input.content);
  if (!content || content.length < 10) throw new Error("Content must contain 10–5,000 characters");
  const title = optional(input, "title", 200);
  const category = optional(input, "category", 80);
  const sourceUrl = httpsUrl(optional(input, "sourceUrl", 2048));
  // SVG is supported as a hosted image URL, never as executable inline markup/data.
  const authorAvatar = httpsUrl(optional(input, "authorAvatar", 2048));
  const authorName = optional(input, "authorName", 100);
  const requestedSlug = optional(input, "spaceSlug", 100) || "general";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedSlug)) throw new Error("Invalid spaceSlug");
  const formatted = [title, category ? `Category: ${category}` : undefined, content, sourceUrl ? `Source: ${sourceUrl}` : undefined].filter(Boolean).join("\n\n");
  if (formatted.length > 5000) throw new Error("Post including headline and attribution must not exceed 5,000 characters");
  return { content: formatted, spaceSlug: requestedSlug === "general" ? "welcome" : requestedSlug, authorName, authorAvatar };
}
