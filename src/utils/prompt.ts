export function isUserCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}
