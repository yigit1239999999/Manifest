import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import tr from "./tr.json";
import en from "./en.json";

// Two tests died with `speciesLabel` and `sexLabel`, and one of them was
// mourned: `speciesLabel("DRAGON") === "DRAGON"` held the rule that an
// unknown value falls back to its own name. It is not coming back, and it
// should not: `species` is a database enum, so "DRAGON" cannot be written
// in the first place. That test guarded a state the schema makes
// unreachable.
//
// The reachable defect is its mirror, and nothing was holding it: add a
// member to an enum in `schema.prisma`, forget `messages/*.json`, and the
// screen that draws it breaks -- next-intl raises on a missing key rather
// than printing the raw value the old helper would have shown. So the
// failure got *worse* when the helpers went away, and quieter: it only
// appears once a record carries the new member.
//
// This reads the schema rather than the generated client on purpose. The
// client is regenerated from the schema, so asserting against it would ask
// the same source twice and agree with itself whichever way it was wrong.

const SCHEMA = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

/**
 * Which enums are shown to a person, and under which key.
 *
 * Written out rather than derived from the enum name, because the mapping
 * is not mechanical (`UserRole` is drawn as `enum.role`) and because the
 * list itself is the statement worth keeping: an enum that is absent here
 * is one the product never prints. `MessageDeliveryStatus` is the case
 * that proves it -- five members, no translation block, and correct:
 * `reminderDeliveryState` turns it into sentence states before it reaches
 * a screen, so a translation block for it would be dead weight that the
 * next reader would take as the pattern.
 */
const SHOWN: Record<string, string> = {
  UserRole: "role",
  ContactMethod: "contactMethod",
  Species: "species",
  Sex: "sex",
  VisitType: "visitType",
  AppointmentStatus: "appointmentStatus",
  PrescriptionStatus: "prescriptionStatus",
  DiagnosticType: "diagnosticType",
  NoteKind: "noteKind",
  ReminderType: "reminderType",
  ReminderStatus: "reminderStatus",
  InvoiceStatus: "invoiceStatus",
  PaymentMethod: "paymentMethod",
  MessageChannel: "messageChannel",
  MessageKind: "messageKind",
  MessageStatus: "messageStatus",
  AuditAction: "auditAction",
};

/** The members of one `enum` block, without its comments or attributes. */
function members(name: string): string[] {
  const block = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`).exec(SCHEMA);
  if (!block) throw new Error(`enum ${name} is not in schema.prisma`);
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@"));
}

const LOCALES = { tr, en } as Record<string, { enum: Record<string, Record<string, string>> }>;

describe("every enum member a screen can draw has words for it", () => {
  for (const [enumName, key] of Object.entries(SHOWN)) {
    for (const locale of Object.keys(LOCALES)) {
      it(`${enumName} is complete in ${locale}`, () => {
        const words = LOCALES[locale].enum[key];
        expect(words, `messages/${locale}.json has no enum.${key}`).toBeDefined();
        // Both directions: a member with no words breaks the screen, and
        // words with no member are a key nobody will ever ask for -- which
        // is how a rename leaves the old label sitting there looking live.
        expect(Object.keys(words).sort()).toEqual(members(enumName).sort());
      });
    }
  }

  it("says which enums are deliberately not drawn", () => {
    const all = [...SCHEMA.matchAll(/enum\s+(\w+)\s*\{/g)].map((m) => m[1]);
    const undeclared = all.filter((name) => !(name in SHOWN));

    // Not "there are none": naming them here is the point. If a third
    // appears, this line is where someone decides whether it is drawn or
    // derived -- rather than discovering the answer from a clinic looking
    // at a blank cell.
    //
    // `DueSource` is not drawn, and the decision is worth the sentence.
    // The screen does not print "LIST" or "HISTORY"; it prints what each
    // of them MEANS, and those are different sentences rather than labels
    // of one kind -- "measured from your last 4 records" against "came
    // from the list". Giving the members labels would produce three
    // strings nobody asks for, which is the dead-catalogue-entry defect
    // this repo has already paid for once.
    //
    // `ConsentSource` is not drawn either: it is the path a consent answer
    // came in by, stamped by the code and read only when someone asks for
    // the proof. No screen prints it today; the day one does, it moves up
    // into `SHOWN` with its words.
    //
    // `RecallOutcome` is not drawn as a label: the recall list prints a
    // sentence per outcome ("Arandı · Selin · 7 Eki", "3 kez denendi,
    // ulaşılamadı"), and the buttons that make one are verbs, not states.
    expect(undeclared).toEqual([
      "ConsentSource",
      "DueSource",
      "RecallOutcome",
      "MessageDeliveryStatus",
    ]);
  });
});
