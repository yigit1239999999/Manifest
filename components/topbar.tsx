import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";

export function Topbar({
  clinicName,
  userName,
}: {
  clinicName: string;
  userName: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
      <span className="truncate text-sm font-semibold text-foreground">
        {clinicName}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {initials(userName)}
          </span>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {userName}
          </span>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
