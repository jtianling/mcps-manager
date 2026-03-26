import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { confirm, input, password } from "@inquirer/prompts";
import type { ServerDefinition, StdioConfig } from "../types.js";
import {
  serverExists,
  writeServerDefinition,
} from "../utils/server-store.js";
import { manualAddFlow } from "./install.js";
import { isUserCancellation } from "../utils/prompt.js";

export async function customInstallCommand(
  pathOrName: string | undefined,
  options: { force?: boolean },
): Promise<void> {
  try {
    await customInstallCommandInner(pathOrName, options);
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function customInstallCommandInner(
  pathOrName: string | undefined,
  options: { force?: boolean },
): Promise<void> {
  if (!pathOrName) {
    await manualAddFlow();
    return;
  }

  const resolved = resolve(pathOrName);

  if (!existsSync(resolved)) {
    console.error(`Error: "${pathOrName}" does not exist.`);
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
    `Error: "${pathOrName}" is not a JSON file or project directory.`,
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
    return detectPythonProject(dirPath, pyprojectPath);
  }

  const packageJsonPath = join(dirPath, "package.json");
  if (existsSync(packageJsonPath)) {
    return detectNodeProject(dirPath, packageJsonPath);
  }

  return undefined;
}

async function detectPythonProject(
  dirPath: string,
  pyprojectPath: string,
): Promise<DetectedProject> {
  const content = await readFile(pyprojectPath, "utf-8");

  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  const name = nameMatch?.at(1) ?? basename(dirPath);

  return {
    name,
    type: "python",
    command: "uvx",
    args: [
      "--from",
      dirPath,
      name,
    ],
  };
}

async function detectNodeProject(
  dirPath: string,
  packageJsonPath: string,
): Promise<DetectedProject> {
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
  console.log(
    `Server "${definition.name}" installed to central repository.`,
  );
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
