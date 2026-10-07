"use client";

import { useTranslations } from "next-intl";
import { Toaster as SonnerToaster } from "sonner";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";

export function ToastProvider() {
  // Sonner names its region and close button in English by default, and a
  // screen reader read "Close toast" and "Notifications alt+T" on every
  // Turkish screen (QA).
  const t = useTranslations("common");
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      containerAriaLabel={t("notificationsRegion")}
      toastOptions={{
        closeButtonAriaLabel: t("close"),
        classNames: {
          toast:
            cn(surface, "text-card-foreground shadow-lg"),
          title: "text-sm font-semibold",
          description: "text-xs text-muted-foreground",
        },
      }}
    />
  );
}
