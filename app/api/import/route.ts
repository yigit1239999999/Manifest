import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ActionContext } from "@/lib/action";
import {
  commitImport,
  inspectImport,
  previewImport,
  type ExpectedCounts,
} from "@/modules/import/service";

// One endpoint, three steps, each sent the file again.
//
// A route handler and not a server action because of size: a server
// action's body is capped at 1 MB, and the cap exists for good reasons
// everywhere else in the app. Raising it globally to fit one upload would
// widen every form in the product; this route is the only door that needs
// to be wider, so it is the only one that is.

function json(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Same-origin only. The session cookie is SameSite=Lax, which already
  // keeps a cross-site POST from carrying it; this says so out loud
  // rather than leaning on a cookie attribute nobody will reread.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // The clinic comes from the session and nowhere else: nothing in the
  // request names one, so there is nothing to trust or to check.
  const ctx: ActionContext = {
    clinicId: session.user.clinicId,
    userId: session.user.id ?? "",
    userName: session.user.name ?? "",
    userRole: session.user.role ?? "",
  };
  const log = logger.child({ action: "import", clinicId: ctx.clinicId, userId: ctx.userId });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "fileMissing" }, { status: 400 });
  }
  const step = form.get("step");
  const file = form.get("file");
  const upload = file instanceof File ? file : null;
  const mapping = json(form.get("mapping") as string | null);
  const options = json(form.get("options") as string | null);

  try {
    if (step === "inspect") {
      return NextResponse.json(await inspectImport(upload, ctx));
    }
    if (step === "preview") {
      return NextResponse.json(await previewImport(upload, mapping, options, ctx));
    }
    if (step === "commit") {
      const expected = json(form.get("expected") as string | null) as Partial<ExpectedCounts> | null;
      log.info("import.commit.start");
      const result = await commitImport(upload, mapping, options, expected, ctx);
      log.info("import.commit.end", { ...result });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "unknownStep" }, { status: 400 });
  } catch (error) {
    const t = await getTranslations();
    if (error instanceof AppError) {
      const code = (error.details?.importError as string | undefined) ?? error.code;
      const status = error.code === "FORBIDDEN" ? 403 : 400;
      log.warn("import.refused", { code });
      let message: string;
      try {
        message = t(
          error.code === "FORBIDDEN" ? "import.errors.forbidden" : error.messageKey,
          error.messageVars,
        );
      } catch {
        message = t("import.errors.fileUnreadable");
      }
      return NextResponse.json({ error: code, message }, { status });
    }
    log.error("import.failed", {
      err: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "internal", message: t("import.errors.internal") },
      { status: 500 },
    );
  }
}
