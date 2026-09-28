export type AIInsight = {
  id: string;
  title: string;
  summary: string;
  isMock: boolean;
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function fetchCustomAIInsight(prompt: string): Promise<AIInsight> {
  const normalized = prompt.trim();

  if (normalized.length === 0) {
    throw new Error("fetchCustomAIInsight requires a non-empty prompt.");
  }

  return {
    id: `mock-insight-${toSlug(normalized) || "empty"}`,
    title: "Mock insight",
    summary: `Placeholder analysis for "${normalized}". Replace fetchCustomAIInsight with a real model call when the Zibuke AI service is connected.`,
    isMock: true,
  };
}
