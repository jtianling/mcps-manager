import { describe, it, expect, vi } from "vitest";
import { fetchManifest, manifestUrl } from "../manifest-fetch.js";

function mockFetch(
  status: number,
  body: string,
): { fetch: (url: string) => Promise<Response>; lastUrl: () => string } {
  let lastUrl = "";
  const fetchFn = vi.fn(async (url: string) => {
    lastUrl = url;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    } as unknown as Response;
  });
  return { fetch: fetchFn as unknown as (url: string) => Promise<Response>, lastUrl: () => lastUrl };
}

const validBody = JSON.stringify({
  schemaVersion: "1.0.0",
  name: "demo",
  agents: {
    "claude-code": {
      servers: [
        { name: "demo", config: { transport: "http", url: "https://x" } },
      ],
    },
  },
});

describe("manifestUrl", () => {
  it("targets repo root mcpsmgr.json on HEAD", () => {
    expect(manifestUrl({ owner: "o", repo: "r" })).toBe(
      "https://raw.githubusercontent.com/o/r/HEAD/mcpsmgr.json",
    );
  });
});

describe("fetchManifest", () => {
  it("returns parsed manifest on 200 OK", async () => {
    const { fetch } = mockFetch(200, validBody);
    const m = await fetchManifest({ owner: "o", repo: "r" }, { fetch });
    expect(m).toBeDefined();
    expect(m!.name).toBe("demo");
    expect(m!.schemaVersion).toBe("1.0.0");
  });

  it("returns undefined on 404", async () => {
    const { fetch } = mockFetch(404, "");
    const m = await fetchManifest({ owner: "o", repo: "r" }, { fetch });
    expect(m).toBeUndefined();
  });

  it("throws on 5xx", async () => {
    const { fetch } = mockFetch(503, "boom");
    await expect(
      fetchManifest({ owner: "o", repo: "r" }, { fetch }),
    ).rejects.toThrow(/Failed to fetch mcpsmgr.json.*HTTP 503/);
  });

  it("throws on non-JSON 200", async () => {
    const { fetch } = mockFetch(200, "<html>not json</html>");
    await expect(
      fetchManifest({ owner: "o", repo: "r" }, { fetch }),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("throws on invalid manifest schema 200", async () => {
    const { fetch } = mockFetch(
      200,
      JSON.stringify({ name: "x" }),
    );
    await expect(
      fetchManifest({ owner: "o", repo: "r" }, { fetch }),
    ).rejects.toThrow(/is invalid/);
  });
});
