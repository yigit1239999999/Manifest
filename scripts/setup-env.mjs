// Writes .env for this machine, asking for as little as possible.
//
//   npm run env:setup
//
// Everything that is not a secret is known and filled in here: the Supabase
// project (PetTrack, ref seddtcddfaikqeiruedu, eu-west-1; see AGENTS.md),
// its pooler host and ports, and a fresh AUTH_SECRET. The one thing nobody
// but the owner holds is the database password, so that is the one
// question asked, and only when no copy of it is found nearby: a sibling
// checkout (../Manifest-prod/.env, the served production build) already
// carries a working DATABASE_URL, and if it is there it is taken from
// there. The connection is tried before anything is written, so a wrong
// password fails here with a sentence, not at the first page.
//
// Raw `pg` and no Prisma, like the other scripts beside this one.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pg from "pg";

const PROJECT_REF = "seddtcddfaikqeiruedu";
const POOLER_HOST = "aws-0-eu-west-1.pooler.supabase.com";
const ENV_PATH = resolve(".env");

const SIBLING_ENVS = [
  resolve("..", "Manifest-prod", ".env"),
  join(homedir(), "Manifest-prod", ".env"),
  resolve("..", "Manifest-prod", ".env.local"),
];

/** Minimal .env reader: KEY=value, KEY="value", comments and blanks skipped. */
function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function urls(password) {
  const auth = `postgres.${PROJECT_REF}:${encodeURIComponent(password)}`;
  return {
    DATABASE_URL: `postgresql://${auth}@${POOLER_HOST}:6543/postgres?pgbouncer=true`,
    DIRECT_URL: `postgresql://${auth}@${POOLER_HOST}:5432/postgres`,
  };
}

async function canConnect(connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch (error) {
    console.error(`  bağlanılamadı: ${error.message}`);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function render(values) {
  return (
    `# npm run env:setup tarafından yazıldı. Bir daha elle doldurmanız gerekmez;\n` +
    `# şifre değişirse aynı komutu yeniden çalıştırın.\n` +
    Object.entries(values)
      .map(([k, v]) => `${k}="${v}"`)
      .join("\n") +
    "\n"
  );
}

const current = existsSync(ENV_PATH) ? parseEnv(readFileSync(ENV_PATH, "utf8")) : {};
const skipCheck = process.argv.includes("--skip-check");

if (current.DATABASE_URL && !process.argv.includes("--force")) {
  console.log(`.env zaten dolu (${ENV_PATH}). Yeniden yazmak için: npm run env:setup -- --force`);
  process.exit(0);
}

let found = null;
for (const path of SIBLING_ENVS) {
  if (!existsSync(path)) continue;
  const values = parseEnv(readFileSync(path, "utf8"));
  if (values.DATABASE_URL) {
    found = { path, values };
    break;
  }
}

const values = {};
if (found) {
  console.log(`Veritabanı bağlantısı ${found.path} dosyasından alındı.`);
  values.DATABASE_URL = found.values.DATABASE_URL;
  values.DIRECT_URL = found.values.DIRECT_URL ?? found.values.DATABASE_URL;
  if (found.values.ANTHROPIC_API_KEY) values.ANTHROPIC_API_KEY = found.values.ANTHROPIC_API_KEY;
} else {
  const rl = createInterface({ input: stdin, output: stdout });
  // Answers are taken from a queue of lines rather than `rl.question`, so a
  // piped input (every answer arriving at once, then end-of-file) is read in
  // order, and an input that ends answers every later question with nothing
  // instead of leaving the script waiting on a closed stream.
  const lines = [];
  const waiting = [];
  let closed = false;
  rl.on("line", (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else lines.push(line);
  });
  rl.on("close", () => {
    closed = true;
    for (const next of waiting.splice(0)) next("");
  });
  const ask = (question) => {
    stdout.write(question);
    if (lines.length > 0) return Promise.resolve(lines.shift());
    if (closed) return Promise.resolve("");
    return new Promise((resolve) => waiting.push(resolve));
  };
  console.log(
    "Supabase PetTrack veritabanı şifresi gerekiyor (bir kez). Bilmiyorsanız:\n" +
      "Supabase → PetTrack → Project Settings → Database → Reset database password.",
  );
  for (;;) {
    const password = (await ask("Veritabanı şifresi: ")).trim();
    if (!password) {
      if (closed) {
        console.error("Şifre girilmedi; .env yazılmadı.");
        process.exit(1);
      }
      continue;
    }
    Object.assign(values, urls(password));
    if (skipCheck || (await canConnect(values.DIRECT_URL))) break;
    console.log("  Şifreyi kontrol edip yeniden deneyin.");
  }
  const key = (await ask("Anthropic API anahtarı (isteğe bağlı, Enter ile geçin): ")).trim();
  if (key) values.ANTHROPIC_API_KEY = key;
  rl.close();
}

values.AUTH_SECRET =
  current.AUTH_SECRET && current.AUTH_SECRET.length >= 32
    ? current.AUTH_SECRET
    : randomBytes(32).toString("base64");
if (current.ANTHROPIC_API_KEY && !values.ANTHROPIC_API_KEY) {
  values.ANTHROPIC_API_KEY = current.ANTHROPIC_API_KEY;
}

writeFileSync(ENV_PATH, render(values));
console.log(`.env yazıldı: ${ENV_PATH}`);
console.log("Şimdi: npm run dev");
