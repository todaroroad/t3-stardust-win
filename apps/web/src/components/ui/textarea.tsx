import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import type * as React from "react";

import { cn } from "~/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
};

function Textarea({
  className,
  size = "default",
  unstyled = false,
  rows,
  ...props
}: TextareaProps) {
  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 transition-[border-color,box-shadow,background-color] duration-180 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-foreground/15 has-focus-visible:shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_-4px_rgba(0,0,0,0.08)] has-disabled:opacity-64 has-[:disabled,[aria-invalid]]:shadow-none not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:has-focus-visible:border-foreground/18 dark:has-focus-visible:shadow-[0_1px_3px_rgba(0,0,0,0.22),0_4px_14px_-4px_rgba(0,0,0,0.36)] dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="textarea-control"
      data-unstyled={unstyled || undefined}
    >
      <FieldPrimitive.Control
        render={(defaultProps) => (
          <textarea
            className={cn(
              "field-sizing-content max-h-64 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] caret-primary outline-none wrap-anywhere",
              rows === undefined && "min-h-17.5 max-sm:min-h-20.5",
              size === "sm" && "px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)]",
              size === "sm" && rows === undefined && "min-h-16.5 max-sm:min-h-19.5",
              size === "lg" && "py-[calc(--spacing(2)-1px)]",
              size === "lg" && rows === undefined && "min-h-18.5 max-sm:min-h-21.5",
            )}
            // field-sizing: content ignores `rows`, so an explicit row count sets the minimum height.
            style={
              rows === undefined
                ? undefined
                : {
                    minHeight: `calc(${rows}lh + 2 * (var(--spacing) * ${size === "sm" ? 1 : size === "lg" ? 2 : 1.5} - 1px))`,
                  }
            }
            data-slot="textarea"
            rows={rows}
            {...mergeProps(defaultProps, props)}
          />
        )}
      />
    </span>
  );
}

export { Textarea, type TextareaProps };
