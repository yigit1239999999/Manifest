import { redirect } from "next/navigation";
import { PawPrint } from "lucide-react";
import { auth } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <PawPrint className="size-6" />
        </span>
        <span className="text-xl font-semibold tracking-tight">PetTrack</span>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">
        A calmer CRM for veterinary teams.
      </p>
    </div>
  );
}
