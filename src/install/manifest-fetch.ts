import type { GitHubRef } from "./source.js";
import { validateManifest, type Manifest } from "./manifest-schema.js";

type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface ManifestFetchDeps {
  fetch?: FetchLike;
}

export function manifestUrl(ref: GitHubRef): string {
  return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD/mcpsmgr.json`;
}

export async function fetchManifest(
  ref: GitHubRef,
  deps: ManifestFetchDeps = {},
): Promise<Manifest | undefined> {
  const f: FetchLike = deps.fetch ?? (fetch as unknown as FetchLike);
  const url = manifestUrl(ref);
  const res = await f(url);

  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(
      `Failed to fetch mcpsmgr.json from ${ref.owner}/${ref.repo}: HTTP ${res.status}`,
    );
  }

  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(
      `mcpsmgr.json from ${ref.owner}/${ref.repo} is not valid JSON`,
    );
  }

  const result = validateManifest(parsed);
  if (!result.ok) {
    const detail = result.errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(
      `mcpsmgr.json from ${ref.owner}/${ref.repo} is invalid:\n${detail}`,
    );
  }
  return result.manifest;
}
