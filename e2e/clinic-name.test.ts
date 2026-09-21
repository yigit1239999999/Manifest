import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The e2e suite signs up through the real form, so the clinics it
// creates are indistinguishable from real ones except by their name.
// `scripts/loop-metrics.mjs` excludes them from every measurement on
// exactly that basis:
//
//   const E2E_CLINIC_PATTERN = "^(Perf )?Clinic [0-9]{10,}$";
//
// Which makes the name a load-bearing string with nothing holding it
// up. A spec that names its clinic something else does not fail; it
// quietly rejoins the population, and the measurement baseline drifts
// with nobody looking. There are 144 of these clinics today, more than
// the real ones.
//
// So the pattern is asserted from both ends: the script counts what
// matches, and this counts what is written. Neither half can move
// without the other going red — a place that makes noise when it
// breaks, rather than a rule someone has to remember.
//
// A vitest file and not a Playwright one on purpose. This has to fail
// in the ordinary test run, not only when somebody has a browser and a
// database to hand.

const PATTERN = /^\^\(Perf \)\?Clinic \[0-9\]\{10,\}\$$/;
const NAME = /^(Perf )?Clinic \$\{[a-zA-Z]+\}$/;

const e2eDir = join(process.cwd(), "e2e");

const specs = readdirSync(e2eDir)
  .filter((f) => f.endsWith(".spec.ts"))
  .map((f) => ({ name: f, source: readFileSync(join(e2eDir, f), "utf8") }));

/** Every clinic name a spec types into the sign-up form. */
function clinicNames(source: string) {
  return [
    ...source.matchAll(/clinic name\|klinik adı[^)]*\)\s*\.fill\(`([^`]*)`\)/g),
  ].map((m) => m[1]);
}

describe("the name the e2e suite gives its clinics", () => {
  it("finds the specs, so an empty scan cannot pass", () => {
    const named = specs.filter(({ source }) => clinicNames(source).length > 0);
    expect(named.length).toBeGreaterThan(5);
  });

  it("matches the pattern the measurements exclude by", () => {
    const offenders: string[] = [];
    for (const { name, source } of specs) {
      for (const clinic of clinicNames(source)) {
        // Compared against the shape rather than a rendered string:
        // the stamp is an expression at this point. What matters is
        // that the literal parts either side of it are the ones the
        // script's regex allows.
        if (!NAME.test(clinic)) offenders.push(`${name}: \`${clinic}\``);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("reads the pattern the script actually uses", () => {
    // The other half. If `loop-metrics.mjs` changes its regex, the
    // shape above stops describing it and this says so — otherwise
    // this file would be asserting a pattern nothing enforces, which
    // is the same defect one level up.
    const script = readFileSync(
      join(process.cwd(), "scripts/loop-metrics.mjs"),
      "utf8",
    );
    const found = script.match(/E2E_CLINIC_PATTERN\s*=\s*"([^"]+)"/);
    expect(found, "E2E_CLINIC_PATTERN is no longer where this looks").not.toBeNull();
    expect(found![1]).toMatch(PATTERN);
  });
});
