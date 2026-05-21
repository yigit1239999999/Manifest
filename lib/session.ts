import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Returns the active session, redirecting to sign-in when absent.
 * Use inside server components and server actions to enforce auth and
 * obtain the tenant `clinicId` for scoping every query.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.clinicId) {
    redirect("/sign-in");
  }
  return session;
}
