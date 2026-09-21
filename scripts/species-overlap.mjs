// Is any clinic-defined species actually a built-in wearing its own name?
//
// The server used to compare what a vet typed against the enum keys
// ("CAT"), not against the name anybody types ("Kedi"), so "Kedi" fell
// through and became a clinic-defined species: the animal was stored as
// OTHER with a custom species beside it, and dropped out of every list
// that groups by CAT. `modules/pets/species-names.ts` closes that for
// new records. This asks what the old ones left behind.
//
// A script and not a migration, and the reason is the catalogue. The
// names live in messages/{tr,en}.json and are read here at run time; a
// migration would have to copy twenty-eight of them into SQL, and that
// copy is wrong the day somebody renames a species or adds a language.
// A derived artefact is generated where it is used, never copied.
//
// It exits non-zero when it finds anything, because merging is not a
// decision to take quietly: which animals move, and which of two names
// survives, is a question for a person.
//
// Run: node --env-file=.env scripts/species-overlap.mjs
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { fold } from "../lib/search.ts";

const LOCALES = ["tr", "en"];

/** Folded localized name -> built-in species key, in every language. */
const builtIn = new Map();
for (const locale of LOCALES) {
  const species = JSON.parse(
    readFileSync(
      new URL(`../messages/${locale}.json`, import.meta.url),
      "utf8",
    ),
  ).enum.species;
  for (const [key, label] of Object.entries(species)) {
    // "Other" is the absence of an answer, not a species. A clinic that
    // defined one called "Diğer" meant something, and it is not this.
    if (key === "OTHER") continue;
    builtIn.set(fold(label), key);
  }
}

const db = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
await db.connect();

// `public.` on purpose: scripts/loop-metrics.mjs hides synthetic clinics
// behind temp views, and this question is about every row there is.
const { rows } = await db.query(`
  SELECT cs.id, cs.name, cs."nameKey", cl.name AS clinic,
         (SELECT count(*) FROM public.pets p
           WHERE p."customSpeciesId" = cs.id)::int AS pets
    FROM public.custom_species cs
    JOIN public.clinics cl ON cl.id = cs."clinicId"
   ORDER BY cs."createdAt"`);

const collisions = rows.filter((r) => builtIn.has(r.nameKey));

for (const r of collisions) {
  console.log(
    `COLLISION clinic=${JSON.stringify(r.clinic)} name=${JSON.stringify(r.name)} ` +
      `is really ${builtIn.get(r.nameKey)}, ${r.pets} animal(s) attached`,
  );
}

console.log(
  `SPECIES_OVERLAP [${rows.length} clinic-defined species, ${collisions.length} that are built-ins, ` +
    `${collisions.reduce((n, r) => n + r.pets, 0)} animals attached to those] ` +
    `against ${builtIn.size} names over ${new Set(builtIn.values()).size} species`,
);

await db.end();
if (collisions.length > 0) process.exitCode = 1;
