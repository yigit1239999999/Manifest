import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Only data crosses from a server component into a client one. A component
// reference does not, and nothing says so until the page is opened.
//
// `DeleteButton` is `"use client"`, every page that uses it is a server
// component, and `icon={Archive}` looked ordinary at the call site. It
// compiled. It type-checked. It passed every test in this suite and every
// lint rule. Four detail routes — `/clients/[id]`, `/pets/[id]`,
// `/visits/[id]`, `/appointments/[id]` — went to the error boundary, and
// the only way anyone found out was ux opening them in a browser.
//
// So this is not a style rule. It is the one class of defect this codebase
// has produced that every existing gate is blind to, because the gates all
// ask whether the code is well formed and this asks where it runs.
//
// The fix in `delete-button.tsx` was to take a name rather than a
// component, which is also why that prop is a closed union: the boundary
// only carries data, and a closed set of names is data.
//
// NOT CHECKED, so the next reader knows where this stops:
//   - props built at runtime (`icon={cond ? A : B}`, spread objects).
//   - anything reached through a non-JSX call.
//   - functions other than components. A server action passed down is a
//     function and is fine — Next serialises those deliberately — so this
//     looks only at capitalised identifiers, which is the component
//     convention and not a guarantee.
//   - whether a client component is client for a good reason.

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test."))
      out.push(path);
  }
  return out;
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/.test(source);
}

/** `DeleteButton` -> `delete-button`, the file it almost certainly lives in. */
function fileNameOf(component: string): string {
  return component.replace(/(?<!^)(?=[A-Z])/g, "-").toLowerCase();
}

describe("only data crosses into a client component", () => {
  const componentFiles = sourceFiles(`${projectRoot}components`);
  const pages = sourceFiles(`${projectRoot}app`);

  const clientComponents = new Set(
    componentFiles
      .filter((file) => isClientModule(readFileSync(file, "utf8")))
      .map((file) => file.slice(file.lastIndexOf("/") + 1, -4)),
  );

  it("finds the client components, so an empty set cannot pass", () => {
    // If this ever drops to nothing, the scan below is checking nothing.
    expect(clientComponents.size).toBeGreaterThan(10);
    expect(clientComponents.has("delete-button")).toBe(true);
  });

  it("no server component hands one a component as a prop", () => {
    const offenders: string[] = [];

    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      if (isClientModule(source)) continue;

      for (const element of source.matchAll(/<([A-Z]\w+)([^>]*?)\/?>/g)) {
        const [, component, attributes] = element;
        if (!clientComponents.has(fileNameOf(component))) continue;

        for (const attribute of attributes.matchAll(/(\w+)=\{([A-Z]\w*)\}/g)) {
          offenders.push(
            `${file.slice(projectRoot.length)}: <${component} ${attribute[1]}={${attribute[2]}}>`,
          );
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });

  it("recognises the shape it is looking for", () => {
    // Without this the rule could be silently inverted and still pass, and
    // the rule is a regex over JSX, which is the kind of thing that stops
    // matching without telling anyone.
    const attribute = /(\w+)=\{([A-Z]\w*)\}/;
    expect(attribute.test("icon={Archive}")).toBe(true);
    expect(attribute.test('mark="archive"')).toBe(false);
    expect(attribute.test("action={archivePetAction}")).toBe(false);
    expect(fileNameOf("DeleteButton")).toBe("delete-button");
    expect(fileNameOf("ConfirmDialog")).toBe("confirm-dialog");
  });
});
