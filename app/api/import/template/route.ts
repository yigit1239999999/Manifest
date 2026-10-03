import { getLocale, getTranslations } from "next-intl/server";
import { importContext } from "@/modules/import/request";
import { buildTemplate } from "@/modules/import/template";

/** The import template, in the reader's language. Nothing about the clinic is in it. */
export async function GET() {
  const context = await importContext();
  if (!context.ok) return context.response;
  const locale = (await getLocale()) === "en" ? "en" : "tr";
  const t = await getTranslations("import");
  const buffer = await buildTemplate(locale, t("templateSheet"));
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${t("templateFile")}"`,
      "cache-control": "no-store",
    },
  });
}
