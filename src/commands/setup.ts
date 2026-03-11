import { mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { input, select, confirm } from "@inquirer/prompts";
import type { GlobalConfig } from "../types.js";
import { paths } from "../utils/paths.js";
import { writeGlobalConfig, configExists } from "../utils/config.js";
import { isUserCancellation } from "../utils/prompt.js";

const GLM_ENDPOINTS = [
  {
    name: "Coding Plan (GLM-5)",
    value: "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
  },
  {
    name: "General (GLM-5)",
    value: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  },
] as const;

export async function setupCommand(): Promise<void> {
  try {
    await setupCommandInner();
  } catch (error) {
    if (isUserCancellation(error)) return;
    throw error;
  }
}

async function setupCommandInner(): Promise<void> {
  if (configExists()) {
    const overwrite = await confirm({
      message: "Configuration already exists. Overwrite?",
    });
    if (!overwrite) {
      console.log("Setup cancelled.");
      return;
    }
  }

  if (!existsSync(paths.baseDir)) {
    await mkdir(paths.baseDir, { recursive: true });
    await chmod(paths.baseDir, 0o700);
  }
  if (!existsSync(paths.serversDir)) {
    await mkdir(paths.serversDir, { recursive: true });
  }

  const glmApiKey = await input({
    message: "Enter GLM5 API Key:",
    validate: (v) => (v.trim().length > 0 ? true : "API key is required"),
  });

  const glmEndpoint = await select({
    message: "Select GLM5 endpoint:",
    choices: GLM_ENDPOINTS.map((e) => ({ name: e.name, value: e.value })),
  });

  const config: GlobalConfig = {
    glm: {
      apiKey: glmApiKey.trim(),
      endpoint: glmEndpoint,
    },
    webReader: {
      apiKey: glmApiKey.trim(),
      url: "https://open.bigmodel.cn/api/mcp/web_reader/mcp",
    },
  };

  await writeGlobalConfig(config);
  console.log("Setup complete. Configuration saved to ~/.mcps-manager/config.json");
}
