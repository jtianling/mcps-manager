import { describe, it, expect } from "vitest";
import { tokenize } from "../shell-tokenize.js";

describe("shell-tokenize", () => {
  it("splits plain space-separated tokens", () => {
    expect(tokenize("claude mcp add blender uvx blender-mcp")).toEqual(
      ["claude", "mcp", "add", "blender", "uvx", "blender-mcp"],
    );
  });

  it("preserves double-quoted strings as one token", () => {
    expect(tokenize('echo "hello world"')).toEqual(["echo", "hello world"]);
  });

  it("preserves single-quoted strings as one token", () => {
    expect(tokenize("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  it("handles backslash escape of space", () => {
    expect(tokenize("cmd foo\\ bar baz")).toEqual(["cmd", "foo bar", "baz"]);
  });

  it("handles KEY=VAL tokens", () => {
    expect(tokenize("-e API_KEY=xyz -- npx -y pkg")).toEqual(
      ["-e", "API_KEY=xyz", "--", "npx", "-y", "pkg"],
    );
  });

  it("collapses consecutive whitespace", () => {
    expect(tokenize("a   b  c")).toEqual(["a", "b", "c"]);
  });
});
