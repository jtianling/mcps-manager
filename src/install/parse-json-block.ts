export interface JsonBlockCandidate {
  readonly source: "mcpServers" | "bare";
  readonly name: string | undefined;
  readonly transport: "stdio" | "http";
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly envKeys: readonly string[];
}

const FENCE_RE = /```(?:json|jsonc|json5)?\s*\n([\s\S]*?)```/g;

export function parseJsonBlocks(markdown: string): JsonBlockCandidate[] {
  const out: JsonBlockCandidate[] = [];
  for (const match of markdown.matchAll(FENCE_RE)) {
    const body = (match[1] ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const obj = parsed as Record<string, unknown>;
    const servers = obj["mcpServers"];
    if (servers && typeof servers === "object") {
      for (const [name, cfg] of Object.entries(servers as Record<string, unknown>)) {
        const candidate = classifyConfig(name, cfg);
        if (candidate) out.push({ ...candidate, source: "mcpServers" });
      }
      continue;
    }
    const candidate = classifyConfig(undefined, obj);
    if (candidate) out.push({ ...candidate, source: "bare" });
  }
  return out;
}

function classifyConfig(
  name: string | undefined,
  raw: unknown,
): Omit<JsonBlockCandidate, "source"> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const cfg = raw as Record<string, unknown>;
  const command = typeof cfg["command"] === "string" ? (cfg["command"] as string) : undefined;
  const url =
    typeof cfg["url"] === "string"
      ? (cfg["url"] as string)
      : typeof cfg["serverUrl"] === "string"
        ? (cfg["serverUrl"] as string)
        : undefined;
  const envObj = cfg["env"];
  const envKeys =
    envObj && typeof envObj === "object"
      ? Object.keys(envObj as Record<string, unknown>)
      : [];
  if (command) {
    const args = Array.isArray(cfg["args"])
      ? ((cfg["args"] as unknown[]).filter((a) => typeof a === "string") as string[])
      : [];
    return { name, transport: "stdio", command, args, envKeys };
  }
  if (url) {
    const headersRaw = cfg["headers"];
    const headers =
      headersRaw && typeof headersRaw === "object"
        ? (headersRaw as Record<string, string>)
        : {};
    return { name, transport: "http", url, headers, envKeys };
  }
  return undefined;
}
