## Why

All interactive checkbox prompts use default @inquirer/checkbox settings: no vim key navigation and list cycling enabled. This is inconsistent with the skills-manager project which uses j/k navigation and clamps at list boundaries. Users who work across both CLIs experience inconsistent navigation behavior.

## What Changes

- Enable vim keybindings (j/k for up/down navigation) on all checkbox prompts via Inquirer's built-in `theme.keybindings: ['vim']` support
- Disable list cycling (wrap-around) on all checkbox prompts via `loop: false`, so cursor clamps at boundaries instead of wrapping

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-operations`: checkbox prompts in deploy flow gain vim keybindings and non-cycling navigation
- `server-management`: checkbox prompt in server selection gains vim keybindings and non-cycling navigation

## Impact

- 4 source files, 5 checkbox call sites:
  - `src/commands/deploy.ts` (2 calls: agent selection, server selection)
  - `src/commands/add.ts` (1 call: agent selection)
  - `src/commands/remove.ts` (1 call: agent selection)
  - `src/install/select-servers.ts` (1 call: server selection)
- No API changes, no new dependencies, no breaking changes
- Pure configuration-level change using existing Inquirer capabilities
