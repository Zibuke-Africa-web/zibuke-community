export const eventFilters = ["All Events", "GreenSpace Sessions", "Founder Teardowns", "General"] as const;
export type EventFilter = typeof eventFilters[number];
export function eventCategory(slug: string | null) {
  return slug === "greenspace-hub" ? "GreenSpace Sessions" : ["builders-lab", "bulletproof-venture"].includes(slug || "") ? "Founder Teardowns" : "General";
}
export function whatsappUrl(input: string | null) {
  if (!input) return null;
  let digits = input.replace(/[\s()+.-]/g, "");
  if (/^0\d{9}$/.test(digits)) digits = `27${digits.slice(1)}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  return /^[1-9]\d{7,14}$/.test(digits) ? `https://wa.me/${digits}` : null;
}
export function safeHttps(input: string | null) {
  if (!input) return null;
  try { const url = new URL(input); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
export type Champion = { id: string; name: string | null; image: string | null; points: number; currentStreak: number; badgeTitle: string | null };
