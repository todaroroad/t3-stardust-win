import { uiText } from "./i18n";
import type { ProviderApprovalDecision } from "@t3tools/contracts";
import type { ThreadPendingApproval } from "@t3tools/client-runtime/state/thread-requests";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { TaskProgressSnapshot } from "./taskProgress";

export function approvalPresentation(approval: ThreadPendingApproval) {
  const detail = approval.detail?.trim() ?? "";
  const destructive =
    /\b(rm|rmdir|sudo|chmod|chown|mkfs|diskutil|truncate)\b|\bgit\s+(reset\s+--hard|clean)\b/i.test(
      detail,
    );
  const network =
    /\b(npm|pnpm|yarn|bun|pip|pip3|uv|brew)\s+(add|install|update|upgrade|sync)\b|\b(curl|wget)\b/i.test(
      detail,
    );
  const outside = /outside (?:the )?workspace|工作区(?:以)?外/i.test(approval.reason ?? "");
  const title =
    outside && approval.requestKind === "file-change"
      ? uiText("Wants to write outside the workspace")
      : approval.requestKind === "file-change"
        ? uiText("Wants to modify files")
        : approval.requestKind === "file-read"
          ? uiText("Wants to read files")
          : approval.requestKind === "command"
            ? network
              ? uiText("Wants to install dependencies or access the network")
              : uiText("Wants to run a command")
            : uiText("Requests permission to use a tool");
  // Only a bare, known read command earns a low-risk label; shell syntax stays unclassified.
  const readOnly =
    /^(pwd|ls|cat|head|tail|wc|stat)(?:\s+[\w./ -]+)?$/.test(detail) && !/[\n\r]/.test(detail);
  const risk =
    destructive || outside
      ? uiText("Deletion or elevated access · High risk")
      : network
        ? uiText("Network or dependency changes · Use caution")
        : approval.requestKind === "file-change"
          ? uiText("Writes files · Medium risk")
          : approval.requestKind === "file-read" || readOnly
            ? uiText("Read-only · Low risk")
            : null;
  const summary = (detail || approval.appName || title).replace(/\s+/g, " ").slice(0, 100);
  return { title, risk, summary, detail };
}

export function approvalResultLabel(decision: ProviderApprovalDecision) {
  switch (decision) {
    case "accept":
      return uiText("✓ Approved (once)");
    case "acceptForSession":
      return uiText("✓ Approved (for this conversation)");
    case "acceptAlways":
      return uiText("✓ Approved (always)");
    case "decline":
      return uiText("✕ Denied");
    case "cancel":
      return uiText("✕ Canceled");
  }
}

export function trailApprovalResults(
  projection: ThreadStructure | null,
  progress: TaskProgressSnapshot,
) {
  const plan = projection?.plans.find((entry) => entry.id === progress.planId);
  if (!projection || !plan) return [];
  const requestIds = new Set(
    projection.turnItems
      .filter(
        (item) =>
          item.type === "approval_request" &&
          item.runId === plan.runId &&
          (plan.runId !== null || item.nodeId === plan.nodeId),
      )
      .map((item) => (item.type === "approval_request" ? item.requestId : "")),
  );
  return projection.runtimeRequests.flatMap((request) =>
    request.status === "resolved" && request.decision && requestIds.has(request.id)
      ? [{ requestId: request.id, decision: request.decision }]
      : [],
  );
}
