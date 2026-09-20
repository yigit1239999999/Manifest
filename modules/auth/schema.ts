import { z } from "zod";
import { msg, password, requiredEmail, requiredText } from "@/lib/forms";

const trim = z.string().transform((v) => v.trim());

export const signInSchema = z.object({
  email: requiredEmail,
  password: trim.refine(
    (v) => v.length > 0,
    msg("error.form.required", { field: "auth.password" }),
  ),
});

export const signUpSchema = z.object({
  clinicName: requiredText(1, 100, "auth.clinicName"),
  name: requiredText(1, 100, "auth.name"),
  email: requiredEmail,
  password: password(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
