"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
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
  const [pending, startTransition] = useTransition();

  function send(kind: AppointmentMessageKind) {
    startTransition(async () => {
      const result = await sendAction(appointmentId, kind);
      if (result?.error) toast.error(result.error);
      else toast.success(t("messageSent", { channel: tChannel(channel) }));
    });
  }

  function logManual(kind: AppointmentMessageKind) {
    startTransition(async () => {
      await logManualAction(appointmentId, kind);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <div key={m.kind} className="flex flex-col gap-2 rounded-lg border border-border p-3">
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
              {m.whatsappLink && (
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
              {configured && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => send(m.kind)}
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
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-xs text-foreground">
              {m.body}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
