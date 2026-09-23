import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const HOOK = fileURLToPath(new URL("./pre-commit", import.meta.url));

// The hook's three states, held as a test rather than as a paragraph.
//
// A hook is the easiest mechanism in a repo to break silently: it lives
// outside the build, nothing imports it, and `tsc` never looks at it. The
// day somebody edits the `kill -0` line and a stale lock starts blocking
// every commit, the only thing that would notice is a person -- and the
// first thing that person reaches for is `--no-verify`, which is the end
// of the hook as a mechanism.
//
// Run as a subprocess against a lock file in a TEMP directory, and that
// is not tidiness. Writing this test the obvious way -- against the real
// `E2E_RUNNING` -- is exactly the accident that produced the `E2E_LOCK`
// variable: the hook was tried on the live lock while somebody was
// actually running, and the lock went missing for half a minute. A tool
// that READS a lock must never be exercised on the lock it protects.
async function hook(lockPath: string | null) {
  try {
    const { stdout, stderr } = await run(HOOK, [], {
      env: { ...process.env, E2E_LOCK: lockPath ?? join(tmpdir(), "no-such-lock") },
    });
    return { code: 0, out: stdout + stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, out: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

async function lockFile(pid: number) {
  const dir = await mkdtemp(join(tmpdir(), "pettrack-hook-"));
  const path = join(dir, "E2E_RUNNING");
  await writeFile(
    path,
    `who=test pid=${pid} at=2026-09-23T15:30:00Z head=abc1234 suite=tam-süit\n`,
  );
  return path;
}

describe("the pre-commit reminder", () => {
  it("says nothing when no run is in flight", async () => {
    const { code, out } = await hook(null);
    expect(code).toBe(0);
    expect(out).toBe("");
  });

  it("refuses while a run is in flight, and names who is running", async () => {
    // `process.pid` is alive by definition -- the test itself.
    const { code, out } = await hook(await lockFile(process.pid));
    expect(code).toBe(1);
    // The refusal has to carry the lock's contents. "Refused" on its own
    // pushes a person to `--no-verify`; "who, since when, which HEAD"
    // pushes them to wait. How a gate refuses is part of the gate.
    expect(out).toContain(`pid=${process.pid}`);
    expect(out).toContain("head=abc1234");
    // And it must say what it is NOT, or the next reader trusts it as a
    // lock -- a mechanism believed stronger than it is.
    expect(out).toContain("--no-verify");
  });

  it("lets a commit through when the lock is stale, and says so", async () => {
    // A pid that cannot be running: a crashed run must not hold everyone's
    // commits hostage, or the first person to learn `--force`/`--no-verify`
    // turns every lock in the repo into paper.
    const { code, out } = await hook(await lockFile(999999));
    expect(code).toBe(0);
    expect(out).toContain("BAYAT");
  });
});
