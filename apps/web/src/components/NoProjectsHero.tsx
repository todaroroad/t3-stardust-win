import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUiText } from "~/i18n/useUiText";
import { workspaceAreaProps } from "../lib/workspaceFocus";
import { T, useGT } from "gt-react";
import { MessageSquareDashedIcon, PlusIcon } from "lucide-react";

import { openCommandPalette } from "../commandPaletteBus";
import { isElectron } from "../env";
import { useScratchProject } from "../hooks/useScratchProject";
import { usePrimaryEnvironmentId } from "../state/environments";
import { Button } from "./ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/empty";
import { SidebarInset } from "./ui/sidebar";
import { WorkspacePageHeader } from "./WorkspacePageHeader";

export function NoProjectsHero() {
  const gt = useGT();
  const text = useUiText();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const contentArea = workspaceAreaProps("home", 1, text("Home"));
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { scratchEnvironmentId, startScratchThread } = useScratchProject();
  const scratchTargetEnvironmentId = scratchEnvironmentId(primaryEnvironmentId);

  return (
    <SidebarInset
      {...contentArea}
      role="main"
      className="h-dvh min-h-0 overflow-hidden overscroll-y-none"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        {/* The desktop window only moves where CSS opts in, so keep a titlebar strip. */}
        {isElectron ? <WorkspacePageHeader electron /> : null}
        <Empty size="hero" className="flex-1">
          <div className="w-full max-w-2xl px-8 py-12">
            <EmptyHeader className="max-w-none">
              <EmptyTitle>
                <T>What should we work on?</T>
              </EmptyTitle>
              <EmptyDescription>
                {scratchTargetEnvironmentId === null
                  ? gt("Add a project to start your first thread.")
                  : gt("Add a project, or start without one.")}
              </EmptyDescription>
              <div className="mt-6 flex justify-center gap-2">
                <Button size="sm" onClick={() => openCommandPalette({ open: "add-project" })}>
                  <PlusIcon className="size-4" />
                  <T>Add project</T>
                </Button>
                {scratchTargetEnvironmentId === null ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={starting}
                    onClick={async () => {
                      setStarting(true);
                      await startScratchThread(scratchTargetEnvironmentId).finally(() =>
                        setStarting(false),
                      );
                    }}
                  >
                    <MessageSquareDashedIcon className="size-4" />
                    {text(starting ? "Preparing a conversation…" : "Start without a project")}
                  </Button>
                )}
              </div>
            </EmptyHeader>
            <div className="mt-8 grid gap-2 text-left sm:grid-cols-3">
              {[
                [
                  "Explain a codebase",
                  "Open a folder and get a tour",
                  "Explain how this codebase is organized.",
                ],
                [
                  "Fix a bug",
                  "Paste the error and trace its cause",
                  "Help me find the cause of this error:",
                ],
                [
                  "Write an article",
                  "Give a topic and start with an outline",
                  "Help me outline an article for this audience:",
                ],
              ].map(([title, description, prompt]) => (
                <button
                  key={title}
                  type="button"
                  className="grid content-start gap-1 rounded-xl border bg-card p-3 text-left outline-primary hover:border-primary/50"
                  onClick={() => void navigate({ to: "/new", search: { prompt: text(prompt!) } })}
                >
                  <b className="text-stardust-body">{text(title!)}</b>
                  <span className="text-xs text-muted-foreground">{text(description!)}</span>
                </button>
              ))}
            </div>
          </div>
        </Empty>
      </div>
    </SidebarInset>
  );
}
