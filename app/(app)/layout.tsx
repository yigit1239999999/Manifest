import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicSettings } from "@/modules/clinics/queries";
import { ClinicZoneProvider } from "@/components/clinic-zone";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

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
      {/* Eleven navigation links stand between the top of every page and its
          content. Without this a keyboard user tabs through all of them on
          every single page (TEAM.md #26). Hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>
      <div className="flex min-h-screen">
        <Sidebar
          canManageStaff={can(session.user.role, "users.manage")}
          canManageSettings={can(session.user.role, "settings.manage")}
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
