import { NextResponse } from "next/server";
import { z } from "zod";
import { importContext } from "@/modules/import/request";
import { aiMatchAvailable, aiMatchColumns } from "@/modules/import/ai-match";

/**
 * The columns the screen could not name, asked of a model.
 *
 * The body is already the minimum (headings, a shape, a few samples) and
 * `aiMatchColumns` masks the samples again before they leave -- the screen's
 * masking is a courtesy, this one is the control. Answers 200 with
 * `available: false` when no key is configured, so the screen can tell
 * "not set up" from "failed" without either becoming an error the vet sees.
 */
const schema = z.object({
  columns: z
    .array(
      z.object({
        columnIndex: z.number().int().min(0),
        heading: z.string().max(500),
        kind: z.string().max(20),
        samples: z.array(z.string().max(500)).max(10),
      }),
    )
    .max(200),
});

export async function POST(req: Request) {
  const context = await importContext();
  if (!context.ok) return context.response;
  if (!aiMatchAvailable()) return NextResponse.json({ available: false, suggestions: [] });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "badRequest" }, { status: 400 });

  const suggestions = await aiMatchColumns(parsed.data.columns);
  return NextResponse.json({ available: true, suggestions: suggestions ?? [], failed: suggestions === null });
}
