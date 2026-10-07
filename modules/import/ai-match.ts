import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";
import { FIELD_GROUPS, type ImportField } from "./fields";
import { mask } from "./mask";

/**
 * Asking a model what the columns the product could not name are -- with
 * the vet's clients kept out of the question.
 *
 * WHEN IT RUNS. Only after the deterministic reading (`suggestMapping`) and
 * only for the columns it left open. A file whose headings say what they
 * are never reaches here; a file of "Kolon1, Kolon2, Bilgi" does.
 *
 * WHAT LEAVES. The heading, the column's shape, and at most five sample
 * values passed through `mask()` -- "Ayşe Çelik" leaves as "Xxxx Xxxxx",
 * "0532 111 22 33" as "0XXX XXX XX XX". The product owner's KVKK decision
 * of 23 September (`mask.ts`): enough to recognise a COLUMN, not enough to
 * recognise a PERSON. Never a row, never the file. The screen says so in
 * one line.
 *
 * WHAT COMES BACK IS A PROPOSAL. A field the column's content does not
 * admit is thrown away by the caller (`fields.ts` rule one: content
 * admits), and nothing is imported without the vet's own confirm step.
 *
 * WHEN IT CANNOT RUN -- no key, a timeout, a rate limit, a refusal, an
 * answer that does not parse -- this returns null and the screen carries
 * on with the deterministic reading. The import never depends on it.
 */

export type AiColumn = {
  columnIndex: number;
  heading: string;
  /** The shape `infer.ts` read: phone, date, number, email, text. */
  kind: string;
  /** Real values; masked here, before anything is sent. */
  samples: string[];
};

export type AiConfidence = "high" | "medium" | "low";

export type AiSuggestion = {
  columnIndex: number;
  field: ImportField | null;
  vaccineName: string | null;
  confidence: AiConfidence;
  reason: string;
};

const FIELDS: ImportField[] = [...FIELD_GROUPS.flatMap((g) => g.fields), "skip"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["columns"],
  properties: {
    columns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["columnIndex", "field", "vaccineName", "confidence", "reason"],
        properties: {
          columnIndex: { type: "integer" },
          field: { anyOf: [{ type: "string", enum: FIELDS }, { type: "null" }] },
          vaccineName: { anyOf: [{ type: "string" }, { type: "null" }] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM = `You map the columns of a Turkish veterinary clinic's spreadsheet to the fields of PetTrack, a clinic CRM. Each row of the file is usually one animal with its owner on the same row.

Fields:
- client.firstName: owner's name (or full name when there is no separate surname column)
- client.lastName, client.phone, client.secondaryPhone, client.email, client.address, client.city, client.notes
- pet.name, pet.species (Kedi, Köpek...), pet.breed, pet.sex, pet.birthDate, pet.microchipId (15 digits), pet.color, pet.weightKg, pet.neutered (yes/no), pet.notes
- vaccine.column: a column of dates whose HEADING names one vaccine ("Kuduz Aşısı" -> vaccineName "Kuduz"). Several columns may have this field.
- vaccine.name, vaccine.date, vaccine.nextDue: one vaccine per row, written as a name column, its date and the next date.
- skip: the column should not be imported.

Sample values are masked: X stands for a letter or digit, separators are real. Use the heading, the shape and the masked samples.
Answer for every column you are given. Use null when you cannot tell. "confidence" is high only when the heading and the samples agree. "reason" is one short sentence in Turkish, written for the vet ("Başlık 'Sahibi' ve değerler ad soyad biçiminde").`;

/** The model call. Exported as a seam so tests can replace the client. */
export type MatchClient = Pick<Anthropic, "beta">;

let defaultClient: MatchClient | null = null;

function clientFromEnv(): MatchClient | null {
  // Optional by design: a clinic deployment without a key gets the
  // deterministic reading and nothing else, silently.
  if (!process.env.ANTHROPIC_API_KEY) return null;
  defaultClient ??= new Anthropic({ timeout: 15_000, maxRetries: 1 });
  return defaultClient;
}

export function aiMatchAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function aiMatchColumns(
  columns: readonly AiColumn[],
  client: MatchClient | null = clientFromEnv(),
): Promise<AiSuggestion[] | null> {
  if (!client || columns.length === 0) return null;

  const described = columns.map((column) => ({
    columnIndex: column.columnIndex,
    heading: column.heading.slice(0, 120),
    kind: column.kind,
    samples: [...new Set(column.samples.map((s) => mask(s)).filter((s) => s !== ""))].slice(0, 5),
  }));

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Columns:\n${JSON.stringify(described, null, 1)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      logger.warn("import.ai_match_unusable", { stop: response.stop_reason });
      return null;
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const parsed = JSON.parse(text) as { columns?: unknown };
    if (!Array.isArray(parsed.columns)) return null;

    const asked = new Set(columns.map((c) => c.columnIndex));
    const out: AiSuggestion[] = [];
    for (const entry of parsed.columns as Array<Record<string, unknown>>) {
      const columnIndex = Number(entry.columnIndex);
      if (!asked.has(columnIndex)) continue;
      const field = typeof entry.field === "string" && (FIELDS as string[]).includes(entry.field)
        ? (entry.field as ImportField)
        : null;
      const confidence = entry.confidence === "high" || entry.confidence === "medium" ? entry.confidence : "low";
      out.push({
        columnIndex,
        field,
        vaccineName: typeof entry.vaccineName === "string" && entry.vaccineName.trim() ? entry.vaccineName.trim().slice(0, 80) : null,
        confidence,
        reason: typeof entry.reason === "string" ? entry.reason.slice(0, 200) : "",
      });
    }
    // Counts only. The headings are the clinic's and stay out of the log.
    logger.info("import.ai_match", { asked: columns.length, answered: out.length });
    return out;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      logger.warn("import.ai_match_failed", { kind: "rateLimit" });
    } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
      logger.warn("import.ai_match_failed", { kind: "timeout" });
    } else if (error instanceof Anthropic.APIError) {
      logger.warn("import.ai_match_failed", { kind: "api", status: error.status });
    } else {
      logger.warn("import.ai_match_failed", { kind: "unexpected" });
    }
    return null;
  }
}
