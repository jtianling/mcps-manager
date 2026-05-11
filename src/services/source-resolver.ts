import { readBundle } from "../utils/bundle-store.js";
import { listServerDefinitions, serverExists } from "../utils/server-store.js";
import { makeBundleId, normalizeGitUrl } from "../utils/url-normalize.js";

export type ResolveInputForm =
  | "url"
  | "owner-repo"
  | "kebab"
  | "invalid"
  | "ambiguous-reponame";

export type ResolveResult =
  | { readonly kind: "server"; readonly name: string }
  | {
      readonly kind: "bundle";
      readonly bundleId: string;
      readonly url: string;
      readonly members: readonly string[];
    }
  | {
      readonly kind: "not-found";
      readonly inputForm: ResolveInputForm;
      readonly candidates?: readonly string[];
    };

const OWNER_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const KEBAB_CASE = /^[a-z][a-z0-9-]*$/;

export async function resolve(input: string): Promise<ResolveResult> {
  const trimmed = input.trim();
  const shape = detectShape(trimmed);

  if (shape === "url" || shape === "owner-repo") {
    const normalized = normalizeGitUrl(trimmed);
    if (!normalized) return { kind: "not-found", inputForm: shape };
    const bundleId = makeBundleId("git", normalized);
    return bundleLookupOrNotFound(bundleId, shape);
  }

  if (shape === "kebab") {
    if (serverExists(trimmed)) return { kind: "server", name: trimmed };
    return resolveRepoName(trimmed);
  }

  return { kind: "not-found", inputForm: "invalid" };
}

function detectShape(input: string): Exclude<ResolveInputForm, "ambiguous-reponame"> {
  if (/^https?:\/\//i.test(input) || /^git@github\.com:/i.test(input)) {
    return "url";
  }
  if (OWNER_REPO.test(input)) return "owner-repo";
  if (KEBAB_CASE.test(input)) return "kebab";
  return "invalid";
}

async function bundleLookupOrNotFound(
  bundleId: string,
  inputForm: "url" | "owner-repo",
): Promise<ResolveResult> {
  const bundle = await readBundle(bundleId);
  if (!bundle) return { kind: "not-found", inputForm };
  return {
    kind: "bundle",
    bundleId,
    url: bundle.url,
    members: bundle.members,
  };
}

async function resolveRepoName(repoName: string): Promise<ResolveResult> {
  const matches = (await listServerDefinitions()).filter(
    (def) => def.repoName === repoName && def.bundleId,
  );
  if (matches.length === 0) {
    return { kind: "not-found", inputForm: "kebab" };
  }

  const bundleIds = new Set(matches.map((def) => def.bundleId!));
  if (bundleIds.size > 1) {
    return {
      kind: "not-found",
      inputForm: "ambiguous-reponame",
      candidates: [...bundleIds].map(formatCandidate).sort(),
    };
  }

  const bundleId = [...bundleIds][0]!;
  const bundle = await readBundle(bundleId);
  if (!bundle) return { kind: "not-found", inputForm: "kebab" };

  return {
    kind: "bundle",
    bundleId,
    url: bundle.url,
    members: bundle.members,
  };
}

function formatCandidate(bundleId: string): string {
  const prefix = "git:https://github.com/";
  return bundleId.startsWith(prefix)
    ? bundleId.slice(prefix.length)
    : bundleId.replace(/^git:/, "");
}
