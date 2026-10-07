// Builds the import screen's fixtures from the command line:
//
//   node scripts/make-import-fixtures.mjs [directory]
//
// The spreadsheets themselves are defined in `e2e/import-fixtures.ts`, which
// the e2e spec imports. This file exists only because that one may not: it
// would need `import.meta` to know it was run directly, and a module with
// `import.meta` cannot be loaded by Playwright's CommonJS `require` -- the
// spec died on its import line before a test ran. So the command line half
// sits here, in a file Playwright never loads, and there is still one
// definition of what each fixture is for.
//
// `.mjs` rather than `.ts`: Node strips the types out of the module it
// imports, and TypeScript will not let a checked file import a `.ts` path.
import path from "node:path";
import { writeFixtures } from "../e2e/import-fixtures.ts";

const dir = process.argv[2] ?? path.join(process.cwd(), "tmp/import-fixtures");
const written = await writeFixtures(dir);
for (const f of written) {
  console.log(`${f.name}  ${(f.bytes / 1024).toFixed(1)} KB\n    ${f.exercises}`);
}
