import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";

export interface DetectedProject {
  readonly name: string;
  readonly type: "python" | "node";
  readonly command: string;
  readonly args: readonly string[];
}

export async function detectProjectFromDir(dir: string): Promise<DetectedProject | undefined> {
  const py = join(dir, "pyproject.toml");
  if (existsSync(py)) {
    const text = await readFile(py, "utf-8");
    const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
    const name = m?.[1] ?? basename(dir);
    return { name, type: "python", command: "uvx", args: ["--from", dir, name] };
  }
  const pkg = join(dir, "package.json");
  if (existsSync(pkg)) {
    const raw = await readFile(pkg, "utf-8");
    const parsed = JSON.parse(raw) as { name?: string };
    const name = parsed.name ?? basename(dir);
    return { name, type: "node", command: "npx", args: ["-y", dir] };
  }
  return undefined;
}
