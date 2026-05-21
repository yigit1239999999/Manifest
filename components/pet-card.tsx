import Link from "next/link";
import { SpeciesIcon } from "@/components/species-icon";
import { petAge, speciesLabel } from "@/lib/format";

export function PetCard({
  pet,
}: {
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    birthDate: Date | null;
  };
}) {
  const age = petAge(pet.birthDate);
  const meta = [speciesLabel(pet.species), pet.breed, age].filter(Boolean);

  return (
    <Link
      href={`/pets/${pet.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/30"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <SpeciesIcon species={pet.species} className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {pet.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {meta.join(" · ")}
        </span>
      </div>
    </Link>
  );
}
