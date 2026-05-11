const OWNER_REPO = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const SSH_GITHUB = /^git@github\.com:([^/]+)\/(.+)$/i;

export function normalizeGitUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const ownerRepoMatch = OWNER_REPO.exec(trimmed);
  if (ownerRepoMatch) {
    return toGitHubUrl(ownerRepoMatch[1]!, ownerRepoMatch[2]!);
  }

  const sshMatch = SSH_GITHUB.exec(trimmed);
  if (sshMatch) {
    return toGitHubUrl(sshMatch[1]!, stripRepoSuffix(sshMatch[2]!));
  }

  if (!/^https?:\/\//i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.hostname.toLowerCase() !== "github.com") return null;

  const parts = parsed.pathname
    .split("/")
    .filter((part) => part.length > 0);
  if (parts.length < 2) return null;

  return toGitHubUrl(parts[0]!, stripRepoSuffix(parts[1]!));
}

export function makeBundleId(type: "git", url: string): string {
  return `${type}:${url}`;
}

export function gitBundleMetadata(
  input: string,
): { readonly url: string; readonly repoName: string; readonly bundleId: string } | null {
  const url = normalizeGitUrl(input);
  if (!url) return null;
  const repoName = url.split("/").at(-1);
  if (!repoName) return null;
  return { url, repoName, bundleId: makeBundleId("git", url) };
}

function toGitHubUrl(owner: string, repo: string): string | null {
  if (owner === "" || repo === "") return null;
  return `https://github.com/${owner}/${repo}`;
}

function stripRepoSuffix(repo: string): string {
  return repo.replace(/\/+$/g, "").replace(/\.git$/i, "");
}
