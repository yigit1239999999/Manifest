import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { MAX_INFLATED_BYTES, MAX_REQUEST_BYTES } from "./limits";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import type { ActionContext } from "@/lib/action";

/**
 * The two things every import endpoint does before it does its own work,
 * and one thing it does after.
 *
 * Shared because the pair used to be copied: the reading endpoint checks
 * `clients.write` AND `pets.write` because a row of this file is a person
 * and an animal, and a second endpoint that checked one of them would be a
 * door beside a locked door.
 */
export async function importContext(): Promise<
  { ok: true; ctx: ActionContext } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.clinicId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  // Both halves, because a row of this file is a person AND an animal.
  // Checked again inside the service, where the rule belongs; this is the
  // early no, so a request without it never reaches the parsing.
  if (
    !can(session.user.role, "clients.write") ||
    !can(session.user.role, "pets.write")
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return {
    ok: true,
    ctx: {
      clinicId: session.user.clinicId,
      userId: session.user.id,
      userName: session.user.name ?? "",
      userRole: session.user.role ?? "",
    },
  };
}

/** An `AppError` as a status the screen can act on, and nothing else. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code === "NOT_FOUND"
          ? 404
          : error.code === "VALIDATION_FAILED"
            ? 422
            : 400;
    return NextResponse.json({ error: error.code, messageKey: error.messageKey }, { status });
  }
  // Deliberately nothing about what went wrong: the screen has a sentence
  // for "this did not work", and a database message is not it.
  return NextResponse.json({ error: "unexpected" }, { status: 500 });
}

/**
 * The plan or commit body, gzip or not.
 *
 * The screen compresses the rows (`CompressionStream`) because the host's
 * request ceiling is the one real limit on an import (`limits.ts`), and a
 * clinic's spreadsheet is text that shrinks tenfold. A browser without
 * `CompressionStream` sends plain JSON and is read the same way.
 *
 * Returns null for anything that is not a readable JSON body, and the
 * string "tooLarge" when the body is over the ceiling -- the route turns
 * that into the 413 the screen has a sentence for.
 */
export async function readImportBody(req: Request): Promise<unknown | "tooLarge" | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_REQUEST_BYTES) return "tooLarge";
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await req.arrayBuffer());
  } catch {
    return null;
  }
  if (bytes.length > MAX_REQUEST_BYTES) return "tooLarge";
  try {
    const text =
      req.headers.get("x-import-encoding") === "gzip"
        ? gunzipSync(bytes, { maxOutputLength: MAX_INFLATED_BYTES }).toString("utf8")
        : bytes.toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The field names, in the reader's language, for a kept value whose column
 * has no heading of its own: "Doğum tarihi: 2021" in an animal's notes.
 */
export async function fieldLabels(): Promise<Record<string, string>> {
  const t = await getTranslations("import.field");
  const out: Record<string, string> = {};
  for (const key of [
    "client.notes",
    "pet.birthDate",
    "pet.notes",
    "vaccine.name",
    "vaccine.date",
    "vaccine.nextDue",
    "vaccine.column",
  ]) {
    out[key] = t(key as never);
  }
  // The word before a kept next date: "Lyme: 26.10.2026 (sonraki: ...)".
  out["note.next"] = (await getTranslations("import"))("noteNext");
  return out;
}
