export function safeWebUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function parseProfileInput(form: FormData) {
  const bio = form.get("bio");
  const website = form.get("websiteUrl");
  const links = form.get("socialLinks");
  if (typeof bio !== "string" || bio.length > 1000) throw new Error("Keep your bio to 1,000 characters.");
  if (typeof website !== "string") throw new Error("Enter a valid website URL.");
  const websiteUrl = website.trim() ? safeWebUrl(website.trim()) : null;
  if (website.trim() && !websiteUrl) throw new Error("Use a full http:// or https:// website URL.");
  if (typeof links !== "string" || links.length > 24000) throw new Error("Add up to 10 social links.");
  let parsed: unknown;
  try { parsed = JSON.parse(links); } catch { throw new Error("Social links could not be read."); }
  if (!Array.isArray(parsed) || parsed.length > 10) throw new Error("Add up to 10 social links.");
  const entries: [string, string][] = [];
  const names = new Set<string>();
  for (const row of parsed) {
    if (!row || typeof row !== "object" || typeof row.platform !== "string" || typeof row.url !== "string") throw new Error("Each social link needs a name and URL.");
    const platform = row.platform.trim().toLowerCase();
    if (!platform && !row.url.trim()) continue;
    if (!/^[a-z][a-z0-9 ._-]{0,39}$/.test(platform) || ["constructor", "prototype", "__proto__"].includes(platform)) throw new Error("Use a short platform name, such as Instagram.");
    const url = safeWebUrl(row.url.trim());
    if (!url) throw new Error(`Use a full http:// or https:// URL for ${platform}.`);
    if (names.has(platform)) throw new Error(`Add only one ${platform} link.`);
    names.add(platform);
    entries.push([platform, url]);
  }
  return { bio: bio.trim() || null, websiteUrl, socialLinks: Object.fromEntries(entries) as Record<string, string> };
}
