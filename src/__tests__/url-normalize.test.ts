import { describe, expect, it } from "vitest";
import { makeBundleId, normalizeGitUrl } from "../utils/url-normalize.js";

describe("normalizeGitUrl", () => {
  it("normalizes owner/repo shorthand", () => {
    expect(normalizeGitUrl("jtianling/cross-agent-teams-mcp")).toBe(
      "https://github.com/jtianling/cross-agent-teams-mcp",
    );
  });

  it("normalizes https URL with .git and trailing slash", () => {
    expect(
      normalizeGitUrl(
        "https://github.com/jtianling/cross-agent-teams-mcp.git/",
      ),
    ).toBe("https://github.com/jtianling/cross-agent-teams-mcp");
  });

  it("normalizes ssh URL", () => {
    expect(
      normalizeGitUrl("git@github.com:jtianling/cross-agent-teams-mcp.git"),
    ).toBe("https://github.com/jtianling/cross-agent-teams-mcp");
  });

  it("lowercases scheme and host while preserving path case", () => {
    expect(normalizeGitUrl("HTTPS://GitHub.COM/Owner/Repo")).toBe(
      "https://github.com/Owner/Repo",
    );
  });

  it("rejects non-GitHub URLs", () => {
    expect(normalizeGitUrl("https://gitlab.com/foo/bar")).toBeNull();
  });

  it("uses normalized URL for deterministic bundle IDs", () => {
    const inputs = [
      "jtianling/cross-agent-teams-mcp",
      "https://github.com/jtianling/cross-agent-teams-mcp.git",
      "git@github.com:jtianling/cross-agent-teams-mcp.git",
    ];
    const ids = inputs.map((input) => {
      const normalized = normalizeGitUrl(input);
      if (!normalized) throw new Error("expected GitHub URL");
      return makeBundleId("git", normalized);
    });
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(
      "git:https://github.com/jtianling/cross-agent-teams-mcp",
    );
  });
});
