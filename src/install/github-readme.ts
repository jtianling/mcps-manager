import { spawn } from "node:child_process";
import type { GitHubRef } from "./source.js";

type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;
type RunGhLike = (args: string[]) => Promise<{ code: number; stdout: string }>;

export interface Deps {
  fetch?: FetchLike;
  runGh?: RunGhLike;
}

async function defaultRunGh(
  args: string[],
): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn("gh", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.on("error", () => resolve({ code: 1, stdout: "" }));
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout }));
  });
}

export async function fetchGitHubReadme(
  ref: GitHubRef,
  deps: Deps = {},
): Promise<string> {
  const f: FetchLike = deps.fetch ?? (fetch as unknown as FetchLike);
  const runGh: RunGhLike = deps.runGh ?? defaultRunGh;

  const tryRaw = async (name: string): Promise<string | undefined> => {
    const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD/${name}`;
    const res = await f(url);
    if (res.ok) return await res.text();
    return undefined;
  };

  const readme = await tryRaw("README.md");
  if (readme !== undefined) return readme;
  const readmeLower = await tryRaw("readme.md");
  if (readmeLower !== undefined) return readmeLower;

  const ghRes = await runGh([
    "api",
    `/repos/${ref.owner}/${ref.repo}/readme`,
    "--jq",
    ".content",
  ]);
  if (ghRes.code === 0 && ghRes.stdout.trim().length > 0) {
    return Buffer.from(ghRes.stdout.trim(), "base64").toString("utf8");
  }

  throw new Error(`Could not fetch README for ${ref.owner}/${ref.repo}`);
}
