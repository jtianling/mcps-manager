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
  type AnalysisResult,
} from "../services/glm-client.js";
import { isUserCancellation } from "../utils/prompt.js";

export async function installCommand(source?: string): Promise<void> {
  try {
    await installCommandInner(source);
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function installCommandInner(source?: string): Promise<void> {
  const urlInput =
    source ??
    (await input({
      message: "Enter MCP server URL or GitHub owner/repo (leave empty for manual):",
    }));

  if (urlInput.trim() === "") {
    await manualAddFlow();
    return;
  }

  const validation = isValidInput(urlInput.trim());
  if (!validation.valid) {
    console.error(`Error: ${validation.reason}`);
    process.exitCode = 1;
    return;
  }

  const config = await readGlobalConfig();

  console.log("Analyzing documentation with GLM5...");
  let analysis: AnalysisResult;
  try {
    const userMessage = buildUserMessage(urlInput.trim());
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

  displayAnalysisResult(analysis, urlInput.trim());

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
    console.error(
      `Error: Server "${analysis.name}" already exists. Run "mcpsmgr uninstall ${analysis.name}" first.`,
    );
    process.exitCode = 1;
    return;
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
    source: urlInput.trim(),
    default: defaultConfig,
    overrides: analysis.overrides as ServerDefinition["overrides"],
  };

  await writeServerDefinition(definition);
  console.log(`Server "${analysis.name}" saved to central repository.`);
}

function displayAnalysisResult(result: AnalysisResult, source: string): void {
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
