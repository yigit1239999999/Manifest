"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Callout } from "@/components/ui/callout";
import { ownerLabel } from "@/lib/pet-label";
import { formatPhone } from "@/lib/phone";
import type { DuplicateCandidate } from "@/modules/clients/duplicates";

/**
 * "Bu numarayla kayıtlı: Ayşe Tekin (Fındık) · Ona git", under the phone,
 * before the save.
 *
 * The animals are in the line because they are how the counter recognises
 * a client -- "Ayşe, with the cat Fındık" -- and two people of the same
 * name are told apart by them. The way through is a link to the existing
 * record, not a button that merges anything: the person standing there
 * may be somebody else, and only the counter can tell.
 *
 * When it really is a different person sharing the number (a couple, a
 * shelter's volunteers), the box says so and the save goes through. The
 * server refuses without it, so a warning skipped by a fast typist is
 * still asked.
 */
export function DuplicateClientNotice({
  duplicates,
}: {
  duplicates: DuplicateCandidate[];
}) {
  const t = useTranslations("client.duplicate");
  if (duplicates.length === 0) return null;

  return (
    <Callout variant="warning" live title={t("title")}>
      <ul className="flex flex-col gap-1">
        {duplicates.map((d) => (
          <li key={d.id} className="text-foreground">
            {t(d.matchedOn.includes("phone") ? "byPhone" : "byEmail")}{" "}
            <span className="font-medium">{ownerLabel(d)}</span>
            {d.pets.length > 0 && <> ({d.pets.map((p) => p.name).join(", ")})</>}
            {d.phone && <span className="text-muted-foreground"> · {formatPhone(d.phone)}</span>}
            {d.archivedAt && <span className="text-muted-foreground"> · {t("archived")}</span>}
            {" · "}
            <Link href={`/clients/${d.id}`} className="font-medium text-primary hover:underline">
              {t("goTo")}
            </Link>
          </li>
        ))}
      </ul>
      <label className="mt-2 flex min-h-6 items-center gap-2 py-1 text-sm text-foreground">
        <input type="checkbox" name="allowDuplicate" className="size-4" />
        {t("allow")}
      </label>
    </Callout>
  );
}
