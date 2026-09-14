import { Link } from "@tanstack/react-router";
import { useCurrentSiteUserState } from "@/lib/site-session";
import { Wordmark } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function SiteHeader() {
  const { user, isPending } = useCurrentSiteUserState();
  return (
    <div>
      <div className="border-b border-border bg-bg-elevated px-5 py-2 md:px-8">
        <p className="text-center font-mono text-[11px] tracking-wide text-subtle">
          UUID accounts · no email required
        </p>
      </div>
      <header className="relative z-20 flex items-center justify-between gap-4 px-5 py-5 md:px-8">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/docs">Docs</Link>
          </Button>
          {isPending ? (
            <Skeleton className="h-9 w-24" />
          ) : user ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <AccountMenu />
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </header>
    </div>
  );
}
