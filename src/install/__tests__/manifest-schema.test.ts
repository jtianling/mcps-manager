import { describe, it, expect } from "vitest";
import { validateManifest } from "../manifest-schema.js";

function base() {
  return {
    schemaVersion: "1.0.0",
    name: "demo",
    agents: {
      "claude-code": {
        servers: [
          {
            name: "demo",
            config: { transport: "http", url: "http://127.0.0.1:9100/mcp" },
          },
        ],
      },
    },
  };
}

describe("validateManifest required fields", () => {
  it("accepts a minimal valid manifest", () => {
    const r = validateManifest(base());
    expect(r.ok).toBe(true);
  });

  it("rejects missing schemaVersion", () => {
    const m = base() as Record<string, unknown>;
    delete m["schemaVersion"];
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("manifest missing required field: schemaVersion");
    }
  });

  it("rejects missing name", () => {
    const m = base() as Record<string, unknown>;
    delete m["name"];
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("manifest missing required field: name");
    }
  });

  it("rejects missing agents", () => {
    const m = base() as Record<string, unknown>;
    delete m["agents"];
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("manifest missing required field: agents");
    }
  });

  it("rejects empty agents object", () => {
    const m = { ...base(), agents: {} };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain(
        "manifest must declare at least one agent under 'agents'",
      );
    }
  });
});

describe("validateManifest schemaVersion compatibility", () => {
  it("accepts 1.0.0", () => {
    const r = validateManifest({ ...base(), schemaVersion: "1.0.0" });
    expect(r.ok).toBe(true);
  });

  it("accepts 1.2.0", () => {
    const r = validateManifest({ ...base(), schemaVersion: "1.2.0" });
    expect(r.ok).toBe(true);
  });

  it("rejects 2.0.0 with mcpsmgr-only-1.x message", () => {
    const r = validateManifest({ ...base(), schemaVersion: "2.0.0" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => /1\.x/.test(e))).toBe(true);
    }
  });
});

describe("validateManifest agents key check", () => {
  it("rejects unknown agent id", () => {
    const m = {
      ...base(),
      agents: {
        foo: {
          servers: [
            { name: "x", config: { transport: "http", url: "https://x" } },
          ],
        },
      },
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some((e) => /unknown agent id 'foo'/.test(e) && /known:/.test(e)),
      ).toBe(true);
    }
  });
});

describe("validateManifest transport check", () => {
  it("rejects unsupported transport", () => {
    const m = {
      ...base(),
      agents: {
        codex: {
          servers: [
            { name: "x", config: { transport: "websocket", url: "ws://x" } },
          ],
        },
      },
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) =>
            /unsupported transport 'websocket'/.test(e) &&
            /agents\.codex\.servers\[0\]/.test(e) &&
            /stdio \| http \| streamable-http \| sse/.test(e),
        ),
      ).toBe(true);
    }
  });

  it("accepts stdio transport", () => {
    const m = {
      ...base(),
      agents: {
        "claude-code": {
          servers: [
            {
              name: "stdio-srv",
              config: { transport: "stdio", command: "npx", args: ["-y", "x"] },
            },
          ],
        },
      },
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(true);
  });

  it("accepts streamable-http transport", () => {
    const m = {
      ...base(),
      agents: {
        codex: {
          servers: [
            {
              name: "x",
              config: { transport: "streamable-http", url: "http://x" },
            },
          ],
        },
      },
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(true);
  });
});

describe("validateManifest envVar appliedAs.format", () => {
  it("rejects appliedAs.format missing ${VALUE}", () => {
    const m = {
      ...base(),
      envVars: [
        {
          name: "FOO_TOKEN",
          appliedAs: {
            kind: "header",
            name: "Authorization",
            format: "Bearer",
          },
        },
      ],
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some((e) =>
          /envVar 'FOO_TOKEN'.appliedAs.format must contain \$\{VALUE\} placeholder/.test(
            e,
          ),
        ),
      ).toBe(true);
    }
  });

  it("accepts appliedAs.format with ${VALUE}", () => {
    const m = {
      ...base(),
      envVars: [
        {
          name: "FOO_TOKEN",
          appliedAs: {
            kind: "header",
            name: "Authorization",
            format: "Bearer ${VALUE}",
          },
        },
      ],
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(true);
  });
});
