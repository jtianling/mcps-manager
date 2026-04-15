import { describe, it, expect } from "vitest";
import { parseJsonBlocks } from "../parse-json-block.js";

describe("parseJsonBlocks", () => {
  it("extracts single mcpServers entry", () => {
    const md = '```json\n{"mcpServers": {"figma": {"command": "npx", "args": ["-y", "figma-mcp"]}}}\n```';
    expect(parseJsonBlocks(md)).toEqual([
      {
        source: "mcpServers",
        name: "figma",
        transport: "stdio",
        command: "npx",
        args: ["-y", "figma-mcp"],
        envKeys: [],
      },
    ]);
  });

  it("extracts multiple mcpServers entries", () => {
    const md = '```json\n{"mcpServers": {"a": {"command": "ax"}, "b": {"command": "bx"}}}\n```';
    const out = parseJsonBlocks(md);
    expect(out.map((e) => e.name).sort()).toEqual(["a", "b"]);
  });

  it("extracts env keys without values", () => {
    const md = '```json\n{"mcpServers": {"g": {"command": "x", "env": {"API_KEY": "your-key", "OTHER": "x"}}}}\n```';
    const out = parseJsonBlocks(md);
    expect(out[0]?.envKeys?.slice().sort()).toEqual(["API_KEY", "OTHER"]);
  });

  it("extracts bare {command, args} block as P3 candidate", () => {
    const md = '```json\n{"command": "npx", "args": ["-y", "@scope/pkg"]}\n```';
    expect(parseJsonBlocks(md)).toEqual([
      {
        source: "bare",
        name: undefined,
        transport: "stdio",
        command: "npx",
        args: ["-y", "@scope/pkg"],
        envKeys: [],
      },
    ]);
  });

  it("extracts bare http {url, headers} block", () => {
    const md = '```json\n{"url": "https://x/mcp", "headers": {}}\n```';
    expect(parseJsonBlocks(md)).toEqual([
      {
        source: "bare",
        name: undefined,
        transport: "http",
        url: "https://x/mcp",
        headers: {},
        envKeys: [],
      },
    ]);
  });

  it("returns empty list when no json fenced blocks", () => {
    expect(parseJsonBlocks("plain text")).toEqual([]);
  });
});
