import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicSettings } from "@/modules/clinics/queries";
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

  const clinic = await getClinicSettings(session.user.clinicId);

  return (
    <div className="flex min-h-screen">
      <Sidebar canManageStaff={can(session.user.role, "users.manage")} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          clinicName={clinic?.name ?? "Your clinic"}
          userName={session.user.name ?? "Vet"}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
