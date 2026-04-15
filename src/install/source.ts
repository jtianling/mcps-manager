export interface GitHubRef {
  readonly owner: string;
  readonly repo: string;
}

export function parseGitHubSource(input: string): GitHubRef | undefined {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const match = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/);
    if (!match) return undefined;
    return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, "") };
  }
  if (isGitHubRepo(input)) {
    const [owner, repo] = input.split("/");
    return { owner: owner!, repo: repo! };
  }
  return undefined;
}

export function isGitHubRepo(input: string): boolean {
  if (input.startsWith("http") || input.startsWith("@")) return false;
  const parts = input.split("/");
  return parts.length === 2 && parts.every((p) => p.length > 0);
}

export function isValidInput(
  input: string,
): { valid: true } | { valid: false; reason: string } {
  if (parseGitHubSource(input)) return { valid: true };
  return {
    valid: false,
    reason:
      'Invalid input. Provide a GitHub URL (https://github.com/owner/repo), owner/repo shortname, or a local path (./file.json | ./dir).',
  };
}
