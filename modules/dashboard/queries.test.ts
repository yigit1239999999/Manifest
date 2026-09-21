import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPEN_REMINDER_STATUSES } from "@/modules/reminders/queries";

// Enum names written inside raw SQL are invisible to the compiler.
//
// `modules/dashboard/queries.ts` collapses eight counts into one query, and
// that query names statuses as text: 'PENDING', 'ACTIVE', 'PAID'. Rename a
// value in the Prisma enum and nothing here fails — the query simply matches
// no rows and the card reads 0. It does not break; it lies. The migration
// that turns ReminderStatus into OPEN/CLOSED is exactly that case, so the
// check belongs in the suite before the migration, not in a note about it.

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const schema = read("../../prisma/schema.prisma");
const dashboardQueries = read("./queries.ts");

/** Every value of every enum in the Prisma schema. */
function enumValues(source: string): Set<string> {
  const values = new Set<string>();
  for (const block of source.matchAll(/enum\s+\w+\s*\{([^}]*)\}/g)) {
    for (const line of block[1].split("\n")) {
      const value = line.trim();
      if (/^[A-Z][A-Z0-9_]*$/.test(value)) values.add(value);
    }
  }
  return values;
}

/** Upper-case quoted literals compared against a `status` column. */
function statusLiteralsInSql(source: string): string[] {
  const literals: string[] = [];
  for (const match of source.matchAll(/status[^\n]*?(?:=|IN)\s*\(?([^)\n]*)\)?/gi)) {
    for (const literal of match[1].matchAll(/'([A-Z][A-Z0-9_]*)'/g)) {
      literals.push(literal[1]);
    }
  }
  return literals;
}

describe("status names written into raw SQL", () => {
  it("are all real values of a Prisma enum", () => {
    const known = enumValues(schema);
    const used = statusLiteralsInSql(dashboardQueries);

    // If this is empty the scanner stopped seeing the query it guards.
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((s) => !known.has(s))).toEqual([]);
  });

  it("would catch a status the schema does not define", () => {
    const known = enumValues(schema);
    expect(known.has("PAID")).toBe(true);
    expect(known.has("OPEN")).toBe(false);
  });

  it("reads the reminder statuses from the shared constant, not a literal", () => {
    // The dashboard count and the list must move together; a literal here is
    // how they drifted apart in the first place.
    expect(dashboardQueries).toContain("OPEN_REMINDER_STATUSES");
    expect(OPEN_REMINDER_STATUSES).toEqual(["PENDING", "SENT"]);
  });
});
