import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

export async function readJsonFile(
  filePath: string,
): Promise<Record<string, unknown>> {
  if (!existsSync(filePath)) {
    return {};
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function writeJsonFile(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
