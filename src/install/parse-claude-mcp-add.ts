import { tokenize } from "./shell-tokenize.js";

export interface ClaudeMcpAddResult {
  readonly name: string;
  readonly transport: "stdio" | "http";
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly envKeys: readonly string[];
}

const FENCE_RE = /```[^\n]*\n([\s\S]*?)```/g;

export function parseClaudeMcpAdd(markdown: string): ClaudeMcpAddResult | undefined {
  for (const match of markdown.matchAll(FENCE_RE)) {
    const body = match[1] ?? "";
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!/^claude\s+mcp\s+add\b/.test(trimmed)) continue;
      const result = parseLine(trimmed);
      if (result) return result;
    }
  }
  return undefined;
}

function parseLine(line: string): ClaudeMcpAddResult | undefined {
  const tokens = tokenize(line);
  let i = 3; // skip "claude", "mcp", "add"
  const positionals: string[] = [];
  const envKeys: string[] = [];
  let transport: "stdio" | "http" = "stdio";
  let url: string | undefined;
  let sawDoubleDash = false;

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (sawDoubleDash) {
      positionals.push(t);
      i++;
      continue;
    }
    if (t === "--") {
      sawDoubleDash = true;
      i++;
      continue;
    }
    if (t === "-e" || t === "--env") {
      const pair = tokens[i + 1] ?? "";
      const key = pair.split("=")[0];
      if (key) envKeys.push(key);
      i += 2;
      continue;
    }
    if (t === "-t" || t === "--transport") {
      const v = tokens[i + 1];
      if (v === "http" || v === "sse") transport = "http";
      i += 2;
      continue;
    }
    if (t === "--url") {
      url = tokens[i + 1];
      i += 2;
      continue;
    }
    if (t.startsWith("-")) {
      i += 2;
      continue;
    }
    positionals.push(t);
    i++;
  }

  const name = positionals[0];
  if (!name) return undefined;
  if (transport === "http") {
    return { name, transport: "http", url, headers: {}, envKeys };
  }
  const command = positionals[1];
  if (!command) return undefined;
  const args = positionals.slice(2);
  return { name, transport: "stdio", command, args, envKeys };
}
