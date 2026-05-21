import { Bird, Cat, Dog, PawPrint, Rabbit, Turtle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  DOG: Dog,
  CAT: Cat,
  BIRD: Bird,
  RABBIT: Rabbit,
  REPTILE: Turtle,
  OTHER: PawPrint,
};

export function SpeciesIcon({
  species,
  className,
}: {
  species: string;
  className?: string;
}) {
  const Icon = ICONS[species] ?? PawPrint;
  return <Icon className={className} />;
}
