import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The production build's own directory. `next.config.ts` moves the build
    // out of `.next` when `NEXT_DIST_DIR` is set, and `scripts/serve-prod.sh`
    // sets it to `.next-prod` so a build cannot pull the chunks out from
    // under the dev server on 3000. The default ignore list never heard of
    // it, so `npx eslint .` was linting compiled chunks: 1576 errors, every
    // one of them in generated output and none in a file anybody wrote.
    // That made the release gate ("eslint . green") unpassable, which is the
    // worse half -- a gate nobody can pass stops being read.
    ".next-prod/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "generated/**",
  ]),
]);

export default eslintConfig;
