// The message a clinic sends an owner whose animal is due a vaccination,
// written once per OWNER rather than once per row: an owner with two cats
// both due gets one message naming both, not two that arrive a second
// apart and read like a machine.
//
// Pure, so the copy button and its test share it. The clinic's own phone
// is in the text because the vet asked for it ("mesajda klinik telefonu
// yok"): a message saying "call us" without a number sends the owner
// looking for one.

export type RecallMessageLocale = "tr" | "en";

export interface RecallItem {
  ownerId: string;
  ownerName: string;
  ownerPhone: string | null;
  ownerLocale: RecallMessageLocale;
  petName: string;
  vaccine: string;
  dueAt: Date;
}

export interface RecallClinic {
  name: string;
  phone?: string | null;
  timezone: string;
}

function day(date: Date, locale: RecallMessageLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** One owner's items, grouped by animal, as the lines of the message. */
function petLines(items: RecallItem[], clinic: RecallClinic): string[] {
  const byPet = new Map<string, RecallItem[]>();
  for (const item of items) {
    const list = byPet.get(item.petName) ?? [];
    list.push(item);
    byPet.set(item.petName, list);
  }
  return [...byPet.entries()].map(
    ([pet, list]) =>
      `• ${pet}: ${list
        .map((i) => `${i.vaccine} (${day(i.dueAt, i.ownerLocale, clinic.timezone)})`)
        .join(", ")}`,
  );
}

export function composeRecallMessage(
  items: RecallItem[],
  clinic: RecallClinic,
  now: Date = new Date(),
): string {
  const first = items[0];
  if (!first) return "";
  const locale = first.ownerLocale;
  const overdue = items.some((i) => i.dueAt.getTime() < now.getTime());
  const phone = clinic.phone?.trim();
  const lines = petLines(items, clinic);
  const many = items.length > 1;

  if (locale === "tr") {
    return [
      `Sayın ${first.ownerName},`,
      "",
      `Aşağıdaki ${many ? "aşıların" : "aşının"} zamanı ${overdue ? "geldi" : "yaklaşıyor"}:`,
      ...lines,
      "",
      `Randevu için ${phone ? `${phone} numarasından ` : ""}bize ulaşabilir ya da bu mesaja yanıt verebilirsiniz.`,
      "",
      "Sağlıklı günler dileriz.",
      clinic.name,
    ].join("\n");
  }
  return [
    `Dear ${first.ownerName},`,
    "",
    `The following ${many ? "vaccinations are" : "vaccination is"} ${overdue ? "due" : "coming up"}:`,
    ...lines,
    "",
    `To book, call us${phone ? ` on ${phone}` : ""} or reply to this message.`,
    "",
    "Kind regards,",
    clinic.name,
  ].join("\n");
}

/**
 * Every owner's message, one after another, each headed by who it is for
 * and the number to send it to, so the list can be worked down in
 * WhatsApp one chat at a time. Owners appear in the order the list shows
 * them.
 */
export function composeRecallBatch(
  items: RecallItem[],
  clinic: RecallClinic,
  now: Date = new Date(),
): { text: string; owners: number } {
  const byOwner = new Map<string, RecallItem[]>();
  for (const item of items) {
    const list = byOwner.get(item.ownerId) ?? [];
    list.push(item);
    byOwner.set(item.ownerId, list);
  }
  const blocks = [...byOwner.values()].map((list) => {
    const head = `=== ${list[0].ownerName}${list[0].ownerPhone ? ` · ${list[0].ownerPhone}` : ""} ===`;
    return `${head}\n${composeRecallMessage(list, clinic, now)}`;
  });
  return { text: blocks.join("\n\n"), owners: byOwner.size };
}
