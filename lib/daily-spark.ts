export type DailySpark = {
  id: string; topic: string; prompt: string; actionText: string;
  targetSpaceSlug: string; createdAt: string | null;
};

export const fallbackSpark: DailySpark = {
  id: "curated-welcome", topic: "Small connections, local possibilities",
  prompt: "What is one skill you could share with a neighbour, and one thing you would love to learn from someone in your community?",
  actionText: "Join today's conversation →", targetSpaceSlug: "welcome", createdAt: null,
};

export function sparkDay(date = new Date()) {
  return new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseSparkResponse(value: unknown, allowedSlugs: string[]) {
  if (typeof value !== "object" || value === null || !("response" in value) || typeof value.response !== "string") return null;
  try {
    const response = value.response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const item = JSON.parse(response) as Record<string, unknown>;
    if (!item || typeof item !== "object") return null;
    const topic = typeof item.topic === "string" ? item.topic.trim() : "";
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    const slug = typeof item.targetSpaceSlug === "string" ? item.targetSpaceSlug : "";
    if (!topic || topic.length > 100 || prompt.length < 20 || prompt.length > 600 || !allowedSlugs.includes(slug)) return null;
    if (/[<>]|https?:|www\.|\S+@\S+|\+?\d[\d ()-]{7,}\d/i.test(`${topic} ${prompt}`)) return null;
    return { topic, prompt, targetSpaceSlug: slug };
  } catch { return null; }
}
