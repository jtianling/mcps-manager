import type { GitHubRef } from "./source.js";

export async function fetchManifestDefault(
  ref: GitHubRef,
  name: string,
): Promise<string | undefined> {
  const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD/${name}`;
  const res = await fetch(url);
  if (!res.ok) return undefined;
  return await res.text();
}

export function parsePackageJsonName(text: string): string | undefined {
  try {
    const pkg = JSON.parse(text) as { name?: unknown };
    if (typeof pkg.name === "string") return pkg.name;
  } catch {
    /* noop */
  }
  return undefined;
}

export function parsePyprojectName(text: string): string | undefined {
  const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return m?.[1];
}
