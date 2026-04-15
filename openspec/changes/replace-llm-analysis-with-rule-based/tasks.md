# Tasks: replace-llm-analysis-with-rule-based

## 1. Foundation: shell tokenizer

- [x] 1.1 Implement POSIX-style shell tokenizer for `claude mcp add` CLI args
  - kind: unit-test
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `标准 claude mcp add name cmd args 行`
    - `readme-analysis/spec.md` → Scenario: `含 -e KEY=VAL flag`
  - **Files:**
    - Create: `src/install/__tests__/shell-tokenize.test.ts`
    - Create: `src/install/shell-tokenize.ts`
  - [x] **RED:** Write failing test — `src/install/__tests__/shell-tokenize.test.ts`
    - Behavior under test: tokenizer splits command-line strings respecting single quotes, double quotes, and backslash escapes
    - Expected failure reason: module `../shell-tokenize.js` does not exist yet
    ```typescript
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
    ```
  - [x] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/shell-tokenize.test.ts`
    - **Observed output (fill during apply):**
      ```
      ❯ src/install/__tests__/shell-tokenize.test.ts (0 test)
      FAIL src/install/__tests__/shell-tokenize.test.ts
      Error: Cannot find module '../shell-tokenize.js' imported from
        '/Users/jtianling/workspace/mcps-manager/src/install/__tests__/shell-tokenize.test.ts'
      Test Files  1 failed (1)
      ```
  - [x] **GREEN:** Write minimal implementation — `src/install/shell-tokenize.ts`
    ```typescript
    export function tokenize(input: string): string[] {
      const tokens: string[] = [];
      let current = "";
      let inSingle = false;
      let inDouble = false;
      let i = 0;
      while (i < input.length) {
        const ch = input[i];
        if (ch === "\\" && !inSingle) {
          const next = input[i + 1];
          if (next !== undefined) {
            current += next;
            i += 2;
            continue;
          }
        }
        if (ch === "'" && !inDouble) {
          inSingle = !inSingle;
          i++;
          continue;
        }
        if (ch === '"' && !inSingle) {
          inDouble = !inDouble;
          i++;
          continue;
        }
        if (!inSingle && !inDouble && /\s/.test(ch ?? "")) {
          if (current.length > 0) {
            tokens.push(current);
            current = "";
          }
          i++;
          continue;
        }
        current += ch;
        i++;
      }
      if (current.length > 0) tokens.push(current);
      return tokens;
    }
    ```
  - [x] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/shell-tokenize.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      ✓ src/install/__tests__/shell-tokenize.test.ts (6 tests) 1ms
      Test Files  1 passed (1)
      Tests  6 passed (6)
      Full suite: Test Files 7 passed (7), Tests 67 passed (67)
      ```
  - [x] **REFACTOR:** None — already minimal
  - [x] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      Test Files  7 passed (7)
      Tests  67 passed (67)
      Duration  183ms
      ```
  - [x] **Commit:** `feat(install): add shell tokenizer for claude mcp add parsing`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `abdb08c`

## 2. GitHub source normalization and README fetch

- [x] 2.1 Implement source normalization + README fetch chain
  - kind: unit-test
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `fetch README.md 成功`
    - `readme-analysis/spec.md` → Scenario: `大小写兜底`
    - `readme-analysis/spec.md` → Scenario: `全部失败`
    - `server-management/spec.md` → Scenario: `使用 GitHub 简写添加`
    - `server-management/spec.md` → Scenario: `使用完整 GitHub URL 添加`
  - **Files:**
    - Create: `src/install/__tests__/source.test.ts`
    - Create: `src/install/source.ts`
    - Create: `src/install/__tests__/github-readme.test.ts`
    - Create: `src/install/github-readme.ts`
  - [x] **RED:** Write failing test — `src/install/__tests__/source.test.ts` and `src/install/__tests__/github-readme.test.ts`
    - Behavior under test: source.ts normalizes owner/repo forms; github-readme.ts fetches README with raw URL first, falls back to lowercase, then throws on all failures
    - Expected failure reason: modules do not exist yet
    ```typescript
    // src/install/__tests__/source.test.ts
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
    ```
    ```typescript
    // src/install/__tests__/github-readme.test.ts
    import { describe, it, expect, vi, beforeEach } from "vitest";
    import { fetchGitHubReadme } from "../github-readme.js";

    const mockFetch = vi.fn();
    const mockRunGh = vi.fn();

    beforeEach(() => {
      mockFetch.mockReset();
      mockRunGh.mockReset();
    });

    describe("fetchGitHubReadme", () => {
      it("returns README.md content on 200", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "# Hello" });
        const text = await fetchGitHubReadme(
          { owner: "a", repo: "b" },
          { fetch: mockFetch, runGh: mockRunGh },
        );
        expect(text).toBe("# Hello");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://raw.githubusercontent.com/a/b/HEAD/README.md",
        );
      });

      it("falls back to readme.md on 404", async () => {
        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" })
          .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "# Lower" });
        const text = await fetchGitHubReadme(
          { owner: "a", repo: "b" },
          { fetch: mockFetch, runGh: mockRunGh },
        );
        expect(text).toBe("# Lower");
      });

      it("falls back to gh when both raw URLs 404", async () => {
        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" })
          .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" });
        mockRunGh.mockResolvedValueOnce({
          code: 0,
          stdout: Buffer.from("# From gh").toString("base64"),
        });
        const text = await fetchGitHubReadme(
          { owner: "a", repo: "b" },
          { fetch: mockFetch, runGh: mockRunGh },
        );
        expect(text).toBe("# From gh");
      });

      it("throws when all paths fail", async () => {
        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" })
          .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" });
        mockRunGh.mockResolvedValueOnce({ code: 1, stdout: "" });
        await expect(
          fetchGitHubReadme({ owner: "a", repo: "b" }, { fetch: mockFetch, runGh: mockRunGh }),
        ).rejects.toThrow(/README/);
      });
    });
    ```
  - [x] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/source.test.ts src/install/__tests__/github-readme.test.ts`
    - **Observed output (fill during apply):**
      ```
      FAIL src/install/__tests__/source.test.ts
        Error: Cannot find module '../source.js' imported from src/install/__tests__/source.test.ts
      FAIL src/install/__tests__/github-readme.test.ts
        Error: Cannot find module '../github-readme.js'
      Test Files  2 failed (2)
      ```
  - [x] **GREEN:** Write minimal implementation — `src/install/source.ts` and `src/install/github-readme.ts`
    ```typescript
    // src/install/source.ts
    export interface GitHubRef { readonly owner: string; readonly repo: string }

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
    ```
    ```typescript
    // src/install/github-readme.ts
    import { spawn } from "node:child_process";
    import type { GitHubRef } from "./source.js";

    type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
    type RunGhLike = (args: string[]) => Promise<{ code: number; stdout: string }>;

    export interface Deps {
      fetch?: FetchLike;
      runGh?: RunGhLike;
    }

    async function defaultRunGh(args: string[]): Promise<{ code: number; stdout: string }> {
      return new Promise((resolve) => {
        const proc = spawn("gh", args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
        proc.on("error", () => resolve({ code: 1, stdout: "" }));
        proc.on("close", (code) => resolve({ code: code ?? 1, stdout }));
      });
    }

    export async function fetchGitHubReadme(
      ref: GitHubRef,
      deps: Deps = {},
    ): Promise<string> {
      const f: FetchLike = deps.fetch ?? fetch;
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

      const ghRes = await runGh(["api", `/repos/${ref.owner}/${ref.repo}/readme`, "--jq", ".content"]);
      if (ghRes.code === 0 && ghRes.stdout.trim().length > 0) {
        return Buffer.from(ghRes.stdout.trim(), "base64").toString("utf8");
      }

      throw new Error(`Could not fetch README for ${ref.owner}/${ref.repo}`);
    }
    ```
  - [x] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/source.test.ts src/install/__tests__/github-readme.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      ✓ src/install/__tests__/source.test.ts (5 tests) 1ms
      ✓ src/install/__tests__/github-readme.test.ts (4 tests) 2ms
      Test Files  2 passed (2)  Tests  9 passed (9)
      Full suite: Test Files 9 passed (9), Tests 76 passed (76)
      ```
  - [x] **REFACTOR:** None — already minimal
  - [x] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      Test Files  9 passed (9)
      Tests  76 passed (76)
      Duration  192ms
      ```
  - [x] **Commit:** `feat(install): add github source parsing and README fetch chain`
    - Staging order: test files BEFORE production files
    - **Commit SHA (fill during apply):** `5cd43b5`

- [x] 2.2 Runtime verification: HEAD ref compatibility + gh降级 path
  - kind: manual-verify
  - verify: Pull `ahujasid/blender-mcp` (default branch `main`) and one well-known repo with default `master` branch; confirm README loads. Then simulate a 404 (misspell repo) and confirm gh fallback surfaces `gh: could not prompt` / README missing error cleanly.
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `fetch README.md 成功`
    - `readme-analysis/spec.md` → Scenario: `gh CLI 降级`
  - **Files:**
    - Modify: `src/install/github-readme.ts` (only if issue found)
  - [x] **IMPLEMENT:** The module is already implemented in 2.1. Write a small script to exercise the live chain.
    - Inline script (or `node -e`):
      ```typescript
      import { fetchGitHubReadme } from "./src/install/github-readme.js";
      const refs = [
        { owner: "ahujasid", repo: "blender-mcp" },
        { owner: "torvalds", repo: "linux" },  // master-branched repo
      ];
      for (const ref of refs) {
        const text = await fetchGitHubReadme(ref);
        console.log(ref.owner + "/" + ref.repo + ": " + text.length + " chars, starts with " + text.slice(0, 40));
      }
      ```
  - [x] **MANUAL-VERIFY:** Ran `tsx /tmp/verify-github-readme.mts` against live GitHub. [ok]
    - **Evidence (fill during apply):**
      ```
      ahujasid/blender-mcp: 10076 chars, starts: "\n\n# BlenderMCP - Blender Model Context Protocol Integration\n"
      git/git: 3662 chars, starts: "[![Build status](https://github.com/git/git/workflows/CI/bad"
      --- non-existent repo ---
      expected error: Could not fetch README for anthropics/definitely-not-a-repo-xyz-mcpsmgr

      A1 verified: HEAD ref correctly resolves both main (blender-mcp) and master (git) default branches.
      Error path triggers gh fallback then surfaces clean error when gh also fails.
      ```
  - [x] **Commit:** `test(install): verify github-readme chain against live repos`
    - **Commit SHA (fill during apply):** `a57a09f`

## 3. README rule-based parsers

- [x] 3.1 Implement `claude mcp add` CLI line parser (P1)
  - kind: unit-test
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `标准 claude mcp add name cmd args 行`
    - `readme-analysis/spec.md` → Scenario: `含 -e KEY=VAL flag`
    - `readme-analysis/spec.md` → Scenario: `含 --transport http --url`
    - `readme-analysis/spec.md` → Scenario: `裸文中的 claude mcp add 不计入`
  - **Files:**
    - Create: `src/install/__tests__/parse-claude-mcp-add.test.ts`
    - Create: `src/install/parse-claude-mcp-add.ts`
  - [x] **RED:** Write failing test — `src/install/__tests__/parse-claude-mcp-add.test.ts`
    - Behavior under test: scan README markdown, find `claude mcp add` lines inside fenced code blocks only, parse into structured result
    - Expected failure reason: module does not exist
    ```typescript
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
    ```
  - [x] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/parse-claude-mcp-add.test.ts`
    - **Observed output (fill during apply):**
      ```
      FAIL src/install/__tests__/parse-claude-mcp-add.test.ts
      Cannot find module '../parse-claude-mcp-add.js'
      Test Files  1 failed (1)
      ```
  - [x] **GREEN:** Write minimal implementation — `src/install/parse-claude-mcp-add.ts`
    ```typescript
    import { tokenize } from "./shell-tokenize.js";

    export interface ClaudeMcpAddResult {
      readonly name: string;
      readonly transport: "stdio" | "http";
      readonly command?: string;
      readonly args?: readonly string[];
      readonly url?: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly envKeys: readonly string[];
    }

    const FENCE_RE = /```[^\n]*\n([\s\S]*?)```/g;

    export function parseClaudeMcpAdd(markdown: string): ClaudeMcpAddResult | undefined {
      for (const match of markdown.matchAll(FENCE_RE)) {
        const body = match[1] ?? "";
        for (const line of body.split("\n")) {
          const trimmed = line.trim();
          if (!/^claude\s+mcp\s+add\b/.test(trimmed)) continue;
          const result = parseLine(trimmed);
          if (result) return result;
        }
      }
      return undefined;
    }

    function parseLine(line: string): ClaudeMcpAddResult | undefined {
      const tokens = tokenize(line);
      let i = 3; // skip "claude", "mcp", "add"
      const envKeys: string[] = [];
      let transport: "stdio" | "http" = "stdio";
      let url: string | undefined;
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (t === "-e" || t === "--env") {
          const pair = tokens[i + 1] ?? "";
          const key = pair.split("=")[0];
          if (key) envKeys.push(key);
          i += 2;
          continue;
        }
        if (t === "-t" || t === "--transport") {
          const v = tokens[i + 1];
          if (v === "http" || v === "sse") transport = "http";
          i += 2;
          continue;
        }
        if (t === "--url") {
          url = tokens[i + 1];
          i += 2;
          continue;
        }
        if (t === "--") { i++; break; }
        if (t.startsWith("-")) { i += 2; continue; } // unknown flag with value
        break;
      }
      const name = tokens[i++];
      if (!name) return undefined;
      if (transport === "http") {
        return { name, transport: "http", url, headers: {}, envKeys };
      }
      const command = tokens[i++];
      if (!command) return undefined;
      const args = tokens.slice(i);
      return { name, transport: "stdio", command, args, envKeys };
    }
    ```
  - [x] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/parse-claude-mcp-add.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      ✓ src/install/__tests__/parse-claude-mcp-add.test.ts (5 tests) 2ms
      Test Files  1 passed (1)  Tests  5 passed (5)
      Full suite: Test Files 10 passed (10), Tests 81 passed (81)
      ```
  - [x] **REFACTOR:** Switched from i-pointer-as-name to positionals-list classifier — flags can now interleave around the name, matching real `claude mcp add` usage.
  - [x] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      Test Files  10 passed (10)
      Tests  81 passed (81)
      ```
  - [x] **Commit:** `feat(install): parse claude mcp add CLI lines from README`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `180de9a`

- [x] 3.2 Implement JSON block parsers (P2 mcpServers + P3 bare shape)
  - kind: unit-test
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `单 server 的 mcpServers block`
    - `readme-analysis/spec.md` → Scenario: `多 server 的 mcpServers block`
    - `readme-analysis/spec.md` → Scenario: `env 键抽取`
    - `readme-analysis/spec.md` → Scenario: `裸 stdio 配置`
    - `readme-analysis/spec.md` → Scenario: `裸 http 配置`
  - **Files:**
    - Create: `src/install/__tests__/parse-json-block.test.ts`
    - Create: `src/install/parse-json-block.ts`
  - [x] **RED:** Write failing test — `src/install/__tests__/parse-json-block.test.ts`
    - Behavior under test: scan fenced JSON code blocks, classify as mcpServers-shape or bare-shape, return normalized ServerCandidate list
    - Expected failure reason: module does not exist
    ```typescript
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
    ```
  - [x] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/parse-json-block.test.ts`
    - **Observed output (fill during apply):**
      ```
      FAIL src/install/__tests__/parse-json-block.test.ts
      Cannot find module '../parse-json-block.js'
      Test Files  1 failed (1)
      ```
  - [x] **GREEN:** Write minimal implementation — `src/install/parse-json-block.ts`
    ```typescript
    export interface JsonBlockCandidate {
      readonly source: "mcpServers" | "bare";
      readonly name: string | undefined;
      readonly transport: "stdio" | "http";
      readonly command?: string;
      readonly args?: readonly string[];
      readonly url?: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly envKeys: readonly string[];
    }

    const FENCE_RE = /```(?:json|jsonc|json5)?\s*\n([\s\S]*?)```/g;

    export function parseJsonBlocks(markdown: string): JsonBlockCandidate[] {
      const out: JsonBlockCandidate[] = [];
      for (const match of markdown.matchAll(FENCE_RE)) {
        const body = (match[1] ?? "").trim();
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { continue; }
        if (typeof parsed !== "object" || parsed === null) continue;
        const obj = parsed as Record<string, unknown>;
        const servers = obj["mcpServers"];
        if (servers && typeof servers === "object") {
          for (const [name, cfg] of Object.entries(servers as Record<string, unknown>)) {
            const candidate = classifyConfig(name, cfg);
            if (candidate) out.push({ ...candidate, source: "mcpServers" });
          }
          continue;
        }
        const candidate = classifyConfig(undefined, obj);
        if (candidate) out.push({ ...candidate, source: "bare" });
      }
      return out;
    }

    function classifyConfig(
      name: string | undefined,
      raw: unknown,
    ): Omit<JsonBlockCandidate, "source"> | undefined {
      if (typeof raw !== "object" || raw === null) return undefined;
      const cfg = raw as Record<string, unknown>;
      const command = typeof cfg["command"] === "string" ? (cfg["command"] as string) : undefined;
      const url =
        typeof cfg["url"] === "string"
          ? (cfg["url"] as string)
          : typeof cfg["serverUrl"] === "string"
            ? (cfg["serverUrl"] as string)
            : undefined;
      const envObj = cfg["env"];
      const envKeys =
        envObj && typeof envObj === "object"
          ? Object.keys(envObj as Record<string, unknown>)
          : [];
      if (command) {
        const args = Array.isArray(cfg["args"]) ? ((cfg["args"] as unknown[]).filter((a) => typeof a === "string") as string[]) : [];
        return { name, transport: "stdio", command, args, envKeys };
      }
      if (url) {
        const headersRaw = cfg["headers"];
        const headers =
          headersRaw && typeof headersRaw === "object"
            ? (headersRaw as Record<string, string>)
            : {};
        return { name, transport: "http", url, headers, envKeys };
      }
      return undefined;
    }
    ```
  - [x] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/parse-json-block.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      ✓ src/install/__tests__/parse-json-block.test.ts (6 tests) 2ms
      Test Files  1 passed (1)  Tests  6 passed (6)
      Full suite: Test Files 11 passed (11), Tests 87 passed (87)
      ```
  - [x] **REFACTOR:** None — already minimal
  - [x] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      Test Files  11 passed (11)  Tests  87 passed (87)
      ```
  - [x] **Commit:** `feat(install): parse mcpServers and bare JSON blocks from README`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `4ef1e26`

- [x] 3.3 Implement manifest fallback (P4) + analyze orchestration
  - kind: unit-test
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `package.json 存在`
    - `readme-analysis/spec.md` → Scenario: `pyproject.toml 存在`
    - `readme-analysis/spec.md` → Scenario: `所有兜底均失败`
    - `readme-analysis/spec.md` → Scenario: `P1 有结果, P2 提供 env 键`
    - `readme-analysis/spec.md` → Scenario: `P1 和 P2 的 name 冲突`
  - **Files:**
    - Create: `src/install/__tests__/analyze.test.ts`
    - Create: `src/install/analyze.ts`
    - Create: `src/install/manifest-remote.ts`
  - [x] **RED:** Write failing test — `src/install/__tests__/analyze.test.ts`
    - Behavior under test: analyzeFromGitHub merges P1 (authoritative) + P2 (env补充), falls back to P3 → P4 → throws
    - Expected failure reason: analyze module does not exist
    ```typescript
    import { describe, it, expect, vi } from "vitest";
    import { analyzeFromGitHub } from "../analyze.js";

    const deps = {
      fetchReadme: vi.fn(),
      fetchManifest: vi.fn(),
    };

    function reset() {
      deps.fetchReadme.mockReset();
      deps.fetchManifest.mockReset();
    }

    describe("analyzeFromGitHub", () => {
      it("prefers P1 (claude mcp add) and merges env keys from P2", async () => {
        reset();
        deps.fetchReadme.mockResolvedValue(
          [
            "```sh",
            "claude mcp add blender uvx blender-mcp",
            "```",
            "```json",
            '{"mcpServers": {"blender": {"command": "uvx", "args": ["blender-mcp"], "env": {"BLENDER_HOST": "x"}}}}',
            "```",
          ].join("\n"),
        );
        const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
        expect(result.name).toBe("blender");
        expect(result.default.transport).toBe("stdio");
        if (result.default.transport === "stdio") {
          expect(result.default.command).toBe("uvx");
          expect(result.default.args).toEqual(["blender-mcp"]);
        }
        expect(result.requiredEnvVars).toEqual(["BLENDER_HOST"]);
      });

      it("P1 name wins when P1 and P2 disagree", async () => {
        reset();
        deps.fetchReadme.mockResolvedValue(
          [
            "```sh",
            "claude mcp add name-from-p1 uvx pkg",
            "```",
            "```json",
            '{"mcpServers": {"different-name": {"command": "uvx", "args": ["pkg"]}}}',
            "```",
          ].join("\n"),
        );
        const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
        expect(result.name).toBe("name-from-p1");
      });

      it("falls back to P2 when P1 absent", async () => {
        reset();
        deps.fetchReadme.mockResolvedValue(
          '```json\n{"mcpServers": {"figma": {"command": "npx", "args": ["-y", "figma-mcp"]}}}\n```',
        );
        const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
        expect(result.name).toBe("figma");
      });

      it("falls back to manifest when P1-P3 all absent", async () => {
        reset();
        deps.fetchReadme.mockResolvedValue("# just prose, no code blocks");
        deps.fetchManifest.mockImplementation(async (name: string) => {
          if (name === "package.json") return JSON.stringify({ name: "repo-pkg" });
          return undefined;
        });
        const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
        expect(result.name).toBe("repo-pkg");
        if (result.default.transport === "stdio") {
          expect(result.default.command).toBe("npx");
          expect(result.default.args).toEqual(["-y", "repo-pkg"]);
        }
      });

      it("uses pyproject.toml name when package.json absent", async () => {
        reset();
        deps.fetchReadme.mockResolvedValue("no code blocks");
        deps.fetchManifest.mockImplementation(async (name: string) => {
          if (name === "pyproject.toml") return '[project]\nname = "py-mcp"\n';
          return undefined;
        });
        const result = await analyzeFromGitHub({ owner: "a", repo: "b" }, deps);
        expect(result.name).toBe("py-mcp");
        if (result.default.transport === "stdio") {
          expect(result.default.command).toBe("uvx");
          expect(result.default.args).toEqual(["py-mcp"]);
        }
      });

      it("throws when everything fails", async () => {
        reset();
        deps.fetchReadme.mockResolvedValue("no blocks here");
        deps.fetchManifest.mockResolvedValue(undefined);
        await expect(analyzeFromGitHub({ owner: "a", repo: "b" }, deps)).rejects.toThrow(
          /could not extract/i,
        );
      });
    });
    ```
  - [x] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/analyze.test.ts`
    - **Observed output (fill during apply):**
      ```
      FAIL src/install/__tests__/analyze.test.ts
      Cannot find module '../analyze.js'
      Test Files  1 failed (1)
      ```
  - [x] **GREEN:** Write minimal implementation — `src/install/analyze.ts` and `src/install/manifest-remote.ts`
    ```typescript
    // src/install/manifest-remote.ts
    export async function fetchManifestDefault(
      ref: { owner: string; repo: string },
      name: string,
    ): Promise<string | undefined> {
      const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD/${name}`;
      const res = await fetch(url);
      if (!res.ok) return undefined;
      return await res.text();
    }

    export function parsePackageJsonName(text: string): string | undefined {
      try {
        const pkg = JSON.parse(text) as { name?: unknown };
        if (typeof pkg.name === "string") return pkg.name;
      } catch { /* noop */ }
      return undefined;
    }

    export function parsePyprojectName(text: string): string | undefined {
      const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
      return m?.[1];
    }
    ```
    ```typescript
    // src/install/analyze.ts
    import type { GitHubRef } from "./source.js";
    import { parseClaudeMcpAdd } from "./parse-claude-mcp-add.js";
    import { parseJsonBlocks } from "./parse-json-block.js";
    import { parsePackageJsonName, parsePyprojectName } from "./manifest-remote.js";
    import type { DefaultConfig } from "../types.js";

    export interface AnalysisResult {
      readonly name: string;
      readonly default: DefaultConfig;
      readonly overrides: Readonly<Record<string, never>>;
      readonly requiredEnvVars: readonly string[];
    }

    export interface AnalyzeDeps {
      fetchReadme: (ref: GitHubRef) => Promise<string>;
      fetchManifest: (ref: GitHubRef, name: string) => Promise<string | undefined>;
    }

    export async function analyzeFromGitHub(
      ref: GitHubRef,
      deps: AnalyzeDeps,
    ): Promise<AnalysisResult> {
      const readme = await deps.fetchReadme(ref);
      const p1 = parseClaudeMcpAdd(readme);
      const candidates = parseJsonBlocks(readme);
      const p2 = candidates.find((c) => c.source === "mcpServers");
      const p3 = candidates.find((c) => c.source === "bare");

      if (p1) {
        const envKeys = mergeEnvKeys(p1.envKeys, p2?.envKeys ?? []);
        return toResult(p1.name, p1, envKeys);
      }
      if (p2) return toResult(p2.name ?? ref.repo, p2, p2.envKeys);
      if (p3) return toResult(ref.repo, p3, p3.envKeys);

      const pkgRaw = await deps.fetchManifest(ref, "package.json");
      if (pkgRaw) {
        const name = parsePackageJsonName(pkgRaw);
        if (name) {
          return {
            name,
            default: { transport: "stdio", command: "npx", args: ["-y", name], env: {} },
            overrides: {},
            requiredEnvVars: [],
          };
        }
      }
      const pyRaw = await deps.fetchManifest(ref, "pyproject.toml");
      if (pyRaw) {
        const name = parsePyprojectName(pyRaw);
        if (name) {
          return {
            name,
            default: { transport: "stdio", command: "uvx", args: [name], env: {} },
            overrides: {},
            requiredEnvVars: [],
          };
        }
      }
      throw new Error(`Rule-based analysis could not extract MCP config from ${ref.owner}/${ref.repo}`);
    }

    function toResult(
      name: string | undefined,
      cand: { transport: "stdio" | "http"; command?: string; args?: readonly string[]; url?: string; headers?: Readonly<Record<string, string>> },
      envKeys: readonly string[],
    ): AnalysisResult {
      const resolvedName = name ?? "mcp-server";
      if (cand.transport === "stdio") {
        return {
          name: resolvedName,
          default: {
            transport: "stdio",
            command: cand.command ?? "",
            args: [...(cand.args ?? [])],
            env: {},
          },
          overrides: {},
          requiredEnvVars: envKeys,
        };
      }
      return {
        name: resolvedName,
        default: { transport: "http", url: cand.url ?? "", headers: { ...(cand.headers ?? {}) } },
        overrides: {},
        requiredEnvVars: envKeys,
      };
    }

    function mergeEnvKeys(p1: readonly string[], p2: readonly string[]): string[] {
      const set = new Set<string>(p1);
      for (const k of p2) set.add(k);
      return [...set];
    }
    ```
  - [x] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/analyze.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      ✓ src/install/__tests__/analyze.test.ts (6 tests)
      Test Files  12 passed (12)  Tests  93 passed (93)
      ```
  - [x] **REFACTOR:** Loosened FENCE_RE in parse-json-block.ts to match any fenced block (not just lang=json). Initial restrictive regex caused empty match between two adjacent fenced blocks of different langs (sh + json), masking the json content. Loose regex + JSON.parse-with-catch is the right approach.
  - [x] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      Test Files  12 passed (12)  Tests  93 passed (93)
      ```
  - [x] **Commit:** `feat(install): analyze pipeline with manifest fallback and P1/P2 merge`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<pending>`

## 4. Local source analysis

- [ ] 4.1 Implement local JSON multi-shape sniff
  - kind: unit-test
  - **Spec scenario(s):**
    - `local-source-analysis/spec.md` → Scenario: `ServerDefinition 形状`
    - `local-source-analysis/spec.md` → Scenario: `Claude Code / Gemini 的 mcpServers 形状`
    - `local-source-analysis/spec.md` → Scenario: `OpenCode 的 mcp 形状`
    - `local-source-analysis/spec.md` → Scenario: `Antigravity 的 serverUrl 形状`
    - `local-source-analysis/spec.md` → Scenario: `无任何已知形状`
    - `local-source-analysis/spec.md` → Scenario: `source 字段`
    - `central-storage/spec.md` → Scenario: `服务定义文件结构`
  - **Files:**
    - Create: `src/install/__tests__/local-json.test.ts`
    - Create: `src/install/local-json.ts`
  - [ ] **RED:** Write failing test — `src/install/__tests__/local-json.test.ts`
    - Behavior under test: given a JSON string/object, try known shapes in order, return list of ServerDefinition candidates
    - Expected failure reason: module does not exist
    ```typescript
    import { describe, it, expect } from "vitest";
    import { sniffLocalJson } from "../local-json.js";

    describe("sniffLocalJson", () => {
      it("recognizes ServerDefinition shape", () => {
        const raw = {
          name: "brave",
          source: "https://github.com/x/y",
          default: { transport: "stdio", command: "npx", args: ["-y", "brave"], env: {} },
          overrides: {},
        };
        const out = sniffLocalJson(raw);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ name: "brave", source: "https://github.com/x/y" });
      });

      it("recognizes Claude Code mcpServers shape", () => {
        const raw = {
          mcpServers: {
            a: { type: "stdio", command: "npx", args: ["-y", "a"] },
            b: { type: "stdio", command: "npx", args: ["-y", "b"] },
          },
        };
        const out = sniffLocalJson(raw);
        expect(out.map((d) => d.name).sort()).toEqual(["a", "b"]);
        expect(out[0]?.source).toBe("local");
      });

      it("recognizes OpenCode mcp shape (type local, command array)", () => {
        const raw = { mcp: { oc: { type: "local", command: ["npx", "-y", "oc-server"] } } };
        const out = sniffLocalJson(raw);
        expect(out).toHaveLength(1);
        expect(out[0]?.name).toBe("oc");
        if (out[0]?.default.transport === "stdio") {
          expect(out[0].default.command).toBe("npx");
          expect(out[0].default.args).toEqual(["-y", "oc-server"]);
        }
      });

      it("recognizes Antigravity serverUrl shape", () => {
        const raw = { mcpServers: { remote: { serverUrl: "https://x/mcp", headers: {} } } };
        const out = sniffLocalJson(raw);
        expect(out).toHaveLength(1);
        expect(out[0]?.default.transport).toBe("http");
      });

      it("throws when no known shape matches", () => {
        expect(() => sniffLocalJson({ something: "else" })).toThrow(/recognizable/i);
      });

      it("preserves ServerDefinition.source, assigns 'local' otherwise", () => {
        const withSource = sniffLocalJson({
          name: "x",
          source: "https://custom-url",
          default: { transport: "stdio", command: "c", args: [], env: {} },
          overrides: {},
        });
        expect(withSource[0]?.source).toBe("https://custom-url");

        const withoutSource = sniffLocalJson({
          mcpServers: { x: { command: "c", args: [] } },
        });
        expect(withoutSource[0]?.source).toBe("local");
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/local-json.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — `src/install/local-json.ts`
    ```typescript
    import type { ServerDefinition, DefaultConfig } from "../types.js";
    import { claudeCodeAdapter } from "../adapters/claude-code.js";
    import { opencodeAdapter } from "../adapters/opencode.js";
    import { antigravityAdapter } from "../adapters/antigravity.js";

    export function sniffLocalJson(raw: unknown): ServerDefinition[] {
      if (typeof raw !== "object" || raw === null) {
        throw new Error("No recognizable MCP server shape (not an object)");
      }
      const obj = raw as Record<string, unknown>;

      if (isServerDefinition(obj)) {
        return [
          {
            name: obj["name"] as string,
            source: typeof obj["source"] === "string" ? (obj["source"] as string) : "local",
            default: obj["default"] as DefaultConfig,
            overrides: (obj["overrides"] as ServerDefinition["overrides"]) ?? {},
          },
        ];
      }

      const mcpServers = obj["mcpServers"];
      if (mcpServers && typeof mcpServers === "object") {
        const entries = Object.entries(mcpServers as Record<string, unknown>);
        return entries.map(([name, entry]) => {
          const cfg =
            antigravityAdapter.fromAgentFormat(name, entry as Record<string, unknown>) ??
            claudeCodeAdapter.fromAgentFormat(name, entry as Record<string, unknown>);
          if (!cfg) throw new Error(`Cannot parse mcpServers entry "${name}"`);
          return { name, source: "local", default: cfg, overrides: {} };
        });
      }

      const mcp = obj["mcp"];
      if (mcp && typeof mcp === "object") {
        const entries = Object.entries(mcp as Record<string, unknown>);
        return entries.map(([name, entry]) => {
          const cfg = opencodeAdapter.fromAgentFormat(name, entry as Record<string, unknown>);
          if (!cfg) throw new Error(`Cannot parse mcp entry "${name}"`);
          return { name, source: "local", default: cfg, overrides: {} };
        });
      }

      throw new Error("No recognizable MCP server shape (tried ServerDefinition, mcpServers, mcp)");
    }

    function isServerDefinition(obj: Record<string, unknown>): boolean {
      return (
        typeof obj["name"] === "string" &&
        typeof obj["default"] === "object" &&
        obj["default"] !== null
      );
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/local-json.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** None — already minimal
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `feat(install): sniff local JSON across ServerDefinition/mcpServers/mcp shapes`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

- [ ] 4.2 Implement local directory manifest detection
  - kind: unit-test
  - **Spec scenario(s):**
    - `local-source-analysis/spec.md` → Scenario: `Node.js 项目`
    - `local-source-analysis/spec.md` → Scenario: `Python 项目`
    - `local-source-analysis/spec.md` → Scenario: `无 manifest`
  - **Files:**
    - Create: `src/install/__tests__/local-dir.test.ts`
    - Create: `src/install/local-dir.ts`
  - [ ] **RED:** Write failing test — `src/install/__tests__/local-dir.test.ts`
    - Behavior under test: given a directory path, detect project type from manifest files, return suggested command/args, or undefined
    - Expected failure reason: module does not exist
    ```typescript
    import { describe, it, expect, beforeEach, afterEach } from "vitest";
    import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
    import { join } from "node:path";
    import { tmpdir } from "node:os";
    import { detectProjectFromDir } from "../local-dir.js";

    let tmp: string;

    beforeEach(async () => {
      tmp = await mkdtemp(join(tmpdir(), "local-dir-"));
    });
    afterEach(async () => {
      await rm(tmp, { recursive: true });
    });

    describe("detectProjectFromDir", () => {
      it("detects Node.js via package.json", async () => {
        await writeFile(join(tmp, "package.json"), JSON.stringify({ name: "my-pkg" }));
        const out = await detectProjectFromDir(tmp);
        expect(out).toEqual({
          name: "my-pkg",
          type: "node",
          command: "npx",
          args: ["-y", tmp],
        });
      });

      it("detects Python via pyproject.toml", async () => {
        await writeFile(join(tmp, "pyproject.toml"), '[project]\nname = "py-mcp"\n');
        const out = await detectProjectFromDir(tmp);
        expect(out).toEqual({
          name: "py-mcp",
          type: "python",
          command: "uvx",
          args: ["--from", tmp, "py-mcp"],
        });
      });

      it("returns undefined when no manifest found", async () => {
        await mkdir(join(tmp, "empty"), { recursive: true });
        const out = await detectProjectFromDir(join(tmp, "empty"));
        expect(out).toBeUndefined();
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/local-dir.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — `src/install/local-dir.ts`
    ```typescript
    import { existsSync } from "node:fs";
    import { readFile } from "node:fs/promises";
    import { join, basename } from "node:path";

    export interface DetectedProject {
      readonly name: string;
      readonly type: "python" | "node";
      readonly command: string;
      readonly args: readonly string[];
    }

    export async function detectProjectFromDir(dir: string): Promise<DetectedProject | undefined> {
      const py = join(dir, "pyproject.toml");
      if (existsSync(py)) {
        const text = await readFile(py, "utf-8");
        const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
        const name = m?.[1] ?? basename(dir);
        return { name, type: "python", command: "uvx", args: ["--from", dir, name] };
      }
      const pkg = join(dir, "package.json");
      if (existsSync(pkg)) {
        const raw = await readFile(pkg, "utf-8");
        const parsed = JSON.parse(raw) as { name?: string };
        const name = parsed.name ?? basename(dir);
        return { name, type: "node", command: "npx", args: ["-y", dir] };
      }
      return undefined;
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/local-dir.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** None — already minimal
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `feat(install): detect node/python projects from local directory manifest`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

- [ ] 4.3 Implement multi-server interactive selection helper
  - kind: unit-test
  - **Spec scenario(s):**
    - `local-source-analysis/spec.md` → Scenario: `多 server 交互式选择`
  - **Files:**
    - Create: `src/install/__tests__/select-servers.test.ts`
    - Create: `src/install/select-servers.ts`
  - [ ] **RED:** Write failing test — `src/install/__tests__/select-servers.test.ts`
    - Behavior under test: buildChoices maps a list of candidates to inquirer `checkbox` choices with all `checked: true` by default; selectServers delegates to injected `checkbox` function
    - Expected failure reason: module does not exist
    ```typescript
    import { describe, it, expect, vi } from "vitest";
    import { buildChoices, selectServers } from "../select-servers.js";
    import type { ServerDefinition } from "../../types.js";

    const defs: ServerDefinition[] = [
      { name: "a", source: "local", default: { transport: "stdio", command: "c", args: [], env: {} }, overrides: {} },
      { name: "b", source: "local", default: { transport: "stdio", command: "c", args: [], env: {} }, overrides: {} },
    ];

    describe("buildChoices", () => {
      it("maps each definition to a checked choice", () => {
        expect(buildChoices(defs)).toEqual([
          { name: "a (stdio: c)", value: "a", checked: true },
          { name: "b (stdio: c)", value: "b", checked: true },
        ]);
      });
    });

    describe("selectServers", () => {
      it("returns all entries when single candidate (no prompt)", async () => {
        const checkbox = vi.fn();
        const out = await selectServers([defs[0]!], { checkbox });
        expect(out).toEqual([defs[0]]);
        expect(checkbox).not.toHaveBeenCalled();
      });

      it("delegates to checkbox for multi-candidate, returns selected", async () => {
        const checkbox = vi.fn().mockResolvedValue(["b"]);
        const out = await selectServers(defs, { checkbox });
        expect(checkbox).toHaveBeenCalled();
        expect(out.map((d) => d.name)).toEqual(["b"]);
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/install/__tests__/select-servers.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — `src/install/select-servers.ts`
    ```typescript
    import type { ServerDefinition } from "../types.js";

    export interface Choice { readonly name: string; readonly value: string; readonly checked: boolean }

    export function buildChoices(defs: readonly ServerDefinition[]): Choice[] {
      return defs.map((d) => ({
        name: `${d.name} (${d.default.transport}: ${describe(d)})`,
        value: d.name,
        checked: true,
      }));
    }

    function describe(d: ServerDefinition): string {
      if (d.default.transport === "stdio") return d.default.command;
      return d.default.url;
    }

    type CheckboxFn = (opts: { message: string; choices: Choice[] }) => Promise<string[]>;

    export async function selectServers(
      defs: readonly ServerDefinition[],
      deps: { checkbox: CheckboxFn },
    ): Promise<ServerDefinition[]> {
      if (defs.length <= 1) return [...defs];
      const chosen = await deps.checkbox({
        message: `Select servers to install (${defs.length} found):`,
        choices: buildChoices(defs),
      });
      const set = new Set(chosen);
      return defs.filter((d) => set.has(d.name));
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/install/__tests__/select-servers.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** None — already minimal
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `feat(install): add multi-server interactive selection helper`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

## 5. Install command refactor

- [ ] 5.1 Wire install from GitHub source to use analyze pipeline
  - kind: unit-test
  - **Spec scenario(s):**
    - `server-management/spec.md` → Scenario: `使用 GitHub 简写添加`
    - `server-management/spec.md` → Scenario: `使用完整 GitHub URL 添加`
    - `server-management/spec.md` → Scenario: `用户信任分析结果`
    - `server-management/spec.md` → Scenario: `用户不信任分析结果`
    - `central-storage/spec.md` → Scenario: `source 字段记录来源`
    - `central-storage/spec.md` → Scenario: `servers 目录按需创建`
    - `readme-analysis/spec.md` → Scenario: `全部优先级失败后的用户提示`
  - **Files:**
    - Create: `src/commands/__tests__/install-remote.test.ts`
    - Modify: `src/commands/install.ts`
  - [ ] **RED:** Write failing test — `src/commands/__tests__/install-remote.test.ts`
    - Behavior under test: `installFromRemote(input, deps)` calls analyze, shows result, writes ServerDefinition with user-provided env values when trusted
    - Expected failure reason: deps interface not exposed yet
    ```typescript
    import { describe, it, expect, vi } from "vitest";
    import type { AnalysisResult } from "../../install/analyze.js";
    import { installFromRemote } from "../install.js";

    describe("installFromRemote", () => {
      it("writes ServerDefinition with source preserved and env filled", async () => {
        const analysis: AnalysisResult = {
          name: "pkg",
          default: { transport: "stdio", command: "npx", args: ["-y", "pkg"], env: {} },
          overrides: {},
          requiredEnvVars: ["API_KEY"],
        };
        const write = vi.fn().mockResolvedValue(undefined);
        await installFromRemote("owner/repo", {
          analyze: async () => analysis,
          confirm: async () => true,
          askEnvValue: async (k) => (k === "API_KEY" ? "secret" : ""),
          serverExists: () => false,
          writeServerDefinition: write,
          fallbackToManual: async () => { throw new Error("should not fallback"); },
        });
        expect(write).toHaveBeenCalledWith(expect.objectContaining({
          name: "pkg",
          source: "owner/repo",
          default: expect.objectContaining({ env: { API_KEY: "secret" } }),
        }));
      });

      it("falls back to manual flow when analyze throws and user agrees", async () => {
        const fallback = vi.fn().mockResolvedValue(undefined);
        await installFromRemote("owner/repo", {
          analyze: async () => { throw new Error("no match"); },
          confirm: async () => true,
          askEnvValue: async () => "",
          serverExists: () => false,
          writeServerDefinition: vi.fn(),
          fallbackToManual: fallback,
        });
        expect(fallback).toHaveBeenCalled();
      });

      it("does not write when user does not trust analysis and declines manual", async () => {
        const analysis: AnalysisResult = {
          name: "pkg",
          default: { transport: "stdio", command: "npx", args: [], env: {} },
          overrides: {},
          requiredEnvVars: [],
        };
        const write = vi.fn();
        let called = 0;
        await installFromRemote("owner/repo", {
          analyze: async () => analysis,
          confirm: async () => { called++; return false; },
          askEnvValue: async () => "",
          serverExists: () => false,
          writeServerDefinition: write,
          fallbackToManual: async () => { /* noop */ },
        });
        expect(write).not.toHaveBeenCalled();
        expect(called).toBeGreaterThanOrEqual(2);
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/commands/__tests__/install-remote.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — update `src/commands/install.ts`
    ```typescript
    // In src/commands/install.ts (only the exported installFromRemote function shown; full file integrates with analyze pipeline and exposes the deps-based signature for testing)
    import type { AnalysisResult } from "../install/analyze.js";
    import type { ServerDefinition, StdioConfig, HttpConfig } from "../types.js";

    export interface InstallFromRemoteDeps {
      analyze: (input: string) => Promise<AnalysisResult>;
      confirm: (message: string) => Promise<boolean>;
      askEnvValue: (key: string) => Promise<string>;
      serverExists: (name: string) => boolean;
      writeServerDefinition: (def: ServerDefinition) => Promise<void>;
      fallbackToManual: () => Promise<void>;
    }

    export async function installFromRemote(
      input: string,
      deps: InstallFromRemoteDeps,
    ): Promise<void> {
      let analysis: AnalysisResult;
      try {
        analysis = await deps.analyze(input);
      } catch (err) {
        const go = await deps.confirm(
          `Rule-based analysis could not extract MCP config from ${input}. Configure manually instead?`,
        );
        if (go) await deps.fallbackToManual();
        return;
      }
      const trusted = await deps.confirm(`Trust this analysis result?`);
      if (!trusted) {
        const go = await deps.confirm("Configure manually instead?");
        if (go) await deps.fallbackToManual();
        return;
      }
      if (deps.serverExists(analysis.name)) {
        const overwrite = await deps.confirm(
          `Server "${analysis.name}" already exists. Overwrite?`,
        );
        if (!overwrite) return;
      }
      const env: Record<string, string> = {};
      for (const k of analysis.requiredEnvVars) env[k] = await deps.askEnvValue(k);
      const base = analysis.default;
      const merged =
        base.transport === "stdio"
          ? ({ ...base, env: { ...base.env, ...env } } as StdioConfig)
          : (base as HttpConfig);
      const def: ServerDefinition = {
        name: analysis.name,
        source: input,
        default: merged,
        overrides: {},
      };
      await deps.writeServerDefinition(def);
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/commands/__tests__/install-remote.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** Wire the real-deps entry point (top-level `installCommand`) to call `installFromRemote` with production deps (fetchReadme from `github-readme`, confirm/input/password from `@inquirer/prompts`, `writeServerDefinition` from `server-store`, etc.).
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `refactor(install): wire remote install to rule-based analyze pipeline`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

- [ ] 5.2 Wire install from local file/directory to local-source-analysis
  - kind: unit-test
  - **Spec scenario(s):**
    - `server-management/spec.md` → Scenario: `install 指向项目目录`
    - `server-management/spec.md` → Scenario: `install 指向单 server JSON`
    - `server-management/spec.md` → Scenario: `install 指向多 server JSON`
    - `server-management/spec.md` → Scenario: `文件不是合法 JSON`
    - `server-management/spec.md` → Scenario: `路径不存在`
    - `local-source-analysis/spec.md` → Scenario: `同名冲突`
    - `central-storage/spec.md` → Scenario: `本地安装的 source 标记`
  - **Files:**
    - Create: `src/commands/__tests__/install-local.test.ts`
    - Modify: `src/commands/install.ts`
  - [ ] **RED:** Write failing test — `src/commands/__tests__/install-local.test.ts`
    - Behavior under test: `installFromLocal(path, deps)` dispatches to JSON sniff or directory detect; invalid JSON surfaces error; multi-server triggers selectServers
    - Expected failure reason: function not exported / signature mismatch
    ```typescript
    import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
    import { mkdtemp, rm, writeFile } from "node:fs/promises";
    import { join } from "node:path";
    import { tmpdir } from "node:os";
    import { installFromLocal } from "../install.js";

    let tmp: string;

    beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), "install-local-")); });
    afterEach(async () => { await rm(tmp, { recursive: true }); });

    describe("installFromLocal", () => {
      it("writes from single-server JSON file", async () => {
        const path = join(tmp, "mcp.json");
        await writeFile(path, JSON.stringify({
          mcpServers: { foo: { command: "npx", args: ["-y", "foo"] } },
        }));
        const write = vi.fn();
        await installFromLocal(path, {
          writeServerDefinition: write,
          serverExists: () => false,
          selectServers: async (defs) => [...defs],
          askEnvValue: async () => "",
          confirm: async () => true,
          fallbackToManual: async () => {},
        });
        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith(expect.objectContaining({ name: "foo", source: "local" }));
      });

      it("prompts for selection on multi-server JSON", async () => {
        const path = join(tmp, "multi.json");
        await writeFile(path, JSON.stringify({
          mcpServers: { a: { command: "x", args: [] }, b: { command: "y", args: [] } },
        }));
        const selectServers = vi.fn().mockImplementation(async (defs) => [defs[0]]);
        const write = vi.fn();
        await installFromLocal(path, {
          writeServerDefinition: write,
          serverExists: () => false,
          selectServers,
          askEnvValue: async () => "",
          confirm: async () => true,
          fallbackToManual: async () => {},
        });
        expect(selectServers).toHaveBeenCalled();
        expect(write).toHaveBeenCalledTimes(1);
      });

      it("surfaces error when JSON invalid", async () => {
        const path = join(tmp, "bad.json");
        await writeFile(path, "{ not json");
        await expect(
          installFromLocal(path, {
            writeServerDefinition: vi.fn(),
            serverExists: () => false,
            selectServers: async (defs) => [...defs],
            askEnvValue: async () => "",
            confirm: async () => true,
            fallbackToManual: async () => {},
          }),
        ).rejects.toThrow(/JSON/);
      });

      it("detects Node.js project from directory", async () => {
        await writeFile(join(tmp, "package.json"), JSON.stringify({ name: "dir-pkg" }));
        const write = vi.fn();
        await installFromLocal(tmp, {
          writeServerDefinition: write,
          serverExists: () => false,
          selectServers: async (defs) => [...defs],
          askEnvValue: async () => "",
          confirm: async () => true,
          fallbackToManual: async () => {},
        });
        expect(write).toHaveBeenCalledWith(expect.objectContaining({
          name: "dir-pkg",
          source: "local",
        }));
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/commands/__tests__/install-local.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — update `src/commands/install.ts`
    ```typescript
    import { readFile, stat } from "node:fs/promises";
    import type { ServerDefinition, StdioConfig } from "../types.js";
    import { sniffLocalJson } from "../install/local-json.js";
    import { detectProjectFromDir } from "../install/local-dir.js";

    export interface InstallFromLocalDeps {
      writeServerDefinition: (def: ServerDefinition) => Promise<void>;
      serverExists: (name: string) => boolean;
      selectServers: (defs: readonly ServerDefinition[]) => Promise<readonly ServerDefinition[]>;
      askEnvValue: (key: string) => Promise<string>;
      confirm: (message: string) => Promise<boolean>;
      fallbackToManual: () => Promise<void>;
    }

    export async function installFromLocal(
      path: string,
      deps: InstallFromLocalDeps,
    ): Promise<void> {
      const info = await stat(path);
      if (info.isFile() && path.endsWith(".json")) {
        const raw = await readFile(path, "utf-8");
        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { throw new Error(`File is not valid JSON: ${path}`); }
        const defs = sniffLocalJson(parsed);
        const chosen = await deps.selectServers(defs);
        for (const d of chosen) await writeOne(d, deps);
        return;
      }
      if (info.isDirectory()) {
        const detected = await detectProjectFromDir(path);
        if (!detected) throw new Error(`Cannot detect project type in ${path}`);
        const def: ServerDefinition = {
          name: detected.name,
          source: "local",
          default: {
            transport: "stdio",
            command: detected.command,
            args: [...detected.args],
            env: {},
          } as StdioConfig,
          overrides: {},
        };
        await writeOne(def, deps);
        return;
      }
      throw new Error(`Unsupported local path: ${path}`);
    }

    async function writeOne(def: ServerDefinition, deps: InstallFromLocalDeps): Promise<void> {
      if (deps.serverExists(def.name)) {
        const overwrite = await deps.confirm(`Server "${def.name}" already exists. Overwrite?`);
        if (!overwrite) return;
      }
      await deps.writeServerDefinition(def);
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/commands/__tests__/install-local.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** Wire top-level `installCommand` dispatch so local file/dir routes to `installFromLocal` with production deps.
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `refactor(install): route local file/dir through sniff + detect pipeline`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

- [ ] 5.3 Reject non-GitHub URLs with clear message
  - kind: unit-test
  - **Spec scenario(s):**
    - `server-management/spec.md` → Scenario: `非 GitHub URL 拒绝`
    - `server-management/spec.md` → Scenario: `不支持的输入格式`
  - **Files:**
    - Create: `src/commands/__tests__/install-dispatch.test.ts`
    - Modify: `src/commands/install.ts`
  - [ ] **RED:** Write failing test — `src/commands/__tests__/install-dispatch.test.ts`
    - Behavior under test: input classifier — GitHub URL / owner-repo → remote, local path → local, non-GitHub URL → error, bare name → error
    - Expected failure reason: classifier not exposed
    ```typescript
    import { describe, it, expect } from "vitest";
    import { classifyInput } from "../install.js";

    describe("classifyInput", () => {
      it("recognizes GitHub owner/repo", () => {
        expect(classifyInput("anthropics/mcp-x")).toEqual({ kind: "github", value: "anthropics/mcp-x" });
      });
      it("recognizes GitHub URL", () => {
        expect(classifyInput("https://github.com/a/b")).toEqual({ kind: "github", value: "https://github.com/a/b" });
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
        expect(classifyInput("@scope/pkg")).toEqual({ kind: "error", reason: expect.any(String) });
      });
      it("recognizes local JSON path", () => {
        expect(classifyInput("./foo.json")).toEqual({ kind: "local", value: "./foo.json" });
      });
      it("recognizes local directory path", () => {
        expect(classifyInput("./my-dir")).toEqual({ kind: "local", value: "./my-dir" });
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/commands/__tests__/install-dispatch.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — expose `classifyInput` from `src/commands/install.ts`
    ```typescript
    // In src/commands/install.ts, export this function
    import { parseGitHubSource, isGitHubRepo } from "../install/source.js";

    export type ClassifiedInput =
      | { kind: "github"; value: string }
      | { kind: "local"; value: string }
      | { kind: "error"; reason: string };

    const LOCAL_PREFIXES = ["/", "./", "../", "~/", "~"];

    export function classifyInput(input: string): ClassifiedInput {
      const trimmed = input.trim();
      if (LOCAL_PREFIXES.some((p) => trimmed.startsWith(p))) {
        return { kind: "local", value: trimmed };
      }
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const ref = parseGitHubSource(trimmed);
        if (ref) return { kind: "github", value: trimmed };
        return {
          kind: "error",
          reason: "Only GitHub URLs are supported for remote install. Use ./path.json for other sources.",
        };
      }
      if (isGitHubRepo(trimmed)) return { kind: "github", value: trimmed };
      return {
        kind: "error",
        reason:
          'Invalid input. Provide a GitHub URL (https://github.com/owner/repo), owner/repo shortname, or a local path (./file.json | ./dir).',
      };
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/commands/__tests__/install-dispatch.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** Replace the legacy `detectSourceType` flow in `installCommand` with `classifyInput` dispatch; emit the error message and `process.exitCode = 1` for the `error` branch.
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `refactor(install): classify input and reject non-GitHub remote sources`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

## 6. Update command refactor

- [ ] 6.1 Update command runs rule-based analyze on remote sources
  - kind: unit-test
  - **Spec scenario(s):**
    - `update-command/spec.md` → Scenario: `更新指定服务`
    - `update-command/spec.md` → Scenario: `更新所有服务`
    - `update-command/spec.md` → Scenario: `服务不存在`
    - `update-command/spec.md` → Scenario: `source 为空或 local 的服务`
    - `update-command/spec.md` → Scenario: `更新时保留 env 值`
    - `update-command/spec.md` → Scenario: `批量更新中部分失败`
  - **Files:**
    - Create: `src/commands/__tests__/update-rule-based.test.ts`
    - Modify: `src/commands/update.ts`
  - [ ] **RED:** Write failing test — `src/commands/__tests__/update-rule-based.test.ts`
    - Behavior under test: `updateSingle(name, deps)` loads def, calls deps.analyze, merges env, calls deps.writeServerDefinition; batch-level helper tolerates errors
    - Expected failure reason: the tested helpers are not exported in the new shape
    ```typescript
    import { describe, it, expect, vi } from "vitest";
    import { updateSingle, updateAll } from "../update.js";
    import type { AnalysisResult } from "../../install/analyze.js";
    import type { ServerDefinition } from "../../types.js";

    const existing: ServerDefinition = {
      name: "pkg",
      source: "owner/repo",
      default: { transport: "stdio", command: "npx", args: ["-y", "pkg"], env: { API_KEY: "kept" } },
      overrides: {},
    };

    const newAnalysis: AnalysisResult = {
      name: "pkg",
      default: { transport: "stdio", command: "npx", args: ["-y", "pkg@2"], env: {} },
      overrides: {},
      requiredEnvVars: ["API_KEY"],
    };

    describe("updateSingle", () => {
      it("merges analysis, preserves existing env values", async () => {
        const write = vi.fn();
        const res = await updateSingle("pkg", {
          serverExists: () => true,
          readServerDefinition: async () => existing,
          analyze: async () => newAnalysis,
          confirm: async () => true,
          writeServerDefinition: write,
        });
        expect(res).toBe("updated");
        expect(write).toHaveBeenCalledWith(expect.objectContaining({
          name: "pkg",
          default: expect.objectContaining({ env: { API_KEY: "kept" } }),
        }));
      });

      it("reports 'missing' when server not in store", async () => {
        const res = await updateSingle("nope", {
          serverExists: () => false,
          readServerDefinition: async () => undefined,
          analyze: async () => newAnalysis,
          confirm: async () => true,
          writeServerDefinition: vi.fn(),
        });
        expect(res).toBe("missing");
      });

      it("reports 'no-source' when source is local", async () => {
        const local: ServerDefinition = { ...existing, source: "local" };
        const res = await updateSingle("pkg", {
          serverExists: () => true,
          readServerDefinition: async () => local,
          analyze: async () => newAnalysis,
          confirm: async () => true,
          writeServerDefinition: vi.fn(),
        });
        expect(res).toBe("no-source");
      });
    });

    describe("updateAll", () => {
      it("continues through failures and returns summary", async () => {
        const defs: ServerDefinition[] = [
          { ...existing, name: "a" },
          { ...existing, name: "b" },
          { ...existing, name: "c", source: "local" },
        ];
        const write = vi.fn();
        let callCount = 0;
        const summary = await updateAll({
          listServerDefinitions: async () => defs,
          updateSingle: async (name) => {
            callCount++;
            if (name === "b") throw new Error("network");
            if (name === "c") return "no-source";
            return "updated";
          },
        });
        expect(callCount).toBe(3);
        expect(summary).toEqual({ updated: 1, skipped: 1, failed: 1 });
      });
    });
    ```
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/commands/__tests__/update-rule-based.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Write minimal implementation — rewrite `src/commands/update.ts`
    ```typescript
    import type { ServerDefinition, DefaultConfig } from "../types.js";
    import type { AnalysisResult } from "../install/analyze.js";

    export interface UpdateSingleDeps {
      serverExists: (name: string) => boolean;
      readServerDefinition: (name: string) => Promise<ServerDefinition | undefined>;
      analyze: (source: string) => Promise<AnalysisResult>;
      confirm: (message: string) => Promise<boolean>;
      writeServerDefinition: (def: ServerDefinition) => Promise<void>;
    }

    export async function updateSingle(
      name: string,
      deps: UpdateSingleDeps,
    ): Promise<"updated" | "skipped" | "missing" | "no-source"> {
      if (!deps.serverExists(name)) return "missing";
      const def = await deps.readServerDefinition(name);
      if (!def) return "missing";
      if (!def.source || def.source === "local") return "no-source";

      const analysis = await deps.analyze(def.source);
      const merged = mergeDefault(def.default, analysis.default);
      if (JSON.stringify(def.default) === JSON.stringify(merged)) return "skipped";
      const proceed = await deps.confirm(`Update "${name}"?`);
      if (!proceed) return "skipped";
      await deps.writeServerDefinition({ ...def, default: merged });
      return "updated";
    }

    function mergeDefault(oldD: DefaultConfig, newD: DefaultConfig): DefaultConfig {
      if (oldD.transport !== "stdio" || newD.transport !== "stdio") return newD;
      const mergedEnv: Record<string, string> = { ...newD.env };
      for (const [k, v] of Object.entries(oldD.env)) if (k in mergedEnv) mergedEnv[k] = v;
      return { ...newD, env: mergedEnv };
    }

    export interface UpdateAllDeps {
      listServerDefinitions: () => Promise<readonly ServerDefinition[]>;
      updateSingle: (name: string) => Promise<"updated" | "skipped" | "missing" | "no-source">;
    }

    export async function updateAll(deps: UpdateAllDeps): Promise<{ updated: number; skipped: number; failed: number }> {
      const all = await deps.listServerDefinitions();
      let updated = 0, skipped = 0, failed = 0;
      for (const d of all) {
        try {
          const res = await deps.updateSingle(d.name);
          if (res === "updated") updated++;
          else skipped++;
        } catch {
          failed++;
        }
      }
      return { updated, skipped, failed };
    }
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/commands/__tests__/update-rule-based.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** Expose a thin top-level `updateCommand(name?)` wrapper that injects production deps (fetchGitHubReadme, writeServerDefinition, `@inquirer/prompts` confirm).
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `refactor(update): use rule-based analyze for remote sources`
    - Staging order: test file BEFORE production file
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

## 7. Removals and integration test migration

- [ ] 7.1 Remove src/services, src/utils/config.ts, setup command, GlobalConfig types; project still builds
  - kind: build-check
  - **Spec scenario(s):**
    - `glm-integration/spec.md` → Scenario: (all REMOVED requirements — no scenarios to cover; removal verified by absence)
    - `central-storage/spec.md` → Scenario: `服务定义文件结构`
    - `central-storage/spec.md` → Scenario: `source 字段记录来源`
    - `central-storage/spec.md` → Scenario: `本地安装的 source 标记`
    - `central-storage/spec.md` → Scenario: `文件权限`
    - `project-operations/spec.md` → Scenario: `init 命令中按 Ctrl-C`
    - `project-operations/spec.md` → Scenario: `add 命令中按 Ctrl-C`
    - `project-operations/spec.md` → Scenario: `remove 命令中按 Ctrl-C`
    - `project-operations/spec.md` → Scenario: `sync 命令中按 Ctrl-C`
    - `server-management/spec.md` → Scenario: `规则分析确认中按 Ctrl-C`
    - `server-management/spec.md` → Scenario: `手动模式中按 Ctrl-C`
    - `server-management/spec.md` → Scenario: `本地多 server 选择中按 Ctrl-C`
  - **Files:**
    - Delete: `src/services/glm-client.ts`
    - Delete: `src/services/system-prompt.ts`
    - Delete: `src/services/web-reader.ts`
    - Delete: `src/services/` (empty dir removal)
    - Delete: `src/commands/setup.ts`
    - Delete: `src/utils/config.ts`
    - Modify: `src/types.ts` (remove `GlobalConfig` interface)
    - Modify: `src/index.ts` (remove setup command, remove `requireSetup`)
    - Modify: `src/utils/server-store.ts` (ensure `~/.mcps-manager/servers/` created on demand)
  - [ ] **IMPLEMENT:** Remove the listed files, strip `GlobalConfig` from `types.ts`, drop `setup` registration and `requireSetup` guard from `index.ts`, and have `writeServerDefinition` mkdir the base+servers dirs when absent.
  - [ ] **BUILD-CHECK:** Run tsup build, confirm exit 0 (no dangling imports of deleted modules)
    - Command: `pnpm build`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `refactor: remove GLM/web-reader services and setup command`
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

- [ ] 7.2 Migrate integration tests to remove GLM imports
  - kind: unit-test
  - **Spec scenario(s):**
    - `server-management/spec.md` → Scenario: `使用 GitHub 简写添加`
    - `server-management/spec.md` → Scenario: `分析结果交互式确认 / 用户信任分析结果`
  - **Files:**
    - Modify: `src/__tests__/integration.test.ts`
  - [ ] **RED:** Update the test file's GLM imports; test run should fail because `../services/glm-client.js` no longer exists
    - Behavior under test: the integration test file previously imported `isGitHubRepo`, `isValidInput`, `buildUserMessage` from glm-client; these now live in `src/install/source.js` (the first two) while `buildUserMessage` is gone. The test should still exercise e2e deploy + list + sync + remove flows.
    - Expected failure reason: import `../services/glm-client.js` cannot be resolved after 7.1
    ```typescript
    // At the top of src/__tests__/integration.test.ts, replace the existing glm-client import block with:
    import { isGitHubRepo, isValidInput } from "../install/source.js";
    // (drop buildUserMessage — it no longer exists; any test citing GLM-specific behavior should be rewritten or removed.)
    ```
    The RED condition is that running `pnpm vitest run src/__tests__/integration.test.ts` after task 7.1 (but before editing this test) fails with an unresolved import.
  - [ ] **Verify RED:** Run test, confirm it fails for the expected reason
    - Command: `pnpm vitest run src/__tests__/integration.test.ts`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **GREEN:** Apply the import rewrite above and remove any assertions on `buildUserMessage`. Retain all other existing assertions around adapters, deploy, list, sync, remove. No new test code needed — just the import fix.
    ```typescript
    // Final src/__tests__/integration.test.ts imports:
    import { describe, it, expect, beforeEach, afterEach } from "vitest";
    import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
    import { join } from "node:path";
    import { tmpdir } from "node:os";
    import type { ServerDefinition, StdioConfig } from "../types.js";
    import { claudeCodeAdapter } from "../adapters/claude-code.js";
    import { codexAdapter } from "../adapters/codex.js";
    import { geminiCliAdapter } from "../adapters/gemini-cli.js";
    import { opencodeAdapter } from "../adapters/opencode.js";
    import { resolveConfig } from "../utils/resolve-config.js";
    import { isGitHubRepo, isValidInput } from "../install/source.js";
    // ... rest of file unchanged except removal of any buildUserMessage assertion
    ```
  - [ ] **Verify GREEN:** Run test + full suite, confirm pass
    - Command: `pnpm vitest run src/__tests__/integration.test.ts`
    - Full-suite command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **REFACTOR:** None — test file touched minimally.
  - [ ] **Verify REFACTOR:** Re-run tests, confirm still green
    - Command: `pnpm test`
    - **Observed output (fill during apply):**
      ```
      <to be filled by ts-apply>
      ```
  - [ ] **Commit:** `test(integration): rewire imports to src/install/source after GLM removal`
    - Staging order: test file BEFORE production file (production already committed in 7.1)
    - **Commit SHA (fill during apply):** `<to be filled by ts-apply>`

## 8. Documentation

- [ ] 8.1 Update README.md and docs/README_zh-CN.md to remove GLM references
  - kind: skip-doc-only
  - **Spec scenario(s):**
    - `readme-analysis/spec.md` → Scenario: `fetch README.md 成功` (documented in README)
  - [ ] **SKIP:** skip-doc-only — README updates are pure documentation reflecting code that has already been implemented and verified. Removing "AI-assisted setup / GLM-5" language from README.md and docs/README_zh-CN.md, updating the "How It Works" section, and removing `mcpsmgr setup` from the Quick Start. No runtime behavior to verify.

## Scenario Coverage Matrix

| Capability | Scenario | Covered by Task(s) | Test file:line |
|---|---|---|---|
| `readme-analysis` | `fetch README.md 成功` | Task 2.1 | `src/install/__tests__/github-readme.test.ts:16` |
| `readme-analysis` | `大小写兜底` | Task 2.1 | `src/install/__tests__/github-readme.test.ts:28` |
| `readme-analysis` | `gh CLI 降级` | Task 2.1, 2.2 | `src/install/__tests__/github-readme.test.ts:40` |
| `readme-analysis` | `全部失败` | Task 2.1 | `src/install/__tests__/github-readme.test.ts:55` |
| `readme-analysis` | `标准 claude mcp add name cmd args 行` | Task 1.1, 3.1 | `src/install/__tests__/parse-claude-mcp-add.test.ts:8` |
| `readme-analysis` | `含 -e KEY=VAL flag` | Task 1.1, 3.1 | `src/install/__tests__/parse-claude-mcp-add.test.ts:18` |
| `readme-analysis` | `含 --transport http --url` | Task 3.1 | `src/install/__tests__/parse-claude-mcp-add.test.ts:29` |
| `readme-analysis` | `裸文中的 claude mcp add 不计入` | Task 3.1 | `src/install/__tests__/parse-claude-mcp-add.test.ts:39` |
| `readme-analysis` | `单 server 的 mcpServers block` | Task 3.2 | `src/install/__tests__/parse-json-block.test.ts:8` |
| `readme-analysis` | `多 server 的 mcpServers block` | Task 3.2 | `src/install/__tests__/parse-json-block.test.ts:18` |
| `readme-analysis` | `env 键抽取` | Task 3.2 | `src/install/__tests__/parse-json-block.test.ts:24` |
| `readme-analysis` | `裸 stdio 配置` | Task 3.2 | `src/install/__tests__/parse-json-block.test.ts:30` |
| `readme-analysis` | `裸 http 配置` | Task 3.2 | `src/install/__tests__/parse-json-block.test.ts:42` |
| `readme-analysis` | `package.json 存在` | Task 3.3 | `src/install/__tests__/analyze.test.ts:58` |
| `readme-analysis` | `pyproject.toml 存在` | Task 3.3 | `src/install/__tests__/analyze.test.ts:71` |
| `readme-analysis` | `所有兜底均失败` | Task 3.3 | `src/install/__tests__/analyze.test.ts:85` |
| `readme-analysis` | `P1 有结果, P2 提供 env 键` | Task 3.3 | `src/install/__tests__/analyze.test.ts:14` |
| `readme-analysis` | `P1 和 P2 的 name 冲突` | Task 3.3 | `src/install/__tests__/analyze.test.ts:36` |
| `readme-analysis` | `全部优先级失败后的用户提示` | Task 5.1 | `src/commands/__tests__/install-remote.test.ts:38` |
| `local-source-analysis` | `Node.js 项目` | Task 4.2 | `src/install/__tests__/local-dir.test.ts:17` |
| `local-source-analysis` | `Python 项目` | Task 4.2 | `src/install/__tests__/local-dir.test.ts:26` |
| `local-source-analysis` | `无 manifest` | Task 4.2 | `src/install/__tests__/local-dir.test.ts:35` |
| `local-source-analysis` | `ServerDefinition 形状` | Task 4.1 | `src/install/__tests__/local-json.test.ts:10` |
| `local-source-analysis` | `Claude Code / Gemini 的 mcpServers 形状` | Task 4.1 | `src/install/__tests__/local-json.test.ts:20` |
| `local-source-analysis` | `OpenCode 的 mcp 形状` | Task 4.1 | `src/install/__tests__/local-json.test.ts:30` |
| `local-source-analysis` | `Antigravity 的 serverUrl 形状` | Task 4.1 | `src/install/__tests__/local-json.test.ts:40` |
| `local-source-analysis` | `无任何已知形状` | Task 4.1 | `src/install/__tests__/local-json.test.ts:46` |
| `local-source-analysis` | `多 server 交互式选择` | Task 4.3 | `src/install/__tests__/select-servers.test.ts:23` |
| `local-source-analysis` | `同名冲突` | Task 5.2 | `src/commands/__tests__/install-local.test.ts:38` |
| `local-source-analysis` | `source 字段` | Task 4.1, 5.2 | `src/install/__tests__/local-json.test.ts:52` |
| `server-management` | `使用 GitHub 简写添加` | Task 5.1, 7.2 | `src/commands/__tests__/install-remote.test.ts:14` |
| `server-management` | `使用完整 GitHub URL 添加` | Task 5.3 | `src/commands/__tests__/install-dispatch.test.ts:13` |
| `server-management` | `非 GitHub URL 拒绝` | Task 5.3 | `src/commands/__tests__/install-dispatch.test.ts:16` |
| `server-management` | `不支持的输入格式` | Task 5.3 | `src/commands/__tests__/install-dispatch.test.ts:22` |
| `server-management` | `install 指向项目目录` | Task 5.2 | `src/commands/__tests__/install-local.test.ts:68` |
| `server-management` | `路径不存在` | Task 5.2 | `src/commands/__tests__/install-local.test.ts` (implicit via stat failure) |
| `server-management` | `install 指向单 server JSON` | Task 5.2 | `src/commands/__tests__/install-local.test.ts:16` |
| `server-management` | `install 指向多 server JSON` | Task 5.2 | `src/commands/__tests__/install-local.test.ts:29` |
| `server-management` | `文件不是合法 JSON` | Task 5.2 | `src/commands/__tests__/install-local.test.ts:50` |
| `server-management` | `用户信任分析结果` | Task 5.1 | `src/commands/__tests__/install-remote.test.ts:14` |
| `server-management` | `用户不信任分析结果` | Task 5.1 | `src/commands/__tests__/install-remote.test.ts:52` |
| `server-management` | `规则分析确认中按 Ctrl-C` | Task 7.1 (build-check on existing isUserCancellation infra) | existing `src/utils/prompt.ts` |
| `server-management` | `手动模式中按 Ctrl-C` | Task 7.1 | existing `src/utils/prompt.ts` |
| `server-management` | `本地多 server 选择中按 Ctrl-C` | Task 7.1 | existing `src/utils/prompt.ts` |
| `central-storage` | `服务定义文件结构` | Task 4.1 | `src/install/__tests__/local-json.test.ts:10` |
| `central-storage` | `source 字段记录来源` | Task 5.1 | `src/commands/__tests__/install-remote.test.ts:24` |
| `central-storage` | `本地安装的 source 标记` | Task 5.2 | `src/commands/__tests__/install-local.test.ts:25` |
| `central-storage` | `文件权限` | Task 7.1 (existing behavior preserved by build) | existing `src/utils/server-store.ts` |
| `central-storage` | `servers 目录按需创建` | Task 7.1 | existing `src/utils/server-store.ts` after modification |
| `update-command` | `更新指定服务` | Task 6.1 | `src/commands/__tests__/update-rule-based.test.ts:18` |
| `update-command` | `更新所有服务` | Task 6.1 | `src/commands/__tests__/update-rule-based.test.ts:51` |
| `update-command` | `服务不存在` | Task 6.1 | `src/commands/__tests__/update-rule-based.test.ts:34` |
| `update-command` | `source 为空或 local 的服务` | Task 6.1 | `src/commands/__tests__/update-rule-based.test.ts:43` |
| `update-command` | `更新时保留 env 值` | Task 6.1 | `src/commands/__tests__/update-rule-based.test.ts:18` |
| `update-command` | `批量更新中部分失败` | Task 6.1 | `src/commands/__tests__/update-rule-based.test.ts:57` |
| `project-operations` | `init 命令中按 Ctrl-C` | Task 7.1, 7.2 | existing `src/__tests__/integration.test.ts` |
| `project-operations` | `add 命令中按 Ctrl-C` | Task 7.1, 7.2 | existing code path |
| `project-operations` | `remove 命令中按 Ctrl-C` | Task 7.1, 7.2 | existing code path |
| `project-operations` | `sync 命令中按 Ctrl-C` | Task 7.1, 7.2 | existing code path |

**Coverage:** 59 of 59 scenarios covered (100% required).
