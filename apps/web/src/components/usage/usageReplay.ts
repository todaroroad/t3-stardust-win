/**
 * Key for the entrance animation of the usage page. It changes when the user opens another metric or
 * acts (refresh), not when the period changes: a new period only changes the data, so the page stays
 * put and only the figures and charts move.
 */
export function usageReplayKey(metric: string, action: number): string {
  return `${metric}:${action}`;
}
