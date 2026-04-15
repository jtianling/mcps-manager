import { describe, it, expect } from "vitest";
import { parseGitHubSource, isGitHubRepo } from "../source.js";

describe("source", () => {
  it("parses plain owner/repo", () => {
    expect(parseGitHubSource("anthropics/mcp-brave-search")).toEqual({
      owner: "anthropics",
      repo: "mcp-brave-search",
    });
  });
  it("parses https://github.com/owner/repo", () => {
    expect(parseGitHubSource("https://github.com/anthropics/mcp-brave-search")).toEqual({
      owner: "anthropics",
      repo: "mcp-brave-search",
    });
  });
  it("parses URL with /blob/main/README.md suffix", () => {
    expect(parseGitHubSource("https://github.com/a/b/blob/main/README.md")).toEqual({
      owner: "a",
      repo: "b",
    });
  });
  it("returns undefined for non-GitHub URL", () => {
    expect(parseGitHubSource("https://example.com/foo")).toBeUndefined();
  });
  it("isGitHubRepo returns true for owner/repo and false for @scope/pkg", () => {
    expect(isGitHubRepo("anthropics/mcp")).toBe(true);
    expect(isGitHubRepo("@scope/pkg")).toBe(false);
    expect(isGitHubRepo("bare-name")).toBe(false);
  });
});
