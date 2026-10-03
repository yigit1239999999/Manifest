import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { commitImport } from "@/modules/import/service";
import { importRequestSchema } from "@/modules/import/schema";
import { errorResponse, fieldLabels, importContext, readImportBody } from "@/modules/import/request";
import type { ImportAnswers } from "@/modules/import/service";

/**
 * The one request in this feature that writes.
 *
 * It takes the same body as the plan endpoint on purpose: the vet looked at
 * a plan built from exactly these rows and these answers, and an endpoint
 * that took anything less would be writing from a different reading of the
 * file than the one they approved.
 *
 * Every row it creates carries the batch id, which is what makes the undo
 * on the next screen one statement rather than a list the vet has to work
 * through by hand.
 */
export async function POST(req: Request) {
  const context = await importContext();
  if (!context.ok) return context.response;

  const body = await readImportBody(req);
  if (body === "tooLarge") {
    return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  }
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  try {
    const result = await commitImport(
      parsed.data.rows,
      parsed.data.answers as ImportAnswers,
      context.ctx,
      await fieldLabels(),
    );
    logger.info("import.committed", {
      clinicId: context.ctx.clinicId,
      batchId: result.batchId,
      clients: result.clientCount,
      pets: result.petCount,
    });
    return NextResponse.json({ result });
  } catch (error) {
    logger.warn("import.commit_failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
}
