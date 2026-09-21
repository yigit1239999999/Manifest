import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runDeliveryReportSweep, runReminderSweep } from "@/modules/notifications/service";

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
  // Sending first, then asking what became of what was sent. Same
  // schedule on purpose: a second cron entry is a second thing that can
  // silently stop, and the whole reason this endpoint exists is that
  // nothing was calling the first one.
  const delivery = await runDeliveryReportSweep();
  const body = { ...summary, delivery, ms: Date.now() - startedAt };
  logger.info("cron.reminders", body);
  return Response.json(body);
}
