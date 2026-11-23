import { conversationLabel } from "./conversationLabel";
import type { uiText } from "./index";
export function timelineLabel(label: string, text: typeof uiText): string {
  for (const prefix of ["Worked for", "Continued for", "You stopped after"]) {
    if (label.startsWith(`${prefix} `))
      return text(`${prefix} {duration}`, { duration: label.slice(prefix.length + 1) });
  }
  const waiting = /^Waiting on (\d+) subagents$/.exec(label);
  if (waiting) return text("Waiting on {count} subagents", { count: waiting[1] });
  return conversationLabel(label, text);
}
