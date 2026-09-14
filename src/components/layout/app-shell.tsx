import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  FolderCode,
  LayoutDashboard,
  Menu,
  Settings,
  Webhook,
} from "lucide-react";
import { useCurrentSiteUserState } from "@/lib/site-session";
import { Wordmark } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderCode },
  { to: "/analytics", label: "Analytics", icon: Activity },
  { to: "/docs", label: "Documentation", icon: BookOpen },
  { to: "/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active =
          pathname === item.to ||
          (item.to !== "/dashboard" && pathname.startsWith(item.to));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm transition-colors duration-150",
              active ? "bg-bg-subtle text-fg" : "text-muted hover:bg-bg-subtle hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { user, isPending } = useCurrentSiteUserState();
  const [open, setOpen] = useState(false);

  if (isPending) {
    return (
      <div className="flex min-h-dvh bg-bg">
        <aside className="hidden w-60 border-r border-border p-4 md:block">
          <Skeleton className="h-8 w-36" />
          <div className="mt-8 space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </aside>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-5 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-semibold">Account not ready</h1>
          <p className="mt-2 text-sm text-muted">Accept the cookie notice on the home page to create your automatic UUID account.</p>
          <Button className="mt-5" asChild><Link to="/">Back home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-elevated md:flex">
        <div className="px-4 py-5">
          <Wordmark />
        </div>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <p className="px-5 py-4 font-mono text-[10px] leading-relaxed tracking-wide text-subtle">
          Scripting made possible with grok 4.6
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>
                  <Wordmark />
                </SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setOpen(false)} />
              <p className="mt-6 font-mono text-[10px] text-subtle">
                Scripting made possible with grok 4.6
              </p>
            </SheetContent>
          </Sheet>
          <div className="md:hidden">
            <Wordmark />
          </div>
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {!user.nameCustomized ? (
            <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
              <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
                <p className="font-medium">set your name, or else we do it for u</p>
                <p className="mt-1 text-sm text-muted">Your temporary account name is a short generated ID. Change it in Settings.</p>
                <Button className="mt-3" size="sm" asChild><Link to="/settings">Set your name</Link></Button>
              </div>
            </div>
          ) : null}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
