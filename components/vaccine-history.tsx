import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { dayKey, formatDate } from "@/lib/format";
import {
  officialYearsFrom,
  seriesFrom,
  type DoseRow,
  type VaccineOffer,
} from "@/modules/vaccinations/catalogue";

/**
 * The two questions a list of vaccinations sorted by date cannot answer.
 *
 * The vet was asked whether keeping history rather than one overwritten
 * cell changes anything for them. The answer was not "no":
 *
 *   "Günlük işte evet, yalnız sonuncusuna bakıyorum. Ama geçmişin asıl
 *   lazım olduğu iki yer var. BİR: yavru serisi. Karma üç doz, ve sahibi
 *   ikinci dozdan sonra kayboluyor, üç ay sonra geliyor. O an sorduğum
 *   şey 'en son ne zaman' değil, KAÇINCI DOZDAYDIK... emin olamayınca
 *   baştan başlatıyorum, sahibi de boşuna para veriyor. İKİ: ısırık
 *   olayı. 'Kuduz aşısı geçen sene yapıldı mı, ondan önce de düzenli
 *   miydi' -- ve bu artık benim değil resmî bir soru."
 *
 * So history pays for itself only if it answers those two, and the rows
 * below answer neither: the position is not in them, and a run of years
 * with holes in it cannot be seen in a date-sorted list.
 *
 * THE PRODUCT DOES NOT DECIDE. It says "2/3" and "gecikmiş"; it does not
 * say "start the series again". Whether three months late is too late is
 * a medical judgement, and the whole reason this block exists is that the
 * vet was making it without the facts, not that they were making it
 * wrong.
 */
export async function VaccineHistory({
  offers,
  doses,
}: {
  offers: readonly VaccineOffer[];
  doses: readonly DoseRow[];
}) {
  const [t, fmt] = await Promise.all([
    getTranslations("vaccination"),
    getFormatContext(),
  ]);

  const series = seriesFrom(offers, doses);
  // The clinic's calendar, not the server's: a dose given at 01:00 on
  // 1 January in Istanbul belongs to the year the clinic was standing in.
  const yearOf = (date: Date) => Number(dayKey(date, fmt.timeZone).slice(0, 4));
  const official = officialYearsFrom(offers, doses, yearOf, yearOf(new Date()));

  if (series.length === 0 && !official) return null;

  return (
    <div className="flex flex-col gap-2 rounded-control border border-border bg-muted/40 px-3 py-2.5">
      {series.map((entry) => (
        <p key={entry.key} className="text-sm text-foreground">
          <span className="font-medium">
            {t("seriesProgress", { name: entry.name, dose: entry.dose, of: entry.of })}
          </span>{" "}
          <span className="text-muted-foreground">
            {entry.nextDueAt === null
              ? t("seriesNoDate")
              : entry.overdue
                ? t("seriesOverdue", { date: formatDate(fmt, entry.nextDueAt) })
                : t("seriesNext", { date: formatDate(fmt, entry.nextDueAt) })}
          </span>
        </p>
      ))}

      {official && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {t("officialTitle", { name: official.name })}
          </p>
          {/* A list, because it is one: each year is an item and the
              reader is counting them. The state is in WORDS on every
              entry -- a year that is missing says so. Colour alone would
              make the gap a verdict, and the gap is a fact; it would
              also be the one thing a screen reader could not read. */}
          <ul className="flex flex-wrap gap-1.5">
            {official.years.map((year) => (
              <li
                key={year.year}
                className={
                  year.given
                    ? "rounded-pill border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                    : "rounded-pill border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground"
                }
              >
                {year.given
                  ? t("officialGiven", { year: year.year })
                  : t("officialMissing", { year: year.year })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
