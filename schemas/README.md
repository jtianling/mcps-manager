# mcpsmgr manifest schema

Repos that want to support `npx mcpsmgr add <owner>/<repo>` (manifest-driven multi-agent install) declare a `mcpsmgr.json` at the repo root.

## Author entry point

Add this `$schema` to your manifest so editors give you completion / inline diagnostics:

```jsonc
{
  "$schema": "https://github.com/jtianling/mcps-manager/raw/HEAD/schemas/mcpsmgr.schema.json",
  "schemaVersion": "1.0.0",
  ...
}
```

## Variable substitution

Two distinct substitution scopes exist, intentionally:

- **`${name}` cross-field reference**: any string field under `agents.*.servers[].config.*`, `prerequisites[].command`, `prerequisites[].notes[]`, and `agents.*.postInstallNotes[]` may reference a `variables.<name>` default or an `envVars[].name`.  mcpsmgr substitutes at install time; user-supplied values (CLI flag or prompt) override defaults.
- **`${VALUE}` self-reference inside `envVars[].appliedAs.format`** only.  This placeholder names *the envVar's own value* — not another variable.  Example: `"format": "Bearer ${VALUE}"` produces `"Bearer abc-token"` when the user enters `abc-token`.  Cross-envVar references (`"${OTHER_VAR}"`) inside `appliedAs.format` are deliberately not supported; that field is meant to render exactly one value into a header.

A reference to an undefined variable in the cross-field scope causes mcpsmgr to abort with a clear path-prefixed error.  A reference to a *declared but optional* envVar that the user did not provide is preserved literally (`${TOKEN}`) so the user sees what is missing in `prerequisites` output.

## Minimal complete example

```json
{
  "$schema": "https://github.com/jtianling/mcps-manager/raw/HEAD/schemas/mcpsmgr.schema.json",
  "schemaVersion": "1.0.0",
  "name": "demo",
  "displayName": "Demo MCP",
  "description": "A demo MCP server",
  "compatibility": { "npmPackage": "demo-mcp@^1.0" },
  "variables": {
    "port": { "default": "9100", "prompt": "Daemon port" }
  },
  "envVars": [
    {
      "name": "DEMO_TOKEN",
      "required": false,
      "secret": true,
      "description": "Optional bearer token; must match the daemon's --token if used.",
      "appliedAs": {
        "kind": "header",
        "name": "Authorization",
        "format": "Bearer ${VALUE}"
      }
    }
  ],
  "prerequisites": [
    {
      "kind": "long-running-command",
      "description": "Start the daemon",
      "command": "npx -y demo-mcp@^1.0 daemon --port ${port}"
    }
  ],
  "agents": {
    "claude-code": {
      "servers": [
        {
          "name": "demo",
          "config": {
            "transport": "http",
            "url": "http://127.0.0.1:${port}/mcp"
          }
        }
      ],
      "postInstallNotes": [
        "Reload Claude Code after configuring."
      ]
    },
    "codex": {
      "servers": [
        {
          "name": "demo",
          "config": {
            "transport": "streamable-http",
            "url": "http://127.0.0.1:${port}/mcp"
          }
        }
      ]
    }
  }
}
```

## Pinning behavior

- `compatibility.npmPackage` lets the manifest author declare a tested semver range.  mcpsmgr scans every stdio server's `args` for a `<same-package>@<...>` reference; mismatch produces a non-blocking warning at install time.

## Prerequisites are print-only

mcpsmgr **never** executes manifest `prerequisites`.  They are printed verbatim with variables substituted so the user can paste them.  Long-running daemons must be started by the user — mcpsmgr will not orphan a process or fight launchd.

## Supported `agents` keys

`claude-code`, `codex`, `cursor`, `gemini-cli`, `opencode`, `antigravity`, `openclaw`.  Unknown keys cause manifest validation to fail.

## Supported `transport` values

`stdio`, `http`, `streamable-http`, `sse`.  Internally mcpsmgr maps the three http variants to its `HttpConfig`; per-agent adapters serialize back to the agent-specific format on write.
