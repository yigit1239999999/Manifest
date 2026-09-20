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
