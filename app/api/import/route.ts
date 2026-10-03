import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MAX_IMPORT_BYTES } from "@/modules/import/limits";
import { readWorkbook, type SheetTable } from "@/modules/import/read-workbook";

/**
 * Turning an uploaded spreadsheet into rows, and nothing else.
 *
 * A route handler rather than a Server Action, and the reason is the size
 * limit. An action's body is capped at 1MB and the only way past it is
 * `experimental.serverActions.bodySizeLimit` in `next.config.ts`
 * (`node_modules/next/dist/docs/.../serverActions.md`), which is global: one
 * screen's file size would become every action's, on an experimental key,
 * written in a place nobody reading this screen would look. Here the limit
 * is next to the thing it limits.
 *
 * Nothing is written. This endpoint reads a file and hands back what it
 * says; the vet decides what any of it means on the screen, and the row that
 * becomes a record is a later slice (#16). That is also why there is no
 * clinic scoping on the response: there is no clinic data in it.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Both, because a row of this file is a client AND an animal: somebody who
  // could import only half of it would fill the screen in and be refused at
  // the end, which is the worst place to say no.
  if (
    !can(session.user.role, "clients.write") ||
    !can(session.user.role, "pets.write")
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "noFile" }, { status: 400 });
  }
  // The browser checks this too. That check is a courtesy to the vet, who
  // gets a sentence instead of a dead request; this one is the control.
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  }

  let sheets: SheetTable[];
  try {
    sheets = await readWorkbook(await file.arrayBuffer());
  } catch {
    // Every way this fails looks the same from here -- a .csv renamed to
    // .xlsx, a password-protected book, a truncated download -- and the
    // screen says so honestly rather than naming a cause it does not know.
    return NextResponse.json({ error: "unreadable" }, { status: 422 });
  }

  // A book whose sheets are all empty is not an error: the file was read and
  // it says nothing. The screen has a sentence for that, and it is a
  // different sentence from "this file could not be read".
  return NextResponse.json({ sheets });
}
