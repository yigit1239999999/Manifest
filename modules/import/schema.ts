import { z } from "zod";
import { SPECIES } from "@/modules/pets/schema";

/**
 * What the screen sends back when it asks for a plan or asks to write.
 *
 * The rows come back rather than the file. They are the cells as the
 * workbook had them -- the browser read them out of a file the browser
 * chose -- so re-uploading the file to "verify" them would be checking one
 * copy of the vet's own data against another copy of the vet's own data,
 * at the cost of parsing the workbook again on every plan. Nothing here is
 * trusted for AUTHORITY: the clinic comes from the session, the permission
 * is checked in the service, and forging a row grants nobody a record they
 * could not type into the client form.
 */

const field = z.string().min(1);

export const importAnswersSchema = z.object({
  fileName: z.string().max(200),
  sheetIndex: z.number().int().min(0),
  headerRow: z.boolean(),
  mapping: z.record(z.string(), field),
  dateOrders: z.record(z.string(), z.enum(["dayFirst", "monthFirst"])),
  duplicates: z.record(
    z.string(),
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("separate") }),
      z.object({ kind: z.literal("existing"), id: z.string().min(1) }),
      z.object({ kind: z.literal("group"), key: z.string().min(1) }),
    ]),
  ),
  species: z.record(
    z.string(),
    z.object({
      target: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("builtIn"), key: z.enum(SPECIES) }),
        z.object({ kind: z.literal("custom"), id: z.string().min(1) }),
        z.object({ kind: z.literal("newCustom"), name: z.string().min(1).max(60) }),
        z.object({ kind: z.literal("unknown") }),
      ]),
      breed: z.string().max(120).optional(),
    }),
  ),
  sex: z.record(z.string(), z.enum(["MALE", "FEMALE", "UNKNOWN"])),
  /**
   * The vet's one answer for rows the file says no species for (#42).
   *
   * Optional, and that is the whole of "the product proposes, it does not
   * decide": absent means the question was left alone, and rows with no
   * species of their own are recorded as "other" exactly as they were before
   * this field existed. `newCustom` and `unknown` are not options here -- see
   * `SpeciesFallback`.
   */
  speciesFallback: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("builtIn"), key: z.enum(SPECIES) }),
      z.object({ kind: z.literal("custom"), id: z.string().min(1) }),
    ])
    .optional(),
});

/**
 * A ceiling on how much of a spreadsheet one request may carry.
 *
 * NOT A MEASUREMENT, in the same sense as `MAX_IMPORT_BYTES`: no real
 * clinic's file has been seen. It is the point past which a request is more
 * likely to be something other than a clinic's client list, and it sits
 * here rather than being left implicit so that hitting it produces a
 * sentence instead of a request that dies somewhere in the middle.
 */
export const MAX_IMPORT_ROWS = 50_000;
export const MAX_IMPORT_COLUMNS = 200;

export const importRequestSchema = z.object({
  rows: z.array(z.array(z.string()).max(MAX_IMPORT_COLUMNS)).max(MAX_IMPORT_ROWS),
  answers: importAnswersSchema,
});
