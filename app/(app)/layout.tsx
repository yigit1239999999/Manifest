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
            // No reading-width cap. There was one — `max-w-6xl`, 1152px,
            // centred — and on a 1920 screen it left 528px of empty
            // gutter beside a sidebar of 240, about a quarter of the
            // display; on 2560 it was closer to half. A cap like that
            // buys short text lines, and this product's main screens
            // are not text: /appointments, /invoices, /visits and
            // /clients are tables, and every column they cannot fit is
            // a fact the vet has to open a detail page to read. That is
            // the defect we spent the day closing, so paying for it
            // with whitespace was the wrong trade.
            //
            // The cost is real and known: on a very wide display a long
            // prose field — an invoice note, a visit's history — runs to
            // a line length that is hard to read. If that starts to
            // bite, the answer is a cap on those blocks where the prose
            // is, not one on every screen.
            className="w-full flex-1 px-4 py-6 md:px-8 md:py-8"
          >
            {children}
          </main>
        </div>
      </div>
    </ClinicZoneProvider>
  );
}
