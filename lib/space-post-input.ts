// Posts are plain text, rendered by React without HTML interpretation.
export function normalizeSpaceContent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Preserve newlines/tabs; remove non-printing control characters.
  const content = Array.from(value.replace(/\r\n?/g, "\n"))
    .filter(char => char === "\n" || char === "\t" || (char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127))
    .join("").trim();
  return content.length > 0 && content.length <= 5000 ? content : null;
}

export function safeSpaceMedia(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (/^\/media\/uploads\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function validSpaceId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
}
