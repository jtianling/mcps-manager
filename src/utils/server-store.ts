import { readFile, writeFile, readdir, unlink, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ServerDefinition } from "../types.js";
import { paths } from "./paths.js";

export async function readServerDefinition(
  name: string,
): Promise<ServerDefinition | undefined> {
  const filePath = paths.serverFile(name);
  if (!existsSync(filePath)) {
    return undefined;
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as ServerDefinition;
}

export async function writeServerDefinition(
  definition: ServerDefinition,
): Promise<void> {
  if (!existsSync(paths.serversDir)) {
    await mkdir(paths.serversDir, { recursive: true });
  }
  const filePath = paths.serverFile(definition.name);
  await writeFile(filePath, JSON.stringify(definition, null, 2), "utf-8");
  await chmod(filePath, 0o600);
}

export async function removeServerDefinition(name: string): Promise<boolean> {
  const filePath = paths.serverFile(name);
  if (!existsSync(filePath)) {
    return false;
  }
  await unlink(filePath);
  return true;
}

export async function listServerDefinitions(): Promise<ServerDefinition[]> {
  if (!existsSync(paths.serversDir)) {
    return [];
  }
  const files = await readdir(paths.serversDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const results: ServerDefinition[] = [];
  for (const file of jsonFiles) {
    const raw = await readFile(
      paths.serverFile(file.replace(".json", "")),
      "utf-8",
    );
    results.push(JSON.parse(raw) as ServerDefinition);
  }
  return results;
}

export function serverExists(name: string): boolean {
  return existsSync(paths.serverFile(name));
}
