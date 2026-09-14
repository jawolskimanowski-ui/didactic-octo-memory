import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-fg/8", className)}
      {...props}
    />
  );
}

export { Skeleton };
