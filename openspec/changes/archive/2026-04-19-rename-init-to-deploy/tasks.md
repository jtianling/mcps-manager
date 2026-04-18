## 1. Command file restructuring

- [x] 1.1 Rename `src/commands/init.ts` to `src/commands/deploy.ts`, rename exported function `initCommand` to `deployCommand`, accept `options: { refresh?: boolean }` parameter
- [x] 1.2 Merge `src/commands/sync.ts` logic into `src/commands/deploy.ts` — when `options.refresh` is true, run sync logic; otherwise run original deploy logic
- [x] 1.3 Delete `src/commands/sync.ts`

## 2. Commander registration

- [x] 2.1 Update `src/index.ts`: replace `init` and `sync` command registrations with a single `deploy` command that has `--refresh` option

## 3. Spec references

- [x] 3.1 Update `openspec/specs/project-operations/spec.md`: replace all `mcpsmgr init` references with `mcpsmgr deploy`, replace `mcpsmgr sync` with `mcpsmgr deploy --refresh`, update related descriptions

## 4. Verification

- [x] 4.1 Run `npm run build` to verify compilation succeeds
