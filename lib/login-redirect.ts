export function loginDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/feed";
  try {
    const url = new URL(value, "https://zibuke.invalid");
    if (url.origin !== "https://zibuke.invalid") return "/feed";
    if (!/^\/(feed|directory|groups|events|profile|friends|messages|settings|dashboard|users)(\/|$)/.test(url.pathname)) return "/feed";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/feed";
  }
}
