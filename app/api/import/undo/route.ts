import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { undoImport } from "@/modules/import/service";
import { errorResponse, importContext } from "@/modules/import/request";

/**
 * Taking an import back.
 *
 * A route handler rather than a Server Action, and not for the size limit
 * this time: undo has to answer with WHAT IT DID -- how many rows went and
 * how many stayed because the clinic has since worked on them. An action
 * here returns a form state, which carries a success flag and nothing to
 * put those numbers in, and inventing a channel for them would put the one
 * sentence the vet needs behind a reload of a list that no longer mentions
 * the rows it is about.
 */
const schema = z.object({ batchId: z.string().min(1) });

export async function POST(req: Request) {
  const context = await importContext();
  if (!context.ok) return context.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  try {
    const result = await undoImport(parsed.data.batchId, context.ctx);
    logger.info("import.undone", {
      clinicId: context.ctx.clinicId,
      batchId: parsed.data.batchId,
      clients: result.clientCount,
      pets: result.petCount,
      keptClients: result.keptClients,
      keptPets: result.keptPets,
    });
    return NextResponse.json({ result });
  } catch (error) {
    logger.warn("import.undo_failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
}
