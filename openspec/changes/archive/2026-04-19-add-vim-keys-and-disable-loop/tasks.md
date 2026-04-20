## 1. Shared Config

- [x] 1.1 Add `CHECKBOX_DEFAULTS` constant to `src/utils/prompt.ts` with `loop: false` and `theme: { keybindings: ['vim'] }`

## 2. Apply to All Checkbox Call Sites

- [x] 2.1 Apply `CHECKBOX_DEFAULTS` to both checkbox calls in `src/commands/deploy.ts` (agent selection + server selection)
- [x] 2.2 Apply `CHECKBOX_DEFAULTS` to checkbox call in `src/commands/add.ts` (agent selection)
- [x] 2.3 Apply `CHECKBOX_DEFAULTS` to checkbox call in `src/commands/remove.ts` (agent selection)
- [x] 2.4 Apply `CHECKBOX_DEFAULTS` to checkbox call in `src/install/select-servers.ts` (server selection)
