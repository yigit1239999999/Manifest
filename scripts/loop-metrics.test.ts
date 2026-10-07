import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Two facts about `loop-metrics.mjs` that a reader cannot see and that
// both went wrong once, read out of the source text.
//
// The script talks to a live database, so there is no cheap way to run
// it here. What this file checks is deliberately narrow: it reads the
// source and matches two patterns. It does not run a single query, does
// not know whether the exclusion is correct, and would not notice a new
// query that forgets to scope itself. Those are answered by running
// `node --env-file=.env scripts/loop-metrics.mjs` and reading the
// `EXCLUDED` line it prints.

const SOURCE = readFileSync(
  new URL("./loop-metrics.mjs", import.meta.url),
  "utf8",
);

describe("loop-metrics stays runnable", () => {
  it("passes no bind parameters to a CREATE statement", () => {
    // `CREATE VIEW` is a utility statement and takes none. The first
    // version of the state-clinic exclusion interpolated the clinic id as
    // `$1` and every run died on the first view with "bind message
    // supplies 1 parameters, but prepared statement requires 0" — the
    // exclusion had never once run.
    const createsWithParams = [
      // Two things the pattern has to get right, both learned by
      // watching it fail: `[^`]*` keeps the match inside one template
      // literal, because a lazy `[\s\S]*?` runs on to the next statement
      // that does take parameters; and the comma has to be followed by an
      // array, because a trailing comma before `)` is just formatting.
      ...SOURCE.matchAll(/query\(\s*`\s*CREATE[^`]*`\s*,\s*\[/g),
    ];

    expect(createsWithParams).toHaveLength(0);
  });

  it("reads through the direct endpoint, not the pooler", () => {
    // The temp views only filter the numbers if every statement lands on
    // the same backend. `DATABASE_URL` is pgbouncer in transaction mode,
    // where it need not — and the failure is silent: the queries read the
    // unfiltered tables and report the synthetic clinic as real data.
    expect(SOURCE).toMatch(
      /connectionString:\s*process\.env\.DIRECT_URL\s*\?\?\s*process\.env\.DATABASE_URL/,
    );
  });
});
