import {
  Bird,
  Cat,
  Dog,
  Fish,
  Mouse,
  PawPrint,
  Rabbit,
  Sparkles,
  Turtle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  DOG: Dog,
  CAT: Cat,
  BIRD: Bird,
  RABBIT: Rabbit,
  RODENT: Mouse,
  REPTILE: Turtle,
  FISH: Fish,
  EXOTIC: Sparkles,
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
