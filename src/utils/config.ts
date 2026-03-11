import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { GlobalConfig } from "../types.js";
import { paths } from "./paths.js";

export async function readGlobalConfig(): Promise<GlobalConfig> {
  const raw = await readFile(paths.configFile, "utf-8");
  return JSON.parse(raw) as GlobalConfig;
}

export async function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  if (!existsSync(paths.baseDir)) {
    await mkdir(paths.baseDir, { recursive: true });
    await chmod(paths.baseDir, 0o700);
  }
  await writeFile(paths.configFile, JSON.stringify(config, null, 2), "utf-8");
  await chmod(paths.configFile, 0o600);
}

export function configExists(): boolean {
  return existsSync(paths.configFile);
}
