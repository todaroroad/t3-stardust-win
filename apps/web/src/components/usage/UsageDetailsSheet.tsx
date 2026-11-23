import type { ReactNode } from "react";
import { UsageMotion } from "./UsageMotion";
import { Sheet, SheetPopup, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
export function UsageDetailsSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 560,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly width?: 400 | 560 | 720;
  readonly children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup
        data-usage-sheet
        data-panel-width={width}
        style={{ width: `min(${width}px, calc(100vw - 16px))`, maxWidth: width }}
        side="right"
        transitionDurationMs={480}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="usage-sheet-content">
          <UsageMotion replay={String(open)} delayMs={120}>
            {children}
          </UsageMotion>
        </div>
      </SheetPopup>
    </Sheet>
  );
}
