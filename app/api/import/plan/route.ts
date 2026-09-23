import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { planImport } from "@/modules/import/service";
import { importRequestSchema } from "@/modules/import/schema";
import { errorResponse, importContext } from "@/modules/import/request";
import type { ImportAnswers } from "@/modules/import/service";

/**
 * What the file would become, and nothing written.
 *
 * A route handler rather than a Server Action for the same reason the
 * reading endpoint is one: an action's body is capped at 1MB and the only
 * way past it is a global experimental key. The sheet comes back here in
 * full, because the dedup half of the plan has to be computed against the
 * clinic's existing clients -- and sending a clinic's client list to the
 * browser to answer a question about a spreadsheet would be handing over
 * far more than the screen is about.
 *
 * Read-only, and it has to stay that way: the vet changes an answer and
 * asks again, as many times as they like, before anything happens.
 */
export async function POST(req: Request) {
  const context = await importContext();
  if (!context.ok) return context.response;

  const body = await req.json().catch(() => null);
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  try {
    const summary = await planImport(
      parsed.data.rows,
      parsed.data.answers as ImportAnswers,
      context.ctx,
    );
    return NextResponse.json({ summary });
  } catch (error) {
    logger.warn("import.plan_failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
}
