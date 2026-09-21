import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import { getClinicSettings } from "@/modules/clinics/queries";
import { ClinicZoneProvider } from "@/components/clinic-zone";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

/**
 * The permissions the sidebar needs to decide what to show.
 *
 * Resolved here, once, rather than as a boolean per link. Two of these
 * used to arrive that way and the third, `/audit`, arrived not at all —
 * so every role was offered the clinic's entire change history. A fourth
 * guarded route would have meant a fourth prop; now it is one line in
 * `NAV`.
 */
const NAV_PERMISSIONS = [
  "audit.read",
  "users.manage",
  "settings.manage",
] as const satisfies readonly Permission[];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.clinicId) {
    redirect("/sign-in");
  }

  const [clinic, t] = await Promise.all([
    getClinicSettings(session.user.clinicId),
    getTranslations("nav"),
  ]);

  return (
    <ClinicZoneProvider timeZone={clinic?.timezone}>
      {/* Up to eleven navigation links stand between the top of every page
          and its content. Without this a keyboard user tabs through all of
          them on every single page (TEAM.md #26). Hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>
      <div className="flex min-h-screen">
        <Sidebar
          permissions={NAV_PERMISSIONS.filter((p) =>
            can(session.user.role, p),
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            clinicName={clinic?.name ?? "Your clinic"}
            userName={session.user.name ?? "Vet"}
          />
          <main
            id="main"
            // Focusable only as a jump target, never in the tab order.
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8"
          >
            {children}
          </main>
        </div>
      </div>
    </ClinicZoneProvider>
  );
}
