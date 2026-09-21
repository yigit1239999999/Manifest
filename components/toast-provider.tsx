"use client";

import { Toaster as SonnerToaster } from "sonner";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";

export function ToastProvider() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
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
