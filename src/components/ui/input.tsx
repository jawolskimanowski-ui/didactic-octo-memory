import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[var(--radius-sm)] bg-bg-subtle px-3 text-sm text-fg shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 placeholder:text-subtle",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--color-accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
