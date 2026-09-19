import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runReminderSweep } from "@/modules/notifications/service";

// Appointment reminder sweep. Invoke on a schedule (Vercel Cron sends the
// CRON_SECRET as a bearer token automatically; any external scheduler can
// do the same). Idempotent: an appointment gets at most one reminder.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "cron_secret_not_set" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const summary = await runReminderSweep();
  logger.info("cron.reminders", { ...summary, ms: Date.now() - startedAt });
  return Response.json({ ...summary, ms: Date.now() - startedAt });
}
