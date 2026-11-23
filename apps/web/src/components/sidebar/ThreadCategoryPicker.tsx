import { useUiText } from "~/i18n/useUiText";
import { useSidebarCategories } from "~/hooks/useSidebarCategories";
import { XIcon } from "lucide-react";
import {
  openThreadCategoryPicker,
  setThreadCategory,
  useThreadCategoryPicker,
} from "../../threadCategories";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogPopup, DialogTitle } from "../ui/dialog";
import { toastManager } from "../ui/toast";

/** Manual category choice for one conversation; stored on this machine only. */
export function ThreadCategoryPickerDialog() {
  const target = useThreadCategoryPicker();
  const { overrides, categories, groups } = useSidebarCategories();
  const text = useUiText();
  const current = target ? overrides[target.threadKey] : undefined;
  const choose = (categoryId: string | null) => {
    if (!target) return;
    if (!setThreadCategory(target.threadKey, categoryId))
      toastManager.add({
        type: "error",
        title: text("Could not save the category. Check available local storage."),
      });
    openThreadCategoryPicker(null);
  };
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && openThreadCategoryPicker(null)}>
      <DialogPopup showCloseButton={false}>
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle>{text("Change category")}</DialogTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">{target?.title}</p>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label={text("Close")} />}>
              <XIcon />
            </DialogClose>
          </div>
          <div className="max-h-[min(60vh,520px)] space-y-3 overflow-y-auto">
            {groups.map((group) => (
              <section key={group} aria-label={group}>
                {group ? (
                  <h3 className="mb-1 text-xs font-medium text-muted-foreground">{group}</h3>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {categories
                    .filter((category) => (category.group ?? "") === group)
                    .map((category) => (
                      <Button
                        key={category.id}
                        size="xs"
                        variant={current === category.id ? "default" : "outline"}
                        aria-pressed={current === category.id}
                        onClick={() => choose(category.id)}
                      >
                        {category.label}
                      </Button>
                    ))}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {text("Manual choices stay in place when automatic categories change.")}
            </p>
            {current ? (
              <Button size="xs" variant="ghost" onClick={() => choose(null)}>
                {text("Restore automatic filing")}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
