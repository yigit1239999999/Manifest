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
            // A wide cap, not no cap -- and this line has now been wrong
            // in both directions, so both measurements are here.
            //
            // It was `max-w-6xl` (1152px). On a 1920 screen that left
            // 528px of empty gutter beside a 240px sidebar, about a
            // quarter of the display; the vet said the screen "came up
            // half". So the cap came off, because this product's main
            // screens are tables -- /appointments, /invoices, /visits,
            // /clients -- and every column they cannot fit is a fact
            // someone has to open a detail page to read.
            //
            // Off was also wrong, measured: content then ran to 1616px
            // at 1920, 40% wider than the old cap. Nothing overflowed
            // and nothing was unreachable -- pm checked every element on
            // five pages and found zero past the viewport -- but a
            // three-column client table spread its columns across 1614px,
            // so the eye travels the whole display between a name and a
            // phone number, and cards read as though their contents had
            // drifted apart.
            //
            // 1440 is the middle that survives both complaints: 86% of
            // the available width at 1920 against the old 69%, so the
            // columns stay, and a hard stop on a 2560 display, where
            // uncapped content was heading for ~2250px.
            //
            // This is a floor, not the design. The real answer is a cap
            // per content type -- tables wide, forms and prose narrow --
            // because a 1440px form field is as unreadable as a 1616px
            // one. That work is with ux; this line stops the bleeding.
            className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8"
          >
            {children}
          </main>
        </div>
      </div>
    </ClinicZoneProvider>
  );
}
