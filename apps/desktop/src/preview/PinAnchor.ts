import type { PreviewPin } from "@t3tools/contracts";
const normalized = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 180);
export function pinSelectorChain(element: Element): string[] {
  const result: string[] = [];
  let node: Element | null = element;
  let chain = "";
  while (node && node !== document.documentElement) {
    let segment = node.localName;
    if (node.id) segment = `#${CSS.escape(node.id)}`;
    else {
      const siblings = [...(node.parentElement?.children ?? [])].filter(
        (s) => s.localName === node!.localName,
      );
      segment += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    chain = segment + (chain ? ` > ${chain}` : "");
    if (document.querySelectorAll(chain).length === 1) result.push(chain);
    if (node.id) break;
    node = node.parentElement;
  }
  return result.reverse();
}
export function pinText(element: Element) {
  return normalized(element.textContent ?? "");
}
export function findPinElement(pin: PreviewPin, doc: Document = document): Element | null {
  for (const selector of pin.selectorChain) {
    try {
      const candidates = doc.querySelectorAll(selector);
      if (candidates.length === 1 && candidates[0]?.localName === pin.tag) return candidates[0];
    } catch {}
  }
  let scope: ParentNode = doc;
  if (pin.ancestor) {
    try {
      scope = doc.querySelector(pin.ancestor) ?? doc;
    } catch {}
  }
  const candidates = [...scope.querySelectorAll(pin.tag)].filter(
    (el) => !el.closest("[data-t3code-annotation-ui]"),
  );
  const sameText = candidates.filter((el) => pin.elementText && pinText(el) === pin.elementText);
  if (sameText.length === 1) return sameText[0]!;
  const view = doc.defaultView;
  const x = pin.documentPosition.x * doc.documentElement.scrollWidth - (view?.scrollX ?? 0);
  const y = pin.documentPosition.y * doc.documentElement.scrollHeight - (view?.scrollY ?? 0);
  const nearby = (sameText.length ? sameText : candidates)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        distance: Math.hypot(
          r.x + r.width * pin.relative.x - x,
          r.y + r.height * pin.relative.y - y,
        ),
      };
    })
    .filter((r) => r.distance <= 24)
    .sort((a, b) => a.distance - b.distance);
  return nearby[0]?.el ?? null;
}
export function afterPinLayoutSettles(doc: Document, ready: () => void): () => void {
  const view = doc.defaultView!;
  let quiet: number | undefined,
    maximum: number | undefined,
    stopped = false;
  const resize = new ResizeObserver(() => reset());
  const mutations = new MutationObserver((rows) => {
    if (rows.some((r) => r.addedNodes.length || r.removedNodes.length)) reset();
  });
  const cleanup = () => {
    stopped = true;
    view.clearTimeout(quiet);
    view.clearTimeout(maximum);
    resize.disconnect();
    mutations.disconnect();
    view.removeEventListener("load", begin);
  };
  const finish = () => {
    if (stopped) return;
    cleanup();
    ready();
  };
  const reset = () => {
    view.clearTimeout(quiet);
    quiet = view.setTimeout(finish, 500);
  };
  const begin = () => {
    if (stopped) return;
    if (doc.body) {
      resize.observe(doc.body);
      mutations.observe(doc.body, { childList: true, subtree: true });
    }
    maximum = view.setTimeout(finish, 3000);
    reset();
  };
  if (doc.readyState === "complete") begin();
  else view.addEventListener("load", begin, { once: true });
  return cleanup;
}
