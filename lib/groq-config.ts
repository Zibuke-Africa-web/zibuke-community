// Keep the health probe and both agents on the same model configuration.
// Llama 3.1/3.3 are now listed as Enterprise models by Groq.
export function groqModels(env?: { GROQ_TEXT_MODEL?: string; GROQ_VISION_MODEL?: string }) {
  return {
    text: env?.GROQ_TEXT_MODEL || process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-20b",
    vision: env?.GROQ_VISION_MODEL || process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
  };
}

export function groqReasoningOptions(model: string) {
  return model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" } : {};
}
