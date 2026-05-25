import { z } from "zod";
import { requiredEmail, requiredText } from "@/lib/forms";

const trim = z.string().transform((v) => v.trim());

export const signInSchema = z.object({
  email: requiredEmail,
  password: trim.refine((v) => v.length > 0, "Şifre gerekli."),
});

export const signUpSchema = z.object({
  clinicName: requiredText(1, 100, "Klinik adı"),
  name: requiredText(1, 100, "Ad"),
  email: requiredEmail,
  password: trim
    .refine((v) => v.length >= 8, "Şifre en az 8 karakter olmalı.")
    .refine((v) => v.length <= 100, "Şifre en fazla 100 karakter olabilir."),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
