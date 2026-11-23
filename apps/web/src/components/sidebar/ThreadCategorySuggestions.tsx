import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, useState } from "react";
import * as Schema from "effect/Schema";
import { useUiText } from "~/i18n/useUiText";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useSidebarSuggestionModels } from "~/hooks/useSidebarSuggestionModels";
import { readUiLocale } from "~/i18n";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { setThreadCategories, type ThreadCategory } from "~/threadCategories";
import type { ModelSelection } from "@t3tools/contracts";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "../ui/dialog";

type Candidate = { readonly key: string; readonly title: string };
type Row = Candidate & {
  readonly categoryId: string;
  readonly reason: string;
  readonly checked: boolean;
};

export function ThreadCategorySuggestions({
  candidates,
  categories,
  modelSelection,
}: {
  readonly candidates: readonly Candidate[];
  readonly categories: readonly ThreadCategory[];
  readonly modelSelection: ModelSelection | null;
}) {
  const text = useUiText();
  const [seen, setSeen] = useLocalStorage(
    "t3code:sidebar-category-suggestions-seen:v1",
    false,
    Schema.Boolean,
  );
  const run = useAtomCommand(serverEnvironment.suggestSidebarCategories, { reportFailure: false });
  const { environmentId, models } = useSidebarSuggestionModels();
  const canSuggest = useAtomValue(
    serverEnvironment.suggestSidebarCategories.permissionAtom(environmentId),
  );
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [model, setModel] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [takingLonger, setTakingLonger] = useState(false);
  const generation = useRef(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One delayed explanation for an in-flight model call.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setTakingLonger(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  const selected = rows.filter(
    (row) => row.checked && categories.some((category) => category.id === row.categoryId),
  );
  const close = () => {
    ++generation.current;
    setOpen(false);
    setWaiting(false);
    setTakingLonger(false);
  };
  const request = async () => {
    if (!environmentId || !canSuggest) return;
    const version = ++generation.current;
    setOpen(true);
    setWaiting(true);
    setTakingLonger(false);
    setFailure(null);
    setRows([]);
    const proposed = candidates.slice(0, 30);
    const allowed = categories.slice(0, 40);
    const result = await run({
      environmentId,
      input: {
        titles: proposed.map((item) => item.title.slice(0, 500)),
        categories: allowed.map((item) => item.label.slice(0, 120)),
        modelSelection,
        language: readUiLocale() === "zh-CN" ? "zh" : "en",
      },
    });
    if (version !== generation.current) return;
    setWaiting(false);
    if (result._tag !== "Success") {
      setFailure(
        "Could not get suggestions. Check the suggestion model in Settings and try again.",
      );
      return;
    }
    setSeen(true);
    setModel(result.value.model);
    setRows(
      result.value.suggestions.flatMap((row) => {
        const item = proposed[row.titleIndex];
        const category = allowed[row.categoryIndex];
        return item && category
          ? [{ ...item, categoryId: category.id, reason: row.reason, checked: true }]
          : [];
      }),
    );
  };
  if (
    !open &&
    (seen || candidates.length < 5 || models.length === 0 || !canSuggest || categories.length === 0)
  )
    return null;
  const update = (key: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <>
      {!seen && candidates.length >= 5 ? (
        <aside className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <p className="font-semibold">
            {text("{count} threads are still unsorted", { count: candidates.length })}
          </p>
          <p className="text-muted-foreground">
            {text("Get suggestions from titles and review them before moving threads.")}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setSeen(true)}>
              {text("Later")}
            </Button>
            <Button size="xs" onClick={() => void request()}>
              {text("Help me categorize")}
            </Button>
          </div>
        </aside>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogPopup className="w-[min(calc(100vw-32px),560px)] max-w-none overflow-x-hidden">
          <div className="min-w-0 space-y-4 p-6">
            <DialogTitle>{text("Suggested categories")}</DialogTitle>
            <DialogDescription>
              {text("Only thread titles are shared. Checked threads move when you confirm.")}
            </DialogDescription>
            {waiting ? (
              <p role="status" className="text-sm text-muted-foreground">
                {text(
                  takingLonger
                    ? "Still waiting for the model to classify these titles…"
                    : "Preparing title suggestions…",
                )}
              </p>
            ) : null}
            {failure ? (
              <p role="alert" className="text-sm text-destructive">
                {text(failure)}
              </p>
            ) : null}
            {!waiting && !failure && rows.length === 0 ? (
              <p role="status" className="text-sm">
                {text("No matching categories were suggested.")}
              </p>
            ) : null}
            {rows.length ? (
              <div className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,144px)]"
                  >
                    <Checkbox
                      checked={row.checked}
                      aria-label={text("Include {title}", { title: row.title })}
                      onCheckedChange={(checked) => update(row.key, { checked })}
                    />
                    <div className="min-w-0 text-stardust-body">
                      <p className="break-words">{row.title}</p>
                      <p className="break-words text-xs text-muted-foreground">{row.reason}</p>
                    </div>
                    <select
                      aria-label={text("Category for {title}", { title: row.title })}
                      className="col-start-2 min-w-0 rounded-md border bg-background p-1 text-xs outline-primary sm:col-start-auto"
                      value={row.categoryId}
                      onChange={(event) => update(row.key, { categoryId: event.target.value })}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {model && !waiting ? (
                <span className="mr-auto text-xs text-muted-foreground">{model}</span>
              ) : null}
              <Button variant="outline" onClick={close}>
                {text("Cancel")}
              </Button>
              {failure && rows.length === 0 ? (
                <Button onClick={() => void request()}>{text("Retry")}</Button>
              ) : (
                <Button
                  disabled={waiting || selected.length === 0}
                  onClick={() => {
                    if (
                      setThreadCategories(
                        Object.fromEntries(selected.map((row) => [row.key, row.categoryId])),
                      )
                    )
                      close();
                    else setFailure("Could not save the category. Check available local storage.");
                  }}
                >
                  {text("Move {count} threads", { count: selected.length })}
                </Button>
              )}
            </div>
          </div>
        </DialogPopup>
      </Dialog>
    </>
  );
}
