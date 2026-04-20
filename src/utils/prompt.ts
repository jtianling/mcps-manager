export function isUserCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}

export const CHECKBOX_DEFAULTS = {
  loop: false,
  theme: { keybindings: ["vim"] },
} as const;
