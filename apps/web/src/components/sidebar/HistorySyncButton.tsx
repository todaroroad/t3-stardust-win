import { uiText } from "../../i18n";
import { useState } from "react";
import { CommandId } from "@t3tools/contracts";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { readProjects } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { agentSessionImport, agentSessionRescan } from "../../state/agentSessions";
import { useAtomCommand } from "../../state/use-atom-command";
import { newProjectId } from "../../lib/utils";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";

/** Reuses the onboarding services so retries preserve the original session identity. */
export function HistorySyncButton() {
  const environmentId = usePrimaryEnvironmentId();
  const scan = useAtomCommand(agentSessionRescan);
  const createProject = useAtomCommand(projectEnvironment.create);
  const importHistory = useAtomCommand(agentSessionImport);
  const [progress, setProgress] = useState<string | null>(null);

  const sync = async () => {
    if (!environmentId || progress !== null) return;
    setProgress(uiText("Scanning…."));
    await (async () => {
      let totalReconciled = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let newProjectsCount = 0;
      const failureReasons: string[] = [];
      try {
        const result = await scan({ environmentId, input: {} });
        if (result._tag !== "Success") {
          return await Promise.reject(
            new Error(uiText("Conversation scan didn’t finish. Try again.")),
          );
        }

        const candidates = result.value.candidates;
        for (const [index, candidate] of candidates.entries()) {
          setProgress(`${index + 1}/${candidates.length}`);
          const existing = readProjects().find(
            (project) =>
              project.environmentId === environmentId && project.workspaceRoot === candidate.path,
          );
          let projectId = candidate.projectId ?? existing?.id;
          if (!projectId) {
            projectId = newProjectId();
            const created = await createProject({
              environmentId,
              input: {
                projectId,
                commandId: CommandId.make(`history:project:create:${projectId}`),
                title: candidate.title,
                workspaceRoot: candidate.path,
                createWorkspaceRootIfMissing: false,
                defaultModelSelection: null,
              },
            });
            if (created._tag !== "Success") {
              const err = squashAtomCommandFailure(created);
              const msg =
                err instanceof Error
                  ? err.message
                  : String(err ?? uiText("Couldn’t create project"));
              failureReasons.push(`${candidate.title}: ${msg}`);
              totalFailed += candidate.threadCount;
              continue;
            }
            newProjectsCount++;
          }

          // Run single import per candidate without artificial retry loops
          const imported = await importHistory({
            environmentId,
            input: { projectId: projectId!, expectedWorkspaceRoot: candidate.path },
          });

          if (imported._tag !== "Success") {
            const err = squashAtomCommandFailure(imported);
            const msg =
              err instanceof Error
                ? err.message
                : String(err ?? uiText("Couldn’t import conversation"));
            failureReasons.push(`${candidate.title}: ${msg}`);
            totalFailed += candidate.threadCount;
            continue;
          }

          const { importedCount, skippedCount } = imported.value;
          totalReconciled += importedCount;
          totalSkipped += skippedCount;
        }

        const hasFailures = failureReasons.length > 0;
        const isTruncated = Boolean(result.value.truncated);

        let desc = uiText(
          "Scanned {count} project folders{created} and checked {total} conversations.",
          {
            count: candidates.length,
            created:
              newProjectsCount > 0 ? uiText(" ({newProjectsCount} new)", { newProjectsCount }) : "",
            total: totalReconciled,
          },
        );
        if (totalSkipped > 0) desc += uiText(" Skipped {totalSkipped}.", { totalSkipped });
        if (totalFailed > 0) desc += uiText(" Couldn’t import {totalFailed}.", { totalFailed });
        if (isTruncated) {
          desc += uiText(" Scan limit reached. Results are incomplete.");
        }
        if (failureReasons.length > 0) {
          desc += uiText(" Reason: {reason}{more}.", {
            reason: failureReasons.slice(0, 3).join("; "),
            more: failureReasons.length > 3 ? uiText(" and more") : "",
          });
        }

        toastManager.add({
          type: hasFailures || isTruncated ? "warning" : "success",
          title:
            hasFailures && totalReconciled === 0
              ? uiText("History sync failed")
              : isTruncated
                ? uiText("History partially synced (scan limit reached)")
                : hasFailures
                  ? uiText("History partially synced (some failures)")
                  : uiText("History synced"),
          description: desc,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: uiText("History sync incomplete"),
          description: error instanceof Error ? error.message : uiText("Try again."),
        });
      }
    })().finally(() => {
      setProgress(null);
    });
  };

  return (
    <Button
      size="xs"
      variant="ghost-muted"
      disabled={!environmentId || progress !== null}
      onClick={() => void sync()}
      title={uiText("Scan and import external conversations")}
    >
      {progress ?? uiText("Sync history")}
    </Button>
  );
}
