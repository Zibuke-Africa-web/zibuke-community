export type Gateway = "peach_payments" | "ikhokha";
export const membershipPlans = {
  "greenspace-hub": { name: "GreenSpace Hub", currency: "ZAR", monthly: 5000, annual: 30000, perks: ["South African plant diagnostics", "Seasonal workshops", "Community garden advice"] },
  "builders-lab": { name: "Community Builders Lab", currency: "USD", monthly: 12000, annual: 70000, perks: ["Founder teardowns", "Working sessions", "Builder community"] },
  "bulletproof-venture": { name: "Bulletproof Venture Collective", currency: "USD", monthly: 4900, annual: 25000, perks: ["Venture discussions", "Live expert sessions", "Peer accountability"] },
} as const;
export type PaidSlug = keyof typeof membershipPlans;
export function isPaidSlug(value: unknown): value is PaidSlug { return typeof value === "string" && Object.hasOwn(membershipPlans, value); }
export function nextMonth(date: Date) {
  const next = new Date(date); const day = next.getUTCDate(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 1);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(); next.setUTCDate(Math.min(day, last)); return next;
}
export function peachSuccess(code: string) { return /^(000\.000\.|000\.100\.1|000\.[36])/.test(code); }
export function moneyCents(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split("."); return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}
export async function hmacHex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function constantEqual(expected: string, actual: string) {
  if (expected.length !== actual.length) return false;
  let difference = 0; for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i); return difference === 0;
}
export function ikSigningPayload(path: string, raw: string) { return (path + raw).replace(/[\\"']/g, "\\$&").replace(/\u0000/g, "\\0"); }
export async function readLimitedBody(request: Request, maxBytes = 65536) {
  if (!request.body) return "";
  const reader = request.body.getReader(); const decoder = new TextDecoder(); let size = 0; let text = "";
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > maxBytes) throw new Error("Request too large"); text += decoder.decode(chunk.value, { stream: true }); } return text + decoder.decode(); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
