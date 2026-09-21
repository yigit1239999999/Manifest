import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A design token is only usable if it exists in EVERY theme. A token defined
// in `:root` but forgotten in the dark blocks does not fail loudly — it
// silently inherits the light value, which is how "text-amber-700 on a dark
// card" shipped. This test is the rule; task descriptions expire, tests don't.
//
// There are three blocks to keep in lockstep:
//   1. `:root, :where([data-theme="light"])`  — the light palette
//   2. `[data-theme="dark"]`                  — the explicit dark choice
//   3. `[data-theme="system"]` inside `@media (prefers-color-scheme: dark)`
//      — "system" resolved to the OS preference in pure CSS
// Blocks 2 and 3 must carry the same values as each other: picking "dark"
// explicitly and having the OS pick it for you must look identical.

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

/** Returns the body of the block whose selector line starts at `from`. */
function blockBodyAt(source: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIndex + 1, i);
    }
  }
  throw new Error("Unbalanced braces in globals.css");
}

/**
 * Finds a block by its selector and returns its body. The selector must start
 * a line and be followed directly by `{`, so that a mention of the same
 * selector inside another rule — `@custom-variant dark (&:where([data-theme=
 * "dark"], ...))` — is not mistaken for the block itself.
 */
function findBlock(source: string, selector: string): string {
  const pattern = new RegExp(
    `^[ \\t]*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*\\{`,
    "m",
  );
  const match = pattern.exec(source);
  if (!match) throw new Error(`No block for selector: ${selector}`);
  return blockBodyAt(source, match.index + match[0].length - 1);
}

/** Parses `--name: value;` declarations out of a block body. */
function customProperties(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)\s*;/gi)) {
    out.set(match[1], match[2].trim());
  }
  return out;
}

/** Pulls the three theme palettes out of a stylesheet. */
export function readThemePalettes(source: string) {
  // The "system" block lives inside the media query, so scope its lookup to
  // the media body rather than matching `[data-theme=...]` anywhere.
  const mediaAt = source.indexOf("@media (prefers-color-scheme: dark)");
  if (mediaAt < 0) throw new Error("No prefers-color-scheme: dark block");
  const mediaBody = blockBodyAt(source, source.indexOf("{", mediaAt));

  return {
    light: customProperties(
      findBlock(source, ':root,\n:where([data-theme="light"])'),
    ),
    dark: customProperties(findBlock(source, '[data-theme="dark"]')),
    system: customProperties(findBlock(mediaBody, '[data-theme="system"]')),
  };
}

const names = (m: Map<string, string>) => [...m.keys()].sort();

/** The rule itself, as a list of complaints. Empty means the palette is sound. */
export function themePaletteViolations(source: string): string[] {
  const { light, dark, system } = readThemePalettes(source);
  const problems: string[] = [];

  if (light.size === 0) problems.push("light palette defines no tokens");

  for (const [label, palette] of [
    ["dark", dark],
    ["system", system],
  ] as const) {
    for (const name of names(light)) {
      if (!palette.has(name)) problems.push(`${name} missing from ${label}`);
    }
    for (const name of names(palette)) {
      if (!light.has(name)) problems.push(`${name} missing from light`);
    }
  }

  for (const name of names(dark)) {
    // Choosing "dark" and letting the OS choose it must be the same palette.
    if (system.has(name) && system.get(name) !== dark.get(name)) {
      problems.push(`${name} differs between dark and system`);
    }
    // A token that carries the light value into dark is the bug this file
    // exists to catch — it reads as "themed" but is not.
    if (light.get(name) === dark.get(name)) {
      problems.push(`${name} is not overridden in dark`);
    }
  }

  return problems;
}

describe("globals.css theme tokens", () => {
  it("defines every token in all three theme blocks, with dark actually dark", () => {
    expect(themePaletteViolations(css)).toEqual([]);
  });

  it("parses the real stylesheet rather than silently finding nothing", () => {
    const { light, dark, system } = readThemePalettes(css);
    expect(light.size).toBeGreaterThan(10);
    expect(dark.size).toBe(light.size);
    expect(system.size).toBe(light.size);
  });
});

// The check above only means something if it can fail. These fixtures are the
// three ways a token goes wrong, each caught by name.
describe("the theme token rule has teeth", () => {
  const stylesheet = (
    lightBody: string,
    darkBody: string,
    systemBody: string,
  ) => `:root,
:where([data-theme="light"]) {
${lightBody}
}

[data-theme="dark"] {
${darkBody}
}

@media (prefers-color-scheme: dark) {
  [data-theme="system"] {
${systemBody}
  }
}
`;

  const sound = stylesheet(
    "  --bg: #fff;\n  --fg: #000;",
    "  --bg: #000;\n  --fg: #fff;",
    "    --bg: #000;\n    --fg: #fff;",
  );

  it("passes a sound stylesheet", () => {
    expect(themePaletteViolations(sound)).toEqual([]);
  });

  it("catches a token missing from the dark blocks", () => {
    const missing = stylesheet(
      "  --bg: #fff;\n  --fg: #000;\n  --callout-danger-fg: #7a1f18;",
      "  --bg: #000;\n  --fg: #fff;",
      "    --bg: #000;\n    --fg: #fff;",
    );
    expect(themePaletteViolations(missing)).toEqual([
      "--callout-danger-fg missing from dark",
      "--callout-danger-fg missing from system",
    ]);
  });

  it("catches dark and system drifting apart", () => {
    const drifted = stylesheet(
      "  --bg: #fff;\n  --fg: #000;",
      "  --bg: #000;\n  --fg: #fff;",
      "    --bg: #111;\n    --fg: #fff;",
    );
    expect(themePaletteViolations(drifted)).toContain(
      "--bg differs between dark and system",
    );
  });

  it("catches a light value copied into dark", () => {
    const copied = stylesheet(
      "  --bg: #fff;\n  --fg: #000;",
      "  --bg: #fff;\n  --fg: #fff;",
      "    --bg: #fff;\n    --fg: #fff;",
    );
    expect(themePaletteViolations(copied)).toContain(
      "--bg is not overridden in dark",
    );
  });

  it("ignores a selector mentioned inside another rule", () => {
    // `@custom-variant dark (&:where([data-theme="dark"], ...))` sits above
    // the real blocks in globals.css and must not be mistaken for one.
    const withVariant = `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));\n\n${sound}`;
    expect(themePaletteViolations(withVariant)).toEqual([]);
  });
});

// --- Contrast -------------------------------------------------------------
// A warning nobody can read is not a warning. The bug this palette work fixes
// was `text-amber-700` (#b45309) on a dark card: 3.16:1, comfortably illegible.
// Callouts paint text in the role colour over that same colour at 10% alpha,
// so the text/background pair is what has to be measured — not the raw value
// against a plain surface, which flatters it.

const srgbToLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function parseHex(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) throw new Error(`Not a 6-digit hex colour: ${value}`);
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const relativeLuminance = ([r, g, b]: [number, number, number]) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(parseHex(a)), relativeLuminance(parseHex(b))].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/** Composites `fg` at `alpha` over `bg` — what `bg-<role>/10` actually paints. */
export function composite(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return `#${f
    .map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0"))
    .join("")}`;
}

describe("status colours are readable in both themes", () => {
  const { light, dark } = readThemePalettes(css);

  // Every surface one of these tinted boxes is placed on today.
  const surfaces = ["--card", "--bg", "--muted"] as const;

  // Roles used as `text-<role>` over `bg-<role>/10`.
  const tintedRoles = ["--warning", "--destructive"] as const;

  for (const [themeName, palette] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const role of tintedRoles) {
      for (const surface of surfaces) {
        it(`${role} text clears WCAG AA on ${surface} in ${themeName}`, () => {
          const colour = palette.get(role)!;
          const behind = palette.get(surface)!;
          const ratio = contrastRatio(colour, composite(colour, behind, 0.1));
          expect(
            ratio,
            `${role} ${colour} on ${surface} ${behind}`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    it(`--destructive-fg clears WCAG AA on solid --destructive in ${themeName}`, () => {
      // The other way this role is used: a filled button. Darkening the role
      // for the tinted case must not break the solid case, so both are pinned.
      const ratio = contrastRatio(
        palette.get("--destructive-fg")!,
        palette.get("--destructive")!,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("scores the known-bad colours as failing, so the bar is real", () => {
    // A test that cannot fail proves nothing. These are the exact colours that
    // shipped, measured against the exact surfaces they shipped against.
    const darkCard = dark.get("--card")!;
    const lightMuted = light.get("--muted")!;

    const amber700 = "#b45309";
    expect(
      contrastRatio(amber700, composite(amber700, darkCard, 0.1)),
      "text-amber-700 on a dark card",
    ).toBeLessThan(4.5);

    const oldDestructive = "#c24a3f";
    expect(
      contrastRatio(oldDestructive, composite(oldDestructive, lightMuted, 0.1)),
      "the previous --destructive on a light muted surface",
    ).toBeLessThan(4.5);
  });
});

// --- Filled surfaces ------------------------------------------------------
// The tinted-box test above measures `text-<role>` over `bg-<role>/10`. The
// status badges add a second recipe: text of one role over a *solid* fill of
// another (`bg-muted text-muted-foreground`, `bg-accent text-accent-foreground`).
// That pair was never measured, and the neutral badge — the most common one in
// the app — was failing at 4.08:1.

describe("filled surfaces are readable in both themes", () => {
  const { light, dark } = readThemePalettes(css);

  /** Every `bg-<fill> text-<role>` pair the UI actually paints. */
  const filled = [
    // `Badge variant="default"`, and every `hover:bg-muted` control that keeps
    // its muted text: `button` ghost, the sidebar, the command palette.
    { name: "muted-foreground on a muted fill", fg: "--muted-fg", bg: "--muted" },
    // `Badge variant="primary"` and `variant="secondary"`.
    { name: "accent-foreground on an accent fill", fg: "--accent-fg", bg: "--accent" },
    // Filled primary buttons.
    { name: "primary-foreground on primary", fg: "--primary-fg", bg: "--primary" },
  ] as const;

  for (const [themeName, palette] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const pair of filled) {
      it(`${pair.name} clears WCAG AA in ${themeName}`, () => {
        const fg = palette.get(pair.fg)!;
        const bg = palette.get(pair.bg)!;
        expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("scores the muted foreground that shipped as failing, so the bar is real", () => {
    // #756f64 looked fine because it was only ever checked against the page
    // background (4.53). On the muted fill it actually sits on, it was 4.08.
    const shipped = "#756f64";
    expect(
      contrastRatio(shipped, light.get("--muted")!),
      "the previous --muted-fg on a light muted fill",
    ).toBeLessThan(4.5);
    expect(
      contrastRatio(shipped, light.get("--bg")!),
      "…while clearing AA on the page background, which is why it was missed",
    ).toBeGreaterThanOrEqual(4.5);
  });
});
