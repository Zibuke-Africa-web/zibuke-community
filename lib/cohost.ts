export type CoHostMessage = { role: "user" | "assistant"; content: string };

// Retain at most two complete exchanges plus the current question.
// Enforce this on the server too: callers need not use our drawer.
export function compactCoHostMessages(messages: CoHostMessage[]): CoHostMessage[] {
  let recent = messages.slice(-5);
  while (recent.length > 1 && recent.reduce((size, message) => size + message.content.length, 0) > 6000) {
    recent = recent.slice(2);
  }
  return recent;
}

export function coHostRetrySeconds(value: string | null, now = Date.now()): number {
  if (!value?.trim()) return 60;
  const seconds = /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 && seconds < Number.MAX_SAFE_INTEGER / 1000
    ? Math.max(1, Math.ceil(seconds)) : 60;
}

export function parseCoHostMessages(value: unknown): CoHostMessage[] | null {
  if (!value || typeof value !== "object" || !("messages" in value) || !Array.isArray(value.messages)) return null;
  if (!value.messages.length || value.messages.length > 20) return null;
  let total = 0;
  const messages: CoHostMessage[] = [];
  for (const [index, message] of value.messages.entries()) {
    if (!message || typeof message !== "object" || message.role !== (index % 2 === 0 ? "user" : "assistant") || typeof message.content !== "string") return null;
    const content = message.content.trim();
    total += content.length;
    if (!content || content.length > 4000 || total > 16000) return null;
    messages.push({ role: message.role, content });
  }
  return messages.at(-1)?.role === "user" ? messages : null;
}

// The browser and route share one complete JSON response contract.
export async function readCoHostResponse(response: Response): Promise<string> {
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("content" in payload) ||
      typeof payload.content !== "string" || !payload.content.trim()) {
    throw new Error("Co-Host returned an invalid reply. Please try again.");
  }
  return payload.content.trim();
}
