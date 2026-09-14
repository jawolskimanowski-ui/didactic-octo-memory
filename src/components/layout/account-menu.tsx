import { Link } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { useCurrentSiteUser } from "@/lib/site-session";
import { siteSignOutFn } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu() {
  const user = useCurrentSiteUser();
  if (!user) return null;
  const label = user.displayName || "Set your name";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] px-1.5 hover:bg-bg-subtle">
          <span className="grid size-8 place-items-center rounded-full bg-bg-subtle text-xs font-medium">
            {label.charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-[9rem] truncate text-sm md:inline">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings"><Settings className="size-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void siteSignOutFn().then(() => window.location.assign("/"));
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
