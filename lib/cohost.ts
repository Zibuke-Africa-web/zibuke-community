export type CoHostMessage = { role: "user" | "assistant"; content: string };

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
