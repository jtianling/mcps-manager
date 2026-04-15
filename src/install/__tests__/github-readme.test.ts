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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "# Hello",
    });
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
