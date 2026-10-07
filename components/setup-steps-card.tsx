import Link from "next/link";
import { ArrowRight, MessageSquare, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { SetupStepsHideButton } from "@/components/setup-steps-hide-button";
import { setSetupStepsHiddenAction } from "@/modules/clinics/setup-steps-actions";

/**
 * What comes after the records are in: switch messaging on, bring the
 * team in (pm B14). The first-run screen's two doors lead here.
 *
 * The same `inline` shape as `FirstStepCard` on a working dashboard --
 * a line and a link per step, not a wizard -- so the two read as one
 * family and neither outweighs the day's work under it. Each step
 * leaves the card when it is done; the card leaves when both are, or
 * when the clinic closes it (a practice of one vet will not add a team,
 * and should not be asked every morning).
 */
export async function SetupStepsCard({
  steps,
}: {
  steps: { messaging: boolean; team: boolean };
}) {
  const t = await getTranslations("dashboard.setupSteps");
  const rows = [
    steps.messaging && {
      key: "messaging",
      icon: MessageSquare,
      href: "/settings#notifications",
    },
    steps.team && { key: "team", icon: UserPlus, href: "/staff/new" },
  ].filter(Boolean) as { key: string; icon: typeof MessageSquare; href: string }[];
  if (rows.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <SetupStepsHideButton
          action={setSetupStepsHiddenAction}
          label={t("hide")}
          hiddenLabel={t("hidden")}
          undoLabel={t("undo")}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ key, icon: Icon, href }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex h-full items-start gap-3 rounded-control border border-border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t(`${key}.title`)}</span>
                <span className="text-xs text-muted-foreground">{t(`${key}.hint`)}</span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
