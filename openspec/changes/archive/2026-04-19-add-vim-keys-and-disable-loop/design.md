## Context

All interactive checkbox prompts in mcps-manager use `@inquirer/checkbox` with default settings: `loop: true` (navigation wraps around at list boundaries) and no vim keybindings. The sister project skills-manager uses a custom TUI with j/k navigation and clamped boundaries.

Inquirer's `@inquirer/core` already provides built-in vim keybinding support. The `isUpKey`/`isDownKey` functions accept a `keybindings` array from the theme — passing `['vim']` enables j/k recognition. The checkbox component also accepts `loop: false` to clamp cursor at boundaries.

## Goals / Non-Goals

**Goals:**
- Enable j/k vim-style navigation on all checkbox prompts
- Disable list cycling so cursor clamps at boundaries
- Consistent interaction feel with skills-manager

**Non-Goals:**
- Custom TUI replacement (keep using @inquirer/checkbox)
- Search, group folding, or line-number jumping (skills-manager features not in scope)
- Changing confirm, input, or password prompts (only checkbox affected)

## Decisions

### Use Inquirer's built-in vim keybinding support

Pass `theme: { keybindings: ['vim'] }` to each checkbox call. This enables j/k via `isUpKey`/`isDownKey` in `@inquirer/core` without any custom code.

Alternative considered: patching `useKeypress` or wrapping checkbox with custom key handler. Rejected because the built-in mechanism is cleaner and maintained upstream.

### Extract shared config constant

Define a shared `CHECKBOX_DEFAULTS` constant with `loop: false` and `theme: { keybindings: ['vim'] }` to avoid repeating the same options in 5 call sites. Place it in `src/utils/prompt.ts` alongside the existing `isUserCancellation` helper.

Alternative considered: inline the options at each call site. Viable for only 2 options, but a constant is more maintainable when the same config applies everywhere.

## Risks / Trade-offs

- [Risk: upstream API change] Inquirer could change the `keybindings` theme API → Mitigation: pinned dependency, single constant to update
- [Trade-off] `loop: false` means users can't quickly jump from top to bottom via wrapping → Accepted: matches skills-manager behavior and is the requested change
