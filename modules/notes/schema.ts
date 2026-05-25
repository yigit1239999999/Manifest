import { z } from "zod";
import { checkbox, optionalText, requiredEnum, requiredText } from "@/lib/forms";

export const NOTE_KINDS = [
  "GENERAL",
  "PHONE_CALL",
  "EMAIL",
  "SMS",
  "INTERNAL",
  "EVENT",
] as const;

export const noteSchema = z.object({
  petId: optionalText(40),
  clientId: optionalText(40),
  kind: requiredEnum(NOTE_KINDS),
  body: requiredText(1, 5000, "İçerik"),
  pinned: checkbox,
});

export type NoteInput = z.infer<typeof noteSchema>;
