import { describe, it, expect } from "vitest";
import { parseClaudeMcpAdd } from "../parse-claude-mcp-add.js";

describe("parseClaudeMcpAdd", () => {
  it("extracts plain `claude mcp add name cmd args` from fenced block", () => {
    const md = "# Blender\n\n```bash\nclaude mcp add blender uvx blender-mcp\n```\n";
    expect(parseClaudeMcpAdd(md)).toEqual({
      name: "blender",
      transport: "stdio",
      command: "uvx",
      args: ["blender-mcp"],
      envKeys: [],
    });
  });

  it("extracts -e KEY=VAL and command after `--`", () => {
    const md = "```sh\nclaude mcp add github -e GITHUB_TOKEN=xxx -- npx -y @modelcontextprotocol/server-github\n```";
    expect(parseClaudeMcpAdd(md)).toEqual({
      name: "github",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      envKeys: ["GITHUB_TOKEN"],
    });
  });

  it("extracts http transport and url", () => {
    const md = "```\nclaude mcp add remote --transport http --url https://example.com/mcp\n```";
    expect(parseClaudeMcpAdd(md)).toEqual({
      name: "remote",
      transport: "http",
      url: "https://example.com/mcp",
      headers: {},
      envKeys: [],
    });
  });

  it("ignores claude mcp add outside fenced code blocks", () => {
    const md = "To install, run `claude mcp add foo bar` in your terminal.\nOr use claude mcp add foo bar inline.";
    expect(parseClaudeMcpAdd(md)).toBeUndefined();
  });

  it("returns undefined when no claude mcp add line present", () => {
    const md = "```\nnpm install some-package\n```";
    expect(parseClaudeMcpAdd(md)).toBeUndefined();
  });
});
