import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "@/components/forms/sign-up-form";

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("createClinicAccount")}</CardTitle>
        <CardDescription>{t("signUp")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
