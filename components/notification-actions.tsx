"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, MessageCircle, Send } from "lucide-react";
import type { FormState } from "@/lib/action";
import type { AppointmentMessageKind } from "@/lib/whatsapp/messages";
import type { Channel } from "@/lib/messaging/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  kind: AppointmentMessageKind;
  body: string;
  whatsappLink: string | null;
  segments: number | null;
}

interface Props {
  appointmentId: string;
  channel: Channel;
  configured: boolean;
  messages: Message[];
  sendAction: (appointmentId: string, kind: AppointmentMessageKind) => Promise<FormState>;
  logManualAction: (appointmentId: string, kind: AppointmentMessageKind) => Promise<FormState>;
}

export function NotificationActions({
  appointmentId,
  channel,
  configured,
  messages,
  sendAction,
  logManualAction,
}: Props) {
  const t = useTranslations("appointment.notifications");
  const tKind = useTranslations("enum.messageKind");
  const tChannel = useTranslations("enum.messageChannel");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function send(kind: AppointmentMessageKind) {
    startTransition(async () => {
      const result = await sendAction(appointmentId, kind);
      if (result?.error) toast.error(result.error);
      else toast.success(t("messageSent", { channel: tChannel(channel) }));
      router.refresh();
    });
  }

  function logManual(kind: AppointmentMessageKind) {
    startTransition(async () => {
      await logManualAction(appointmentId, kind);
      router.refresh();
    });
  }

  // The escape hatch that works on every channel and every device, and that
  // promises nothing it cannot keep. An `sms:` link was considered and
  // rejected: its body parameter is inconsistent across platforms and does
  // nothing at all in most desktop browsers, which is where clinic staff
  // spend the day, and a button that does nothing reads as a broken app.
  //
  // It logs the send for the same reason the WhatsApp link does: with SMS as
  // the default channel, not logging here would leave a clinic's manual
  // sends entirely unrecorded and every measurement drawn from
  // `message_logs` silently at zero.
  function copy(m: Message) {
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(m.body);
      } catch {
        toast.error(t("copyFailed"));
        return;
      }
      toast.success(t("copied"));
      await logManualAction(appointmentId, m.kind);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <div key={m.kind} className="flex flex-col gap-2 rounded-control border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {tKind(m.kind)}
              {m.segments != null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("segments", { count: m.segments })}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {channel === "WHATSAPP" && m.whatsappLink && (
                <a
                  href={m.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logManual(m.kind)}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                >
                  <MessageCircle />
                  {t("openInWhatsApp")}
                </a>
              )}
              <button
                type="button"
                // `aria-busy` rather than `disabled`, for the reason
                // `submit-button.tsx` carries at length: a control
                // disabled under the user's finger loses focus to
                // `body` and does not get it back. The press is
                // ignored while one is in flight, which is the half
                // of `disabled` that was wanted.
                aria-busy={pending || undefined}
                onClick={() => !pending && copy(m)}
                // The row holds more than one message, so "Copy" alone would
                // not say which one this is.
                aria-label={t("copyMessage", { kind: tKind(m.kind) })}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                <Copy />
                {t("copy")}
              </button>
              {configured && (
                <button
                  type="button"
                  aria-busy={pending || undefined}
                  onClick={() => !pending && send(m.kind)}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  <Send />
                  {t("sendNow", { channel: tChannel(channel) })}
                </button>
              )}
            </div>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{t("preview")}</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-control bg-muted/40 p-3 font-sans text-xs text-foreground">
              {m.body}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
