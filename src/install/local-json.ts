import type { ServerDefinition, DefaultConfig } from "../types.js";
import { claudeCodeAdapter } from "../adapters/claude-code.js";
import { opencodeAdapter } from "../adapters/opencode.js";
import { antigravityAdapter } from "../adapters/antigravity.js";

export function sniffLocalJson(raw: unknown): ServerDefinition[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("No recognizable MCP server shape (not an object)");
  }
  const obj = raw as Record<string, unknown>;

  if (isServerDefinition(obj)) {
    return [
      {
        name: obj["name"] as string,
        source: typeof obj["source"] === "string" ? (obj["source"] as string) : "local",
        default: obj["default"] as DefaultConfig,
        overrides: (obj["overrides"] as ServerDefinition["overrides"]) ?? {},
      },
    ];
  }

  const mcpServers = obj["mcpServers"];
  if (mcpServers && typeof mcpServers === "object") {
    const entries = Object.entries(mcpServers as Record<string, unknown>);
    return entries.map(([name, entry]) => {
      const cfg =
        antigravityAdapter.fromAgentFormat(name, entry as Record<string, unknown>) ??
        claudeCodeAdapter.fromAgentFormat(name, entry as Record<string, unknown>);
      if (!cfg) throw new Error(`Cannot parse mcpServers entry "${name}"`);
      return { name, source: "local", default: cfg, overrides: {} };
    });
  }

  const mcp = obj["mcp"];
  if (mcp && typeof mcp === "object") {
    const entries = Object.entries(mcp as Record<string, unknown>);
    return entries.map(([name, entry]) => {
      const cfg = opencodeAdapter.fromAgentFormat(name, entry as Record<string, unknown>);
      if (!cfg) throw new Error(`Cannot parse mcp entry "${name}"`);
      return { name, source: "local", default: cfg, overrides: {} };
    });
  }

  throw new Error(
    "No recognizable MCP server shape (tried ServerDefinition, mcpServers, mcp)",
  );
}

function isServerDefinition(obj: Record<string, unknown>): boolean {
  return (
    typeof obj["name"] === "string" &&
    typeof obj["default"] === "object" &&
    obj["default"] !== null
  );
}
