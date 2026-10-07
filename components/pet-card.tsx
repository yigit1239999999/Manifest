import Link from "next/link";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { SpeciesIcon } from "@/components/species-icon";
import { Badge } from "@/components/ui/badge";
import { formatDecimal, formatShortDate, petAge } from "@/lib/format";
import type { WeightReading } from "@/modules/pets/weight";

export async function PetCard({
  pet,
}: {
  pet: {
    id: string;
    name: string;
    species: string;
    customSpecies?: { name: string } | null;
    breed: string | null;
    birthDate: Date | null;
    deceased?: boolean;
    /** See `modules/pets/weight.ts`. Absent where the caller did not ask. */
    currentWeight?: WeightReading | null;
  };
}) {
  const fmt = await getFormatContext();
  const t = await getTranslations("enum.species");
  const tPet = await getTranslations("pet");
  const age = petAge(fmt, pet.birthDate);
  const weight = pet.currentWeight
    ? [
        `${formatDecimal(fmt, pet.currentWeight.kg)} kg`,
        pet.currentWeight.at && formatShortDate(fmt, pet.currentWeight.at),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const meta = [
    pet.customSpecies?.name ?? t(pet.species as never),
    pet.breed,
    age,
  ].filter(Boolean);

  return (
    <Link
      href={`/pets/${pet.id}`}
      className={cn(surface, "group flex items-center gap-3 p-3.5 shadow-sm transition-colors hover:border-primary/30")}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-accent text-accent-foreground">
        <SpeciesIcon species={pet.species} className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {pet.name}
          </span>
          {pet.deceased && <Badge variant="outline">{tPet("deceased")}</Badge>}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {meta.join(" · ")}
        </span>
        {/* Its own line: on a two-column grid at 390px the first line is
            already truncating the breed. */}
        {weight && (
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            {weight}
          </span>
        )}
      </div>
    </Link>
  );
}
