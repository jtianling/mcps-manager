import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import JSON5 from "json5";

export async function readJson5File(
  filePath: string,
): Promise<Record<string, unknown>> {
  if (!existsSync(filePath)) {
    return {};
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON5.parse(raw) as Record<string, unknown>;
}

export async function writeJson5File(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
