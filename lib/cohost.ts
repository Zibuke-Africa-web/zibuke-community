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

// Parse Groq/OpenAI SSE across arbitrary network and UTF-8 boundaries.
export async function* readCoHostStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw new Error("STREAM_TOO_LARGE");
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        if (data === "[DONE]") return;
        const chunk = JSON.parse(data);
        if (chunk.error) throw new Error("STREAM_ERROR");
        const text = chunk.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) {
          length += text.length;
          if (length > 16000) throw new Error("STREAM_TOO_LARGE");
          yield text;
        }
      }
      if (done) throw new Error("STREAM_INTERRUPTED");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
