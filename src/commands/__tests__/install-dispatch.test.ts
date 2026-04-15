import { describe, it, expect } from "vitest";
import { classifyInput } from "../install.js";

describe("classifyInput", () => {
  it("recognizes GitHub owner/repo", () => {
    expect(classifyInput("anthropics/mcp-x")).toEqual({
      kind: "github",
      value: "anthropics/mcp-x",
    });
  });
  it("recognizes GitHub URL", () => {
    expect(classifyInput("https://github.com/a/b")).toEqual({
      kind: "github",
      value: "https://github.com/a/b",
    });
  });
  it("rejects non-GitHub URL", () => {
    expect(classifyInput("https://docs.example.com/mcp")).toEqual({
      kind: "error",
      reason: expect.stringMatching(/GitHub/),
    });
  });
  it("rejects bare name", () => {
    expect(classifyInput("bare-name")).toEqual({
      kind: "error",
      reason: expect.stringMatching(/GitHub URL|owner\/repo|local path/i),
    });
  });
  it("rejects @scope/pkg", () => {
    expect(classifyInput("@scope/pkg")).toEqual({
      kind: "error",
      reason: expect.any(String),
    });
  });
  it("recognizes local JSON path", () => {
    expect(classifyInput("./foo.json")).toEqual({
      kind: "local",
      value: "./foo.json",
    });
  });
  it("recognizes local directory path", () => {
    expect(classifyInput("./my-dir")).toEqual({
      kind: "local",
      value: "./my-dir",
    });
  });
});
