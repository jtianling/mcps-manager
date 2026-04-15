import { confirm } from "@inquirer/prompts";
import type { DefaultConfig, ServerDefinition } from "../types.js";
import {
  listServerDefinitions,
  readServerDefinition,
  serverExists,
  writeServerDefinition,
} from "../utils/server-store.js";
import {
  analyzeFromGitHub,
  type AnalysisResult,
} from "../install/analyze.js";
import { fetchGitHubReadme } from "../install/github-readme.js";
import { fetchManifestDefault } from "../install/manifest-remote.js";
import { parseGitHubSource } from "../install/source.js";
import { isUserCancellation } from "../utils/prompt.js";

export async function updateCommand(name?: string): Promise<void> {
  try {
    await updateCommandInner(name);
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function updateCommandInner(name?: string): Promise<void> {
  const deps = productionUpdateSingleDeps();
  if (name) {
    const result = await updateSingle(name, deps);
    switch (result) {
      case "missing":
        console.error(`Error: Server "${name}" not found in central repository.`);
        process.exitCode = 1;
        return;
      case "no-source":
        console.log(`Server "${name}" has no remote source. Cannot auto-update.`);
        return;
      case "updated":
        console.log(`Server "${name}" updated.`);
        return;
      case "skipped":
        console.log(`Server "${name}" is up to date.`);
        return;
    }
  }
  const summary = await updateAll({
    listServerDefinitions: async () => {
      const all = await listServerDefinitions();
      return all.filter((s) => s.source && s.source !== "local");
    },
    updateSingle: (n) => updateSingle(n, deps),
  });
  console.log(
    `\nUpdate complete: ${summary.updated} updated, ${summary.skipped} up-to-date, ${summary.failed} failed.`,
  );
}

export interface UpdateSingleDeps {
  serverExists: (name: string) => boolean;
  readServerDefinition: (name: string) => Promise<ServerDefinition | undefined>;
  analyze: (source: string) => Promise<AnalysisResult>;
  confirm: (message: string) => Promise<boolean>;
  writeServerDefinition: (def: ServerDefinition) => Promise<void>;
}

export async function updateSingle(
  name: string,
  deps: UpdateSingleDeps,
): Promise<"updated" | "skipped" | "missing" | "no-source"> {
  if (!deps.serverExists(name)) return "missing";
  const def = await deps.readServerDefinition(name);
  if (!def) return "missing";
  if (!def.source || def.source === "local") return "no-source";

  const analysis = await deps.analyze(def.source);
  const merged = mergeRuleDefault(def.default, analysis.default, analysis.requiredEnvVars);
  if (JSON.stringify(def.default) === JSON.stringify(merged)) return "skipped";
  const proceed = await deps.confirm(`Update "${name}"?`);
  if (!proceed) return "skipped";
  await deps.writeServerDefinition({ ...def, default: merged });
  return "updated";
}

function mergeRuleDefault(
  oldD: DefaultConfig,
  newD: DefaultConfig,
  requiredEnvKeys: readonly string[],
): DefaultConfig {
  if (oldD.transport !== "stdio" || newD.transport !== "stdio") return newD;
  const mergedEnv: Record<string, string> = {};
  for (const k of requiredEnvKeys) {
    mergedEnv[k] = oldD.env[k] ?? "";
  }
  for (const [k, v] of Object.entries(newD.env)) {
    if (!(k in mergedEnv)) mergedEnv[k] = v;
  }
  return { ...newD, env: mergedEnv };
}

export interface UpdateAllDeps {
  listServerDefinitions: () => Promise<readonly ServerDefinition[]>;
  updateSingle: (name: string) => Promise<"updated" | "skipped" | "missing" | "no-source">;
}

export async function updateAll(
  deps: UpdateAllDeps,
): Promise<{ updated: number; skipped: number; failed: number }> {
  const all = await deps.listServerDefinitions();
  let updated = 0,
    skipped = 0,
    failed = 0;
  for (const d of all) {
    console.log(`\nChecking "${d.name}"...`);
    try {
      const res = await deps.updateSingle(d.name);
      if (res === "updated") updated++;
      else skipped++;
    } catch (error) {
      console.error(
        `  Failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      failed++;
    }
  }
  return { updated, skipped, failed };
}

function productionUpdateSingleDeps(): UpdateSingleDeps {
  return {
    serverExists,
    readServerDefinition,
    analyze: async (source) => {
      const ref = parseGitHubSource(source);
      if (!ref) {
        throw new Error(
          `Cannot resolve source "${source}" to a GitHub repository.`,
        );
      }
      console.log(`  Fetching README from ${ref.owner}/${ref.repo}...`);
      return analyzeFromGitHub(ref, {
        fetchReadme: (r) => fetchGitHubReadme(r),
        fetchManifest: (r, name) => fetchManifestDefault(r, name),
      });
    },
    confirm: (message) => confirm({ message }),
    writeServerDefinition,
  };
}
