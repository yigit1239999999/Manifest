import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listReminders } from "@/modules/reminders/queries";
import { listClients } from "@/modules/clients/queries";
import { listPets } from "@/modules/pets/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ReminderForm } from "@/components/forms/reminder-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export default async function RemindersPage() {
  const session = await requireSession();
  const [t, tType, tStatus, reminders, clients, pets] = await Promise.all([
    getTranslations("reminder"),
    getTranslations("enum.reminderType"),
    getTranslations("enum.reminderStatus"),
    listReminders({ clinicId: session.user.clinicId }),
    listClients({ clinicId: session.user.clinicId }),
    listPets({ clinicId: session.user.clinicId }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderForm
            clients={clients.map((c) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
            }))}
            pets={pets.map((p) => ({
              id: p.id,
              name: p.name,
              ownerId: p.ownerId,
            }))}
          />
        </CardContent>
      </Card>

      {reminders.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("empty")} description="" />
      ) : (
        <ul className="flex flex-col gap-2">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <Badge variant="secondary">
                    {tType(r.type as never)}
                  </Badge>
                  <p className="text-sm font-semibold">{r.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.dueAt)} · {r.client.firstName}{" "}
                  {r.client.lastName}
                  {r.pet ? ` · ${r.pet.name}` : ""}
                </p>
                {r.body && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                )}
              </div>
              <Badge variant="secondary">{tStatus(r.status as never)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
