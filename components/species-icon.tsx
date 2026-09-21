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
import { cn } from "@/lib/utils";

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

// Lucide has no glyphs for these; an emoji reads instantly and scales with
// the same `size-*` class the icon would get.
const EMOJI: Record<string, string> = {
  FERRET: "🦦",
  AMPHIBIAN: "🐸",
  HORSE: "🐴",
  CATTLE: "🐄",
  SHEEP: "🐑",
  GOAT: "🐐",
};

export function SpeciesIcon({
  species,
  className,
}: {
  species: string;
  className?: string;
}) {
  const emoji = EMOJI[species];
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center leading-none",
          className,
        )}
        style={{ fontSize: "0.95em" }}
      >
        {emoji}
      </span>
    );
  }
  const Icon = ICONS[species] ?? PawPrint;
  return <Icon className={className} />;
}
