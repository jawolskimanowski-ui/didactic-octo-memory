import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "font-sans",
            style: {
              background: "#111114",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f4f4f5",
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
