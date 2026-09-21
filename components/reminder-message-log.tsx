import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";

export interface ReminderMessageEntry {
  status: "SENT" | "FAILED" | "MANUAL";
  createdAt: Date;
  channel: "SMS" | "WHATSAPP";
  /** What was actually sent. The point of the whole fold. */
  body: string;
  /** The number it went to, which is not always the one on file today. */
  recipient: string;
  /** The transport's stable code on a failure, not a sentence. */
  error: string | null;
}

/**
 * What was written, and where it went.
 *
 * `MessageLog` has stored the body and the recipient since the first
 * transport landed and no screen has ever shown either — not this list,
 * not the appointment history. The vet who asked for it put the case
 * plainly: what you hold up fourteen months later, against an owner
 * saying "you never contacted me", is the record WITH its text in it. A
 * date and a status prove that something happened, not what it said.
 *
 * Folded, and closed. The list is a working list and this is evidence,
 * wanted rarely and urgently. Open by default it would push every other
 * row off the screen to answer a question nobody asked today.
 *
 * The number is shown unmasked, and that is a decision rather than an
 * oversight. Masking would not be a privacy measure here: the same
 * number is already printed on the row above, to the same staff, on the
 * same screen. What it would cost is the thing the record is for — a
 * receipt that will not say which number it went to is exactly the
 * receipt that loses an argument, and the number a message went to CAN
 * differ from the one on file now, which is precisely the difference
 * worth seeing.
 *
 * The provider's own code is here rather than on the row, and it stays
 * here. `sender_title_not_registered` is a true thing to keep and a
 * useless thing to read: the row says what happened in words, this says
 * what the gateway called it, for whoever has to phone the gateway.
 */
export async function ReminderMessageLog({
  messages,
}: {
  messages: ReminderMessageEntry[];
}) {
  if (messages.length === 0) return null;
  const [t, tChannel, tStatus, fmt] = await Promise.all([
    getTranslations("reminder.log"),
    getTranslations("enum.messageChannel"),
    getTranslations("enum.messageStatus"),
    getFormatContext(),
  ]);

  return (
    <details className="mt-1.5 text-xs">
      <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
        {t("summary", { count: messages.length })}
      </summary>
      <ul className="mt-2 flex flex-col gap-3 border-s border-border ps-3">
        {messages.map((m, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>{formatDateTime(fmt, m.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span>{tChannel(m.channel)}</span>
              <StatusBadge
                kind="message"
                status={m.status}
                label={tStatus(m.status)}
              />
            </div>
            {/* `whitespace-pre-wrap`: the template has line breaks in it
                and the owner read them, so the record shows them too. */}
            <p className="whitespace-pre-wrap rounded-control bg-muted/40 p-2 text-foreground">
              {m.body}
            </p>
            {/* `+` and nothing else. `MessageLog.recipient` is stored
                in E.164 digits, and pm found it sitting on the same
                screen as the row's `0532 000 00 00` -- the same number
                in two shapes, with the harder-to-read one in the place
                a vet goes to ask "did it reach the right number".

                Grouping it would read better and would be a guess: the
                clinic's calling code can be any of eight here, and
                "+90 532 000 00 00" spacing is wrong for most of them.
                The `+` at least says out loud that this is the
                international form of the number above, which is the
                one thing the two shapes have to agree on. A real
                per-country formatter is worth having and is not this
                commit. */}
            <p className="text-muted-foreground">
              {t("recipient")}: +{m.recipient}
            </p>
            {m.error && (
              <p className="text-muted-foreground">
                {t("providerCode")}: <code>{m.error}</code>
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
