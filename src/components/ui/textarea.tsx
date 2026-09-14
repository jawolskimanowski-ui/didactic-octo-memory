import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-[var(--radius-md)] bg-bg-subtle px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 placeholder:text-subtle",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--color-accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
