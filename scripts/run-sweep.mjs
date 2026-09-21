// Runs the reminder sweep and says what it did.
//
//   npm run sweep          -- once
//   npm run sweep:watch    -- every 15 minutes, until Ctrl-C
//
// The sweep is the thing that actually reaches an owner, and until now
// the only way to run it was to curl the cron endpoint with the shared
// secret — so nobody ran it, and "hatırlatmalar ne işe yarıyor" had no
// answer anybody could produce in one command.
//
// NOT read-only, unlike `loop-metrics.mjs` beside it. This is the real
// sweep: it writes `message_logs` rows and moves a sent reminder to
// SENT. With `SMS_PROVIDER=log` nothing leaves the building — the log
// transport prints the message instead of sending it — but the records
// are real, and they are shared. Ask before running it while somebody
// is measuring.
//
// What it prints is the point. A sweep that sends nothing can mean the
// window was empty, or that every owner in it refused, or that the
// clinic has messaging switched off: three different situations, three
// different jobs, and one summary that used to report all of them as
// zero. Every elimination reason is printed on every run, including the
// ones that are zero — a zero that is never named cannot be told apart
// from a zero nobody counted.
//
// Loaded through `jiti` rather than run as plain Node: the sweep lives
// in `modules/notifications/service.ts` and imports half the app by its
// `@/` alias, which plain Node resolves for nothing. `jiti` is already
// in the tree (Next depends on it) and is used here only to import
// TypeScript from a script; nothing in the product loads it.

import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });

const { runReminderSweep, runDeliveryReportSweep, SWEEP_SKIP_REASONS } = await jiti.import(
  "../modules/notifications/service.ts",
);
const { isChannelConfigured } = await jiti.import("../lib/messaging/transports.ts");
const { prisma } = await jiti.import("../lib/prisma.ts");

/**
 * Each reason in the words a vet would use, because the summary is read
 * by whoever is asking why nothing arrived, not by whoever wrote the
 * query. Keyed off the service's own list, so a reason added there and
 * not described here fails loudly instead of printing a bare key.
 */
const REASONS = {
  closed: "durumu kapalı (iptal, gelmedi, tamamlandı; hatırlatma beklemede değil)",
  clientArchived: "müşteri arşivlenmiş",
  noPhone: "telefon numarası yok",
  optedOut: "onay yok (reddetti ya da hiç sorulmadı)",
  petSilenced: "hayvan vefat etmiş ya da arşivlenmiş",
  alreadySent: "zaten gönderilmiş (uygulama ya da elle)",
  attemptsExhausted: "üç kez başarısız, artık denenmiyor",
  coolingOff: "yakın zamanda başarısız, altı saat bekliyor",
  notDue: "saati gelmemiş",
  noRecipient: "numara aranabilir hâle gelmiyor",
};

const missing = SWEEP_SKIP_REASONS.filter((r) => !(r in REASONS));
if (missing.length > 0) {
  console.error(`run-sweep: açıklaması olmayan eleme sebebi: ${missing.join(", ")}`);
  process.exitCode = 1;
}

/** Local wall clock with its offset, the same notation `seed-states.mjs` writes. */
function localStamp(date) {
  const local = date.toLocaleString("sv-SE").slice(0, 16);
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${local}${sign}${pad(minutes / 60)}:${pad(minutes % 60)}`;
}

function printKind(title, window, kind) {
  const skipped = Object.values(kind.skipped).reduce((a, b) => a + b, 0);
  console.log(`\n${title}  (${window})`);
  console.log(`  havuz       ${kind.pool}  — penceredeki bütün kayıtlar, hiçbir kural işlemeden önce`);
  console.log(`  aday        ${kind.candidates}  — süzgeçlerden geçip süpürgenin eline ulaşan`);
  console.log(`  GÖNDERİLDİ  ${kind.sent}`);
  console.log(`  başarısız   ${kind.failed}  — sağlayıcı reddetti, sonraki turda yeniden denenir`);
  console.log(`  kapalı olan klinik  ${kind.clinicsDisabled}  — bu yarı ayarlardan kapatılmış`);
  console.log(`  elenenler   ${skipped}`);
  for (const reason of SWEEP_SKIP_REASONS) {
    console.log(`    ${String(kind.skipped[reason]).padStart(5)}  ${REASONS[reason]}`);
  }
  // The invariant that makes the list readable: every row in the window
  // is in exactly one line above. If it ever fails, the census and the
  // candidate query have drifted apart and no number here can be
  // trusted -- which is worth saying out loud rather than leaving to
  // whoever adds up the columns.
  const accounted = kind.sent + kind.failed + skipped;
  if (accounted !== kind.pool) {
    console.log(`  UYUŞMUYOR   havuz ${kind.pool}, hesaba katılan ${accounted} — sayım ile aday sorgusu ayrışmış`);
  }
}

async function sweepOnce() {
  const startedAt = Date.now();
  const summary = await runReminderSweep();
  const ms = Date.now() - startedAt;

  console.log(`SÜPÜRGE  ${localStamp(new Date())}  ·  ${ms} ms`);
  console.log(
    `KANAL    SMS ${isChannelConfigured("SMS") ? `kurulu (${process.env.SMS_PROVIDER})` : "kurulu değil"}` +
      ` · WhatsApp ${isChannelConfigured("WHATSAPP") ? "kurulu" : "kurulu değil"}`,
  );
  if (process.env.SMS_PROVIDER === "log") {
    console.log(`         log taşıyıcısı: mesaj dışarı ÇIKMAZ, yalnız kayıt yazılır`);
  }
  console.log(
    `KLİNİK   toplam ${summary.clinics.total}` +
      ` · süpürülen ${summary.clinics.swept}` +
      ` · mesajlaşma kapalı ${summary.clinics.messagingOff}` +
      ` · kanal kurulu değil ${summary.clinics.channelNotConfigured}`,
  );
  if (!summary.configured) {
    // The one zero that is not about the data at all, and the one somebody
    // reading "0 gönderildi" is most likely to misread as a defect.
    console.log(`         hiçbir klinik süpürülmedi: gönderilecek aday aranmadı bile`);
  }

  printKind("RANDEVU HATIRLATMASI", "şimdi → +8 gün", summary.appointments);
  printKind("HATIRLATMA BİLDİRİMİ", "dün → +gün sayısı", summary.reminders);

  // Sending and delivery are two different questions and the summary
  // keeps them apart on the page as well: "gönderildi" above is what
  // the operator accepted, everything below is what became of it.
  const d = await runDeliveryReportSweep();
  console.log(`\nTESLİM RAPORU`);
  console.log(`  açık        ${d.open}  — kabul edilmiş, âkıbeti henüz bilinmeyen mesaj`);
  console.log(`  soruldu     ${d.asked}  — bu turda sağlayıcıya sorulan (tur başına en fazla 50)`);
  console.log(`  ULAŞTI      ${d.delivered}`);
  console.log(`  ulaşmadı    ${d.undelivered}`);
  console.log(`  süresi doldu ${d.expired}`);
  console.log(`  beklemede   ${d.pending}  — sorduk, sağlayıcı henüz bilmiyor`);
  console.log(`  cevapsız    ${d.silent}  — sorduk, sağlayıcı bu mesaj hakkında hiçbir şey demedi`);
  if (d.open > d.asked) {
    // The one number that says the schedule is not keeping up, and it
    // cannot be read off `asked` alone.
    console.log(`  BİRİKME     ${d.open - d.asked} mesaj bu turda sorulamadı`);
  }
}

/**
 * `--every <dakika>`: the local stand-in for the scheduler.
 *
 * In production a free external service calls the cron endpoint every
 * fifteen minutes (see DEPLOY.md). Nothing calls it on a laptop, which
 * is how "the reminder never went out" gets discovered in production
 * instead of here -- the exact defect this whole round was about.
 *
 * Deliberately in the foreground, one process, printing each run. A
 * background daemon would reproduce the original problem in a new
 * place: something that is either running or not and no way to tell by
 * looking. This one is visible while it runs and gone when it stops.
 */
const everyIndex = process.argv.indexOf("--every");
const everyMinutes = everyIndex === -1 ? null : Number(process.argv[everyIndex + 1]);
if (everyIndex !== -1 && !(everyMinutes > 0)) {
  console.error("run-sweep: --every <dakika> pozitif bir sayı olmalı");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (everyMinutes === null) {
  await sweepOnce();
} else {
  console.log(
    `SÜPÜRGE DÖNGÜSÜ  her ${everyMinutes} dakikada bir · durdurmak için Ctrl-C\n`,
  );
  // No catch that swallows: a sweep that starts throwing every run must
  // stop the loop and say so, not scroll past in a terminal nobody is
  // reading. The scheduler in production has the same property -- a 500
  // is visible where a caught error is not.
  for (;;) {
    await sweepOnce();
    console.log("");
    await sleep(everyMinutes * 60_000);
  }
}

await prisma.$disconnect();
