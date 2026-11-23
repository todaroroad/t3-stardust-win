import { uiText } from "../../i18n";
import { useAtomValue } from "@effect/atom-react";
import {
  type EnvironmentId,
  type MemoryEntry,
  type MemoryScope,
  type ProjectId,
  type UserMemoryMutation,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { Badge } from "../ui/badge";
import { useSettingsScope } from "./SettingsScopeContext";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

type ProjectChoice = { id: ProjectId; title: string };

function MemoryEditor({
  initial,
  approving = false,
  projects,
  onSave,
  onCancel,
  busy,
}: {
  initial?: MemoryEntry;
  approving?: boolean;
  projects: readonly ProjectChoice[];
  onSave: (text: string, scope: MemoryScope) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const initialProjectId = initial?.scope.kind === "project" ? initial.scope.projectId : undefined;
  const [scopeId, setScopeId] = useState(
    initial?.scope.kind === "project" ? initial.scope.projectId : "global",
  );
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const scope: MemoryScope =
          scopeId === "global"
            ? { kind: "global" }
            : { kind: "project", projectId: scopeId as ProjectId };
        onSave(text.trim(), scope);
      }}
    >
      <Textarea
        aria-label={uiText("Memory content")}
        rows={3}
        maxLength={500}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {uiText("Scope")}
          <select
            aria-label={uiText("Memory scope")}
            className="rounded-md border bg-background px-2 py-1"
            value={scopeId}
            onChange={(event) => setScopeId(event.target.value)}
          >
            <option value="global">{uiText("Global")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
            {initial?.scope.kind === "project" &&
            !projects.some(({ id }) => id === initialProjectId) ? (
              <option value={initial.scope.projectId}>{initial.scope.projectId}</option>
            ) : null}
          </select>
        </label>
        <Button type="submit" size="sm" disabled={busy || text.trim().length === 0}>
          {approving ? uiText("Save and approve") : uiText("Save memory")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {uiText("Cancel")}
        </Button>
      </div>
    </form>
  );
}

function MemoryEnvironment({
  environmentId,
  projects,
}: {
  environmentId: EnvironmentId;
  projects: readonly ProjectChoice[];
}) {
  const config = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const allowed = useAtomValue(serverEnvironment.updateSettings.permissionAtom(environmentId));
  const update = useAtomCommand(serverEnvironment.updateSettings);
  const [editor, setEditor] = useState<MemoryEntry | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const memory = config?.settings.memory ?? { approved: [], pending: [] };
  const mutate = async (memoryMutation: UserMemoryMutation) => {
    setBusy(true);
    const result = await update({ environmentId, input: { patch: {}, memoryMutation } }).finally(
      () => setBusy(false),
    );
    if (AsyncResult.isSuccess(result)) {
      setEditor(null);
      toastManager.add({
        type: "success",
        title:
          memoryMutation.type === "approve"
            ? uiText("Memory approved. It takes effect on the next regular turn.")
            : uiText("Memory updated"),
      });
    }
  };
  const scopeTitle = (scope: MemoryScope) =>
    scope.kind === "global"
      ? uiText("Global")
      : (projects.find(({ id }) => id === scope.projectId)?.title ??
        uiText("Project {projectId}", { projectId: scope.projectId }));
  const groups = [
    ...new Set([
      "global",
      ...memory.approved.flatMap(({ scope }) =>
        scope.kind === "project" ? [scope.projectId] : [],
      ),
    ]),
  ];
  const renderRow = (entry: MemoryEntry, pending: boolean) =>
    editor !== "new" && editor?.id === entry.id ? (
      <MemoryEditor
        key={entry.id}
        initial={entry}
        approving={pending}
        projects={projects}
        busy={busy}
        onCancel={() => setEditor(null)}
        onSave={(text, scope) =>
          void mutate({ type: pending ? "approve" : "edit", id: entry.id, text, scope })
        }
      />
    ) : (
      <div key={entry.id} className="space-y-2 border-b p-4 last:border-b-0">
        <p className="whitespace-pre-wrap break-words text-sm">{entry.text}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {scopeTitle(entry.scope)} ·{" "}
            {entry.source.kind === "user"
              ? uiText("Added by you")
              : uiText("Agent proposal · {threadId}", { threadId: entry.source.threadId })}{" "}
            · {new Date(entry.updatedAt).toLocaleString()}
          </p>
          <div className="flex gap-2">
            {pending ? (
              <Button
                size="xs"
                disabled={!allowed || busy}
                onClick={() => void mutate({ type: "approve", id: entry.id })}
              >
                {uiText("Approve")}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="xs"
              disabled={!allowed || busy}
              onClick={() => setEditor(entry)}
            >
              {pending ? uiText("Edit and approve") : uiText("Edit")}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={!allowed || busy}
              onClick={() => void mutate({ type: pending ? "reject" : "delete", id: entry.id })}
            >
              {pending ? uiText("Reject") : uiText("Delete")}
            </Button>
          </div>
        </div>
      </div>
    );
  if (!config) return <p role="status">{uiText("Loading memory…")}</p>;
  if (!config.memorySettings)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {uiText("Update the server to enable memory in this environment.")}
      </p>
    );
  return (
    <>
      <p className="px-4 text-sm text-muted-foreground">
        {uiText(
          "This environment shares approved memories with all models. Agents can propose changes for your approval. A regular turn includes up to about 2,000 characters, newest first.",
        )}
      </p>
      <SettingsSection
        id="memory"
        title={uiText("Pending approval")}
        titleAction={<Badge variant="secondary">{memory.pending.length}</Badge>}
      >
        {memory.pending.length ? (
          memory.pending.toReversed().map((entry) => renderRow(entry, true))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{uiText("No pending proposals")}</p>
        )}
      </SettingsSection>
      <SettingsSection
        title={uiText("Add memory")}
        headerAction={
          editor !== "new" ? (
            <Button size="xs" disabled={!allowed || busy} onClick={() => setEditor("new")}>
              {uiText("Add memory")}
            </Button>
          ) : null
        }
      >
        {editor === "new" ? (
          <MemoryEditor
            projects={projects}
            busy={busy}
            onCancel={() => setEditor(null)}
            onSave={(text, scope) => void mutate({ type: "add", text, scope })}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {uiText("Save short facts and preferences for reuse. Up to 500 characters.")}
          </p>
        )}
      </SettingsSection>
      {groups.map((key) => (
        <SettingsSection
          key={key}
          title={
            key === "global"
              ? uiText("Global")
              : (projects.find(({ id }) => id === key)?.title ?? uiText("Project {key}", { key }))
          }
        >
          {memory.approved
            .filter(({ scope }) =>
              key === "global"
                ? scope.kind === "global"
                : scope.kind === "project" && scope.projectId === key,
            )
            .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((entry) => renderRow(entry, false))}
          {key === "global" && !memory.approved.some(({ scope }) => scope.kind === "global") ? (
            <p className="p-4 text-sm text-muted-foreground">{uiText("No global memories")}</p>
          ) : null}
        </SettingsSection>
      ))}
    </>
  );
}

export function MemorySettings() {
  const { environment, groups } = useSettingsScope();
  const projects = groups.flatMap((group) =>
    group.memberProjects
      .filter((project) => project.environmentId === environment?.environmentId)
      .map((project) => ({ id: project.id, title: group.displayName })),
  );
  return (
    <SettingsPageContainer>
      {environment ? (
        <MemoryEnvironment
          key={environment.environmentId}
          environmentId={environment.environmentId}
          projects={projects}
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {uiText("Connect to an environment to manage memory.")}
        </p>
      )}
    </SettingsPageContainer>
  );
}
