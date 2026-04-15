import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { confirm, input, password } from "@inquirer/prompts";
import type { DefaultConfig, ServerDefinition, StdioConfig } from "../types.js";
import { readGlobalConfig } from "../utils/config.js";
import {
  serverExists,
  writeServerDefinition,
} from "../utils/server-store.js";
import {
  isValidInput,
  buildUserMessage,
  analyzeWithGlm,
  type AnalysisResult as LegacyAnalysisResult,
} from "../services/glm-client.js";
import type { AnalysisResult } from "../install/analyze.js";
import { sniffLocalJson } from "../install/local-json.js";
import { detectProjectFromDir } from "../install/local-dir.js";
import { parseGitHubSource, isGitHubRepo } from "../install/source.js";
import { isUserCancellation } from "../utils/prompt.js";

type SourceType = "remote-url" | "owner-repo" | "local-path" | "local-json" | "manual";

const LOCAL_PATH_PREFIXES = ["/", "./", "../", "~/"];

function detectSourceType(input: string): SourceType {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return "remote-url";
  }

  if (input.endsWith(".json") && hasLocalPrefix(input)) {
    return "local-json";
  }

  if (hasLocalPrefix(input)) {
    return "local-path";
  }

  const parts = input.split("/");
  if (parts.length === 2 && parts.every((p) => p.length > 0) && !input.startsWith("@")) {
    return "owner-repo";
  }

  return "local-path";
}

function hasLocalPrefix(input: string): boolean {
  return input === "~" || LOCAL_PATH_PREFIXES.some((p) => input.startsWith(p));
}

export async function installCommand(
  source?: string,
  options: { force?: boolean } = {},
): Promise<void> {
  try {
    await installCommandInner(source, options);
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function installCommandInner(
  source?: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const rawInput =
    source ??
    (await input({
      message: "Enter MCP server URL, GitHub owner/repo, or local path (leave empty for manual):",
    }));

  if (rawInput.trim() === "") {
    await manualAddFlow();
    return;
  }

  const trimmed = rawInput.trim();
  const sourceType = detectSourceType(trimmed);

  switch (sourceType) {
    case "remote-url":
    case "owner-repo":
      await installFromRemoteLegacy(trimmed, options);
      break;
    case "local-json":
      await installFromJsonFile(resolve(trimmed), options);
      break;
    case "local-path":
      await installFromLocalPath(resolve(trimmed), options);
      break;
    case "manual":
      await manualAddFlow();
      break;
  }
}

export type ClassifiedInput =
  | { kind: "github"; value: string }
  | { kind: "local"; value: string }
  | { kind: "error"; reason: string };

const LOCAL_PREFIXES = ["/", "./", "../", "~/", "~"];

export function classifyInput(input: string): ClassifiedInput {
  const trimmed = input.trim();
  if (LOCAL_PREFIXES.some((p) => trimmed.startsWith(p))) {
    return { kind: "local", value: trimmed };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (parseGitHubSource(trimmed)) return { kind: "github", value: trimmed };
    return {
      kind: "error",
      reason:
        "Only GitHub URLs are supported for remote install. Use ./path.json for other sources.",
    };
  }
  if (isGitHubRepo(trimmed)) return { kind: "github", value: trimmed };
  return {
    kind: "error",
    reason:
      'Invalid input. Provide a GitHub URL (https://github.com/owner/repo), owner/repo shortname, or a local path (./file.json | ./dir).',
  };
}

export interface InstallFromRemoteDeps {
  analyze: (input: string) => Promise<AnalysisResult>;
  confirm: (message: string) => Promise<boolean>;
  askEnvValue: (key: string) => Promise<string>;
  serverExists: (name: string) => boolean;
  writeServerDefinition: (def: ServerDefinition) => Promise<void>;
  fallbackToManual: () => Promise<void>;
}

export async function installFromRemote(
  input: string,
  deps: InstallFromRemoteDeps,
): Promise<void> {
  let analysis: AnalysisResult;
  try {
    analysis = await deps.analyze(input);
  } catch {
    const go = await deps.confirm(
      `Rule-based analysis could not extract MCP config from ${input}. Configure manually instead?`,
    );
    if (go) await deps.fallbackToManual();
    return;
  }
  const trusted = await deps.confirm(`Trust this analysis result?`);
  if (!trusted) {
    const go = await deps.confirm("Configure manually instead?");
    if (go) await deps.fallbackToManual();
    return;
  }
  if (deps.serverExists(analysis.name)) {
    const overwrite = await deps.confirm(
      `Server "${analysis.name}" already exists. Overwrite?`,
    );
    if (!overwrite) return;
  }
  const env: Record<string, string> = {};
  for (const k of analysis.requiredEnvVars) env[k] = await deps.askEnvValue(k);
  const base = analysis.default;
  const merged: DefaultConfig =
    base.transport === "stdio"
      ? ({ ...base, env: { ...base.env, ...env } } satisfies StdioConfig)
      : base;
  const def: ServerDefinition = {
    name: analysis.name,
    source: input,
    default: merged,
    overrides: {},
  };
  await deps.writeServerDefinition(def);
}

export interface InstallFromLocalDeps {
  writeServerDefinition: (def: ServerDefinition) => Promise<void>;
  serverExists: (name: string) => boolean;
  selectServers: (defs: readonly ServerDefinition[]) => Promise<readonly ServerDefinition[]>;
  askEnvValue: (key: string) => Promise<string>;
  confirm: (message: string) => Promise<boolean>;
  fallbackToManual: () => Promise<void>;
}

export async function installFromLocal(
  path: string,
  deps: InstallFromLocalDeps,
): Promise<void> {
  const info = await stat(path);
  if (info.isFile() && path.endsWith(".json")) {
    const raw = await readFile(path, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`File is not valid JSON: ${path}`);
    }
    const defs = sniffLocalJson(parsed);
    const chosen = await deps.selectServers(defs);
    for (const d of chosen) await writeOneLocal(d, deps);
    return;
  }
  if (info.isDirectory()) {
    const detected = await detectProjectFromDir(path);
    if (!detected) throw new Error(`Cannot detect project type in ${path}`);
    const def: ServerDefinition = {
      name: detected.name,
      source: "local",
      default: {
        transport: "stdio",
        command: detected.command,
        args: [...detected.args],
        env: {},
      } satisfies StdioConfig,
      overrides: {},
    };
    await writeOneLocal(def, deps);
    return;
  }
  throw new Error(`Unsupported local path: ${path}`);
}

async function writeOneLocal(def: ServerDefinition, deps: InstallFromLocalDeps): Promise<void> {
  if (deps.serverExists(def.name)) {
    const overwrite = await deps.confirm(`Server "${def.name}" already exists. Overwrite?`);
    if (!overwrite) return;
  }
  await deps.writeServerDefinition(def);
}

async function installFromRemoteLegacy(
  urlInput: string,
  options: { force?: boolean },
): Promise<void> {
  const validation = isValidInput(urlInput);
  if (!validation.valid) {
    console.error(`Error: ${validation.reason}`);
    process.exitCode = 1;
    return;
  }

  const config = await readGlobalConfig();

  console.log("Analyzing documentation with GLM5...");
  let analysis: LegacyAnalysisResult;
  try {
    const userMessage = buildUserMessage(urlInput);
    analysis = await analyzeWithGlm(config, userMessage);
  } catch (error) {
    console.error(
      `GLM5 analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    const fallback = await confirm({
      message: "Would you like to configure manually instead?",
    });
    if (fallback) {
      await manualAddFlow();
    }
    return;
  }

  displayAnalysisResult(analysis, urlInput);

  const trust = await confirm({
    message: "Trust this analysis result?",
  });

  if (!trust) {
    const manual = await confirm({
      message: "Configure manually instead?",
    });
    if (manual) {
      await manualAddFlow();
    }
    return;
  }

  if (serverExists(analysis.name)) {
    if (!options.force) {
      console.error(
        `Error: Server "${analysis.name}" already exists. Run "mcpsmgr uninstall ${analysis.name}" first.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const env: Record<string, string> = {};
  for (const varName of analysis.requiredEnvVars) {
    const value = await password({
      message: `Enter value for ${varName} (stored locally, never sent to servers):`,
      mask: "*",
    });
    env[varName] = value;
  }

  const defaultConfig: DefaultConfig =
    analysis.default.transport === "stdio"
      ? {
          transport: "stdio",
          command: analysis.default.command ?? "",
          args: [...(analysis.default.args ?? [])],
          env: { ...(analysis.default.env ?? {}), ...env },
        }
      : {
          transport: "http",
          url: analysis.default.url ?? "",
          headers: { ...(analysis.default.headers ?? {}) },
        };

  const definition: ServerDefinition = {
    name: analysis.name,
    source: urlInput,
    default: defaultConfig,
    overrides: analysis.overrides as ServerDefinition["overrides"],
  };

  await writeServerDefinition(definition);
  console.log(`Server "${analysis.name}" saved to central repository.`);
}

async function installFromLocalPath(
  resolved: string,
  options: { force?: boolean },
): Promise<void> {
  if (!existsSync(resolved)) {
    console.error(`Error: "${resolved}" does not exist.`);
    process.exitCode = 1;
    return;
  }

  const info = await stat(resolved);

  if (info.isFile() && resolved.endsWith(".json")) {
    await installFromJsonFile(resolved, options);
    return;
  }

  if (info.isDirectory()) {
    await installFromProjectDir(resolved, options);
    return;
  }

  console.error(
    `Error: "${resolved}" is not a JSON file or project directory.`,
  );
  process.exitCode = 1;
}

async function installFromJsonFile(
  filePath: string,
  options: { force?: boolean },
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    console.error(
      `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  let definition: ServerDefinition;
  try {
    definition = JSON.parse(raw) as ServerDefinition;
  } catch {
    console.error("Error: File is not valid JSON.");
    process.exitCode = 1;
    return;
  }

  const validationError = validateDefinition(definition);
  if (validationError) {
    console.error(`Error: ${validationError}`);
    process.exitCode = 1;
    return;
  }

  const finalDef: ServerDefinition = {
    ...definition,
    source: definition.source || "local",
    overrides: definition.overrides ?? {},
  };

  await saveWithConflictCheck(finalDef, options);
}

interface DetectedProject {
  name: string;
  type: "python" | "node";
  command: string;
  args: readonly string[];
}

async function detectProjectType(
  dirPath: string,
): Promise<DetectedProject | undefined> {
  const pyprojectPath = join(dirPath, "pyproject.toml");
  if (existsSync(pyprojectPath)) {
    const content = await readFile(pyprojectPath, "utf-8");
    const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
    const name = nameMatch?.at(1) ?? basename(dirPath);
    return {
      name,
      type: "python",
      command: "uvx",
      args: ["--from", dirPath, name],
    };
  }

  const packageJsonPath = join(dirPath, "package.json");
  if (existsSync(packageJsonPath)) {
    const raw = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(raw) as { name?: string; bin?: Record<string, string> | string };
    const name = pkg.name ?? basename(dirPath);
    const binName =
      typeof pkg.bin === "string"
        ? name
        : typeof pkg.bin === "object"
          ? Object.keys(pkg.bin).at(0) ?? name
          : name;
    return {
      name: binName,
      type: "node",
      command: "npx",
      args: ["-y", dirPath],
    };
  }

  return undefined;
}

async function installFromProjectDir(
  dirPath: string,
  options: { force?: boolean },
): Promise<void> {
  const detected = await detectProjectType(dirPath);

  if (!detected) {
    console.error(
      "Error: Cannot detect project type. Supported: pyproject.toml (Python), package.json (Node.js).",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Detected ${detected.type} project: ${detected.name} (${detected.command} ${detected.args.join(" ")})`,
  );

  const nameAnswer = await input({
    message: "Server name (kebab-case):",
    default: detected.name,
    validate: (v) =>
      /^[a-z][a-z0-9-]*$/.test(v.trim()) ? true : "Must be kebab-case",
  });
  const serverName = nameAnswer.trim();

  const env: Record<string, string> = {};
  let addMore = true;
  while (addMore) {
    const envName = await input({
      message: "Env var name (leave empty to finish):",
    });
    if (envName.trim() === "") break;
    const envValue = await password({
      message: `Value for ${envName.trim()} (stored locally, never sent to servers):`,
      mask: "*",
    });
    env[envName.trim()] = envValue;
    addMore = true;
  }

  const config: StdioConfig = {
    transport: "stdio",
    command: detected.command,
    args: [...detected.args],
    env,
  };

  const definition: ServerDefinition = {
    name: serverName,
    source: "local",
    default: config,
    overrides: {},
  };

  await saveWithConflictCheck(definition, options);
}

async function saveWithConflictCheck(
  definition: ServerDefinition,
  options: { force?: boolean },
): Promise<void> {
  if (serverExists(definition.name)) {
    if (!options.force) {
      const overwrite = await confirm({
        message: `Server "${definition.name}" already exists. Overwrite?`,
      });
      if (!overwrite) {
        console.log("Cancelled.");
        return;
      }
    }
  }

  await writeServerDefinition(definition);
  console.log(`Server "${definition.name}" installed to central repository.`);
}

function displayAnalysisResult(result: LegacyAnalysisResult, source: string): void {
  console.log("\n--- Analysis Result ---");
  console.log(`Name: ${result.name}`);
  console.log(`Source: ${source}`);
  console.log(`Transport: ${result.default.transport}`);
  if (result.default.transport === "stdio") {
    console.log(`Command: ${result.default.command}`);
    console.log(`Args: ${JSON.stringify(result.default.args)}`);
  } else {
    console.log(`URL: ${result.default.url}`);
  }
  if (Object.keys(result.overrides).length > 0) {
    console.log("Agent overrides:");
    for (const [agent, override] of Object.entries(result.overrides)) {
      console.log(`  ${agent}: ${JSON.stringify(override)}`);
    }
  }
  if (result.requiredEnvVars.length > 0) {
    console.log(
      `Required env vars: ${result.requiredEnvVars.join(", ")}`,
    );
  }
  console.log("---\n");
}

export async function manualAddFlow(): Promise<void> {
  const name = await input({
    message: "Server name (kebab-case):",
    validate: (v) =>
      /^[a-z][a-z0-9-]*$/.test(v.trim()) ? true : "Must be kebab-case",
  });

  if (serverExists(name.trim())) {
    console.error(
      `Error: Server "${name.trim()}" already exists. Run "mcpsmgr uninstall ${name.trim()}" first.`,
    );
    process.exitCode = 1;
    return;
  }

  const source = await input({
    message: "Source URL (optional):",
  });

  const command = await input({
    message: "Command (e.g., npx):",
    validate: (v) => (v.trim().length > 0 ? true : "Command is required"),
  });

  const argsStr = await input({
    message: "Args (comma-separated, e.g., -y,@scope/package):",
  });
  const args = argsStr
    .trim()
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  const envPairs: Record<string, string> = {};
  let addMore = true;
  while (addMore) {
    const envName = await input({
      message: "Env var name (leave empty to finish):",
    });
    if (envName.trim() === "") break;
    const envValue = await password({
      message: `Value for ${envName.trim()} (stored locally, never sent to servers):`,
      mask: "*",
    });
    envPairs[envName.trim()] = envValue;
    addMore = true;
  }

  const config: StdioConfig = {
    transport: "stdio",
    command: command.trim(),
    args,
    env: envPairs,
  };

  const definition: ServerDefinition = {
    name: name.trim(),
    source: source.trim(),
    default: config,
    overrides: {},
  };

  await writeServerDefinition(definition);
  console.log(`Server "${name.trim()}" saved to central repository.`);
}

function validateDefinition(def: unknown): string | undefined {
  if (typeof def !== "object" || def === null) {
    return "File content must be a JSON object.";
  }

  const obj = def as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    return 'Missing or empty "name" field.';
  }

  if (typeof obj.default !== "object" || obj.default === null) {
    return 'Missing "default" config object.';
  }

  const config = obj.default as Record<string, unknown>;

  if (config.transport !== "stdio" && config.transport !== "http") {
    return 'default.transport must be "stdio" or "http".';
  }

  if (config.transport === "stdio") {
    if (typeof config.command !== "string" || config.command.trim() === "") {
      return "default.command is required for stdio transport.";
    }
  }

  if (config.transport === "http") {
    if (typeof config.url !== "string" || config.url.trim() === "") {
      return "default.url is required for http transport.";
    }
  }

  return undefined;
}
