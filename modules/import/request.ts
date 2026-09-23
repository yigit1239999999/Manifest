import { NextResponse } from "next/server";
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
