/**
 * V14 limit-card order: the user's drag order, kept on this device. Pools missing from the saved
 * order (a newly connected account) sit right after the last card of their own provider, or at the
 * end when that provider has no card yet. Saved ids that no longer exist are dropped.
 */
const STORAGE_KEY = "t3code:usage-limit-card-order:v1";

export function readLimitCardOrder(): readonly string[] | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLimitCardOrder(order: readonly string[] | null): void {
  try {
    if (order === null) globalThis.localStorage?.removeItem(STORAGE_KEY);
    else globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Storage can be full or blocked; the auto order still works.
  }
}

export function applyLimitCardOrder<T>(
  auto: readonly T[],
  saved: readonly string[] | null,
  idOf: (item: T) => string,
  groupOf: (item: T) => string,
): T[] {
  if (!saved || saved.length === 0) return [...auto];
  const byId = new Map(auto.map((item) => [idOf(item), item]));
  const result: T[] = [];
  for (const id of saved) {
    const item = byId.get(id);
    if (item !== undefined && !result.includes(item)) result.push(item);
  }
  for (const item of auto) {
    if (result.includes(item)) continue;
    const group = groupOf(item);
    let at = -1;
    result.forEach((other, index) => {
      if (groupOf(other) === group) at = index;
    });
    if (at === -1) result.push(item);
    else result.splice(at + 1, 0, item);
  }
  return result;
}

/** Moves `id` one step (or to `toIndex`) within `order`, returning a new array. */
export function moveLimitCard(order: readonly string[], id: string, toIndex: number): string[] {
  const from = order.indexOf(id);
  if (from === -1) return [...order];
  const next = order.filter((other) => other !== id);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, id);
  return next;
}
