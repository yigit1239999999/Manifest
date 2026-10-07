import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { getPrescriptionForPrint } from "@/modules/prescriptions/queries";
import { getClinicLetterhead } from "@/modules/clinics/queries";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { formatDate, formatDateTime, petAge } from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";
import { vetWithTitle } from "@/lib/vet-title";

/**
 * A prescription as paper, for the owner to take to a pharmacy or home
 * (job #17: "reçete çıktısı yok").
 *
 * The clinic, the animal as a pharmacist or the next vet needs it (species,
 * sex, age, weight, chip), the owner, the medication with its dose,
 * frequency, route and length, the instructions, and the prescriber with
 * their title above a signature line.
 */
export default async function PrintPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session, fmt] = await Promise.all([params, requireSession(), getFormatContext()]);
  const [rx, clinic, t, tPet, tSpecies, tSex, tRx] = await Promise.all([
    getPrescriptionForPrint(session.user.clinicId, id),
    getClinicLetterhead(session.user.clinicId),
    getTranslations("invoice"),
    getTranslations("pet"),
    getTranslations("enum.species"),
    getTranslations("enum.sex"),
    getTranslations("prescription"),
  ]);
  if (!rx || !clinic) notFound();

  const pet = rx.pet;
  const weight = rx.visit?.weightKg ?? pet.weightKg;
  const clinicAddress = [clinic.address, [clinic.postalCode, clinic.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const petFacts = [
    pet.customSpecies?.name ?? tSpecies(pet.species as never),
    pet.breed,
    pet.sex !== "UNKNOWN" ? tSex(pet.sex as never) : null,
    petAge(fmt, pet.birthDate),
    weight != null ? `${weight.toLocaleString(fmt.locale === "tr" ? "tr-TR" : "en-US")} kg` : null,
  ].filter(Boolean);

  const rows: Array<[string, string | null]> = [
    [tRx("dosage"), rx.dosage],
    [tRx("frequency"), rx.frequency],
    [tRx("route"), rx.route],
    [tRx("durationDays"), rx.durationDays != null ? tRx("durationShort", { count: rx.durationDays }) : null],
    [tRx("refills"), rx.refills > 0 ? String(rx.refills) : null],
  ];

  return (
    <>
      <PrintToolbar backHref={`/pets/${rx.petId}`} backLabel={t("print.back")} printLabel={t("print.button")} />
      <article className="flex flex-col gap-8 text-sm">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words text-xl font-semibold">{clinic.name}</h1>
            {clinicAddress && <p className="text-muted-foreground">{clinicAddress}</p>}
            {(clinic.phone || clinic.email) && (
              <p className="text-muted-foreground">{[clinic.phone, clinic.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 text-end">
            <p className="text-lg font-semibold uppercase tracking-wide">{t("print.prescriptionTitle")}</p>
            <p className="text-muted-foreground">{formatDate(fmt, rx.startedAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.animal")}</p>
            <p className="font-medium">{pet.name}</p>
            {petFacts.length > 0 && <p>{petFacts.join(" · ")}</p>}
            {pet.microchipId && (
              <p className="text-muted-foreground">
                {tPet("microchipId")}: {pet.microchipId}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tPet("owner")}</p>
            <p className="font-medium">{ownerLabel(pet.owner)}</p>
            {pet.owner.phone && <p>{pet.owner.phone}</p>}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-control border border-border p-4">
          <p className="text-2xl font-semibold" aria-hidden="true">
            Rx
          </p>
          <p className="break-words text-base font-semibold">{rx.medicationName}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
            {rows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
          </dl>
          {rx.instructions && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">{tRx("instructions")}</p>
              <p className="whitespace-pre-line break-words">{rx.instructions}</p>
            </div>
          )}
        </section>

        <section className="ms-auto flex w-full max-w-xs flex-col gap-1 pt-10 text-center">
          <div className="border-t border-foreground/60 pt-2 font-medium">
            {rx.prescribedBy ? vetWithTitle(rx.prescribedBy.name, rx.prescribedBy.role, fmt.locale) : ""}
          </div>
          <p className="text-xs text-muted-foreground">{t("print.signature")}</p>
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t("print.printedAt", { date: formatDateTime(fmt, new Date()) })}
        </footer>
      </article>
    </>
  );
}
