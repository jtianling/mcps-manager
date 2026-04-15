import { confirm } from "@inquirer/prompts";
import type { DefaultConfig, ServerDefinition } from "../types.js";
import { readGlobalConfig } from "../utils/config.js";
import {
  listServerDefinitions,
  readServerDefinition,
  serverExists,
  writeServerDefinition,
} from "../utils/server-store.js";
import {
  buildUserMessage,
  analyzeWithGlm,
  type AnalysisResult,
} from "../services/glm-client.js";
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
  if (name) {
    await updateSingleLegacy(name);
  } else {
    await updateAllLegacy();
  }
}

import type { AnalysisResult as RuleAnalysisResult } from "../install/analyze.js";

export interface UpdateSingleDeps {
  serverExists: (name: string) => boolean;
  readServerDefinition: (name: string) => Promise<ServerDefinition | undefined>;
  analyze: (source: string) => Promise<RuleAnalysisResult>;
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
    try {
      const res = await deps.updateSingle(d.name);
      if (res === "updated") updated++;
      else skipped++;
    } catch {
      failed++;
    }
  }
  return { updated, skipped, failed };
}

async function updateSingleLegacy(name: string): Promise<void> {
  if (!serverExists(name)) {
    console.error(`Error: Server "${name}" not found in central repository.`);
    process.exitCode = 1;
    return;
  }

  const definition = await readServerDefinition(name);
  if (!definition) {
    console.error(`Error: Failed to read server definition for "${name}".`);
    process.exitCode = 1;
    return;
  }

  if (!definition.source || definition.source === "local") {
    console.log(
      `Server "${name}" has no remote source. Cannot auto-update.`,
    );
    return;
  }

  const config = await readGlobalConfig();
  const result = await analyzeAndUpdate(config, definition);
  if (result === "updated") {
    console.log(`Server "${name}" updated.`);
  } else if (result === "skipped") {
    console.log(`Server "${name}" is up to date.`);
  }
}

async function updateAllLegacy(): Promise<void> {
  const servers = await listServerDefinitions();
  if (servers.length === 0) {
    console.log(
      'No servers in central repository. Use "mcpsmgr install" to add one.',
    );
    return;
  }

  const updatable = servers.filter(
    (s) => s.source && s.source !== "local",
  );

  if (updatable.length === 0) {
    console.log("No servers with remote sources to update.");
    return;
  }

  const config = await readGlobalConfig();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const server of updatable) {
    console.log(`\nChecking "${server.name}"...`);
    try {
      const result = await analyzeAndUpdate(config, server);
      if (result === "updated") {
        updated++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(
        `  Failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      failed++;
    }
  }

  console.log(
    `\nUpdate complete: ${updated} updated, ${skipped} up-to-date, ${failed} failed.`,
  );
}

async function analyzeAndUpdate(
  globalConfig: Awaited<ReturnType<typeof readGlobalConfig>>,
  definition: ServerDefinition,
): Promise<"updated" | "skipped"> {
  console.log(`  Analyzing "${definition.source}" with GLM5...`);
  const userMessage = buildUserMessage(definition.source);
  const analysis = await analyzeWithGlm(globalConfig, userMessage);

  const newDefault = buildDefaultConfig(analysis);
  const merged = mergeEnvValues(definition.default, newDefault);

  if (!hasChanges(definition.default, merged, definition.overrides, analysis.overrides)) {
    return "skipped";
  }

  displayChanges(definition, merged, analysis);

  const proceed = await confirm({
    message: `Update "${definition.name}"?`,
  });

  if (!proceed) {
    return "skipped";
  }

  const updated: ServerDefinition = {
    name: definition.name,
    source: definition.source,
    default: merged,
    overrides: analysis.overrides as ServerDefinition["overrides"],
  };

  await writeServerDefinition(updated);
  return "updated";
}

function buildDefaultConfig(analysis: AnalysisResult): DefaultConfig {
  if (analysis.default.transport === "stdio") {
    return {
      transport: "stdio",
      command: analysis.default.command ?? "",
      args: [...(analysis.default.args ?? [])],
      env: { ...(analysis.default.env ?? {}) },
    };
  }
  return {
    transport: "http",
    url: analysis.default.url ?? "",
    headers: { ...(analysis.default.headers ?? {}) },
  };
}

function mergeEnvValues(
  oldConfig: DefaultConfig,
  newConfig: DefaultConfig,
): DefaultConfig {
  if (oldConfig.transport !== "stdio" || newConfig.transport !== "stdio") {
    return newConfig;
  }

  const mergedEnv: Record<string, string> = { ...newConfig.env };
  for (const [key, value] of Object.entries(oldConfig.env)) {
    if (key in mergedEnv) {
      mergedEnv[key] = value;
    }
  }

  return {
    ...newConfig,
    env: mergedEnv,
  };
}

function hasChanges(
  oldDefault: DefaultConfig,
  newDefault: DefaultConfig,
  oldOverrides: ServerDefinition["overrides"],
  newOverrides: AnalysisResult["overrides"],
): boolean {
  return (
    JSON.stringify(oldDefault) !== JSON.stringify(newDefault) ||
    JSON.stringify(oldOverrides) !== JSON.stringify(newOverrides)
  );
}

function displayChanges(
  old: ServerDefinition,
  newDefault: DefaultConfig,
  analysis: AnalysisResult,
): void {
  console.log("\n  --- Changes ---");
  if (old.default.transport !== newDefault.transport) {
    console.log(
      `  Transport: ${old.default.transport} -> ${newDefault.transport}`,
    );
  }
  if (
    old.default.transport === "stdio" &&
    newDefault.transport === "stdio"
  ) {
    if (old.default.command !== newDefault.command) {
      console.log(
        `  Command: ${old.default.command} -> ${newDefault.command}`,
      );
    }
    if (
      JSON.stringify(old.default.args) !== JSON.stringify(newDefault.args)
    ) {
      console.log(`  Args: ${JSON.stringify(newDefault.args)}`);
    }

    const oldEnvKeys = Object.keys(old.default.env);
    const newEnvKeys = Object.keys(
      newDefault.transport === "stdio" ? newDefault.env : {},
    );
    const addedKeys = newEnvKeys.filter((k) => !oldEnvKeys.includes(k));
    if (addedKeys.length > 0) {
      console.log(`  New env vars: ${addedKeys.join(", ")}`);
    }
  }
  if (
    JSON.stringify(old.overrides) !== JSON.stringify(analysis.overrides)
  ) {
    console.log("  Overrides changed");
  }
  console.log("  ---\n");
}
