import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Backlog 5: why lists stopped refreshing, stated where it can fail again.
//
// Every inline form used to call `revalidatePath` from inside its action. The
// revalidation triggers a router refresh that races the `useActionState`
// transition on the client and can supersede it, so the result never lands:
// roughly one submit in three left the form disabled forever and the list
// unchanged (`86f3901`, measured against real Postgres + Chromium, 16/16
// after the fix). The user's reading of "the list did not change" is that
// nothing saved, so they save it again — the bug's real cost is duplicate
// medical records, not a stuck spinner.
//
// The fix was to refresh from the client instead: `useActionForm` calls
// `router.refresh()` once the result has arrived
// (`components/forms/action-form.tsx`). Nothing stops the next action from
// reaching for `revalidatePath` again, which is what this test is for — it
// fails with the action's name rather than intermittently, in a browser,
// three screens away.
//
// The rule is not "never revalidate". It is: an action that hands a value
// back to a form on the same page must not also revalidate. Redirecting
// actions leave the page anyway, and `Promise<void>` actions are submitted
// by a plain form with nothing waiting on a result.

const modulesDir = fileURLToPath(new URL(".", import.meta.url));

function actionFiles(): { path: string; source: string }[] {
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${entry.name}/actions.ts`)
    .flatMap((relative) => {
      try {
        return [
          {
            path: `modules/${relative}`,
            source: readFileSync(`${modulesDir}${relative}`, "utf8"),
          },
        ];
      } catch {
        // Not every module mutates anything.
        return [];
      }
    });
}

interface Action {
  file: string;
  name: string;
  body: string;
}

/** Each `export const xAction = action(…)` block, split by the next export. */
function declaredActions(): Action[] {
  return actionFiles().flatMap(({ path, source }) =>
    source
      .split("export const ")
      .slice(1)
      .map((body) => ({ file: path, name: body.split("=")[0].trim(), body })),
  );
}

const actions = declaredActions();

describe("server actions", () => {
  it("are found at all, so an empty scan cannot pass silently", () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  it("never both revalidate a path and return a result to the caller", () => {
    const racing = actions
      .filter(
        (a) =>
          a.body.includes("revalidatePath(") &&
          a.body.includes("Promise<FormState>") &&
          !a.body.includes("redirect("),
      )
      .map((a) => `${a.file} → ${a.name}`);

    expect(racing).toEqual([]);
  });

  it("archiving leaves the user on the record, everywhere", () => {
    // Three archive actions, three different destinations: a client went
    // to the list, an animal to the list, a visit to its animal's page.
    // The same action must not have three outcomes (TEAM.md #18), and the
    // right one is none of those three — the record still exists, its own
    // page is where the "Archived on …" notice and the Restore beside it
    // live, and being thrown elsewhere hides both. A reversible action
    // that looks like a removal is what backlog 39 was about.
    const leaving = actions
      .filter((a) => /^archive[A-Z]/.test(a.name))
      .filter((a) => a.body.includes("redirect("))
      .map((a) => `${a.file} → ${a.name}`);

    expect(leaving).toEqual([]);
  });

  it("finds the archive actions at all", () => {
    const archiving = actions.filter((a) => /^archive[A-Z]/.test(a.name));

    expect(archiving.length).toBe(3);
  });
});
