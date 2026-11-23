/**
 * Claude Code leaves its task-list tools out for models it does not know unless this is on, and the
 * step capsule needs them. The terminal launch drops the account's settings.json and filters the
 * environment, so T3 sets it itself; an explicit instance value wins.
 */
export const CLAUDE_TASK_TOOLS_ENV = "CLAUDE_CODE_ENABLE_TODO_TOOLS";

export function withClaudeTaskTools<Env extends Readonly<Record<string, string | undefined>>>(
  environment: Env,
): Env | (Env & Record<typeof CLAUDE_TASK_TOOLS_ENV, string>) {
  return environment[CLAUDE_TASK_TOOLS_ENV] === undefined
    ? { ...environment, [CLAUDE_TASK_TOOLS_ENV]: "1" }
    : environment;
}
