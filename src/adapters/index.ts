import { existsSync } from "node:fs";
import type { AgentAdapter, AgentId } from "../types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { codexCliAdapter } from "./codex-cli.js";
import { geminiCliAdapter } from "./gemini-cli.js";
import { opencodeAdapter } from "./opencode.js";
import { antigravityAdapter } from "./antigravity.js";
import { openclawAdapter } from "./openclaw.js";

export const allAdapters: readonly AgentAdapter[] = [
  claudeCodeAdapter,
  codexCliAdapter,
  geminiCliAdapter,
  opencodeAdapter,
  antigravityAdapter,
  openclawAdapter,
];

export function getAdapter(id: AgentId): AgentAdapter {
  const adapter = allAdapters.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(`Unknown agent: ${id}`);
  }
  return adapter;
}

export function detectAgents(projectDir: string): AgentAdapter[] {
  return allAdapters.filter((adapter) => {
    if (adapter.isGlobal) {
      return existsSync(adapter.configPath(projectDir));
    }
    return existsSync(adapter.configPath(projectDir));
  });
}
