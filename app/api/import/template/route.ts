import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildTemplate, TEMPLATE_FIELDS } from "@/modules/import/template";

export async function GET() {
  const session = await auth();
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // The template holds no clinic data, so this gate protects nothing; it
  // is here so the download is offered and served to the same people.
  if (!can(session.user.role, "settings.manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const locale = (await getLocale()) === "en" ? "en" : "tr";
  const t = await getTranslations("import");
  const labels = Object.fromEntries(
    TEMPLATE_FIELDS.map((f) => [f, t(`fields.${f}`)]),
  ) as Record<(typeof TEMPLATE_FIELDS)[number], string>;

  const buffer = await buildTemplate(locale, labels, {
    title: t("template.helpTitle"),
    lines: [1, 2, 3, 4, 5, 6].map((n) => t(`template.help${n}` as never)),
    sheetData: t("template.sheetData"),
    sheetHelp: t("template.sheetHelp"),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${t("template.fileName")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
