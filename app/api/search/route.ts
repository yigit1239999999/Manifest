import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFormatContext } from "@/lib/format-context";
import { formatMoney, petAge } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { ownerLabel } from "@/lib/pet-label";
import { quickSearchClients } from "@/modules/clients/queries";
import { quickSearchPets } from "@/modules/pets/queries";
import { quickSearchInvoices } from "@/modules/invoices/search";

/**
 * The command palette's search: clients, animals and invoices.
 *
 * Rows go out already worded, because the palette is the one place three
 * Zeytins sit side by side and the line that tells them apart -- "Kedi ·
 * 3 yaş · Ayşe Tekin" -- needs the species catalogue, the clinic's
 * locale and today's date, all of which are here (pm C4). A client row
 * carries the phone rather than the e-mail: the phone is what the person
 * at the counter is reading out.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ clients: [], pets: [], invoices: [] });
  }

  const clinicId = session.user.clinicId;
  const canInvoices = can(session.user.role ?? "", "invoices.read");
  const [clients, pets, invoices, fmt, tSpecies, tStatus] = await Promise.all([
    quickSearchClients(clinicId, q),
    quickSearchPets(clinicId, q),
    canInvoices ? quickSearchInvoices(clinicId, q) : Promise.resolve([]),
    getFormatContext(),
    getTranslations("enum.species"),
    getTranslations("enum.invoiceStatus"),
  ]);

  return NextResponse.json({
    clients: clients.items.map((c) => ({
      id: c.id,
      label: ownerLabel(c),
      phone: c.phone ? formatPhone(c.phone) : null,
    })),
    pets: pets.items.map((p) => ({
      id: p.id,
      name: p.name,
      detail: [
        p.customSpecies?.name ?? tSpecies(p.species as never),
        petAge(fmt, p.birthDate),
        ownerLabel(p.owner),
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      detail: [
        ownerLabel(i.client),
        formatMoney(fmt, i.totalCents, i.currency),
        tStatus(i.status as never),
      ].join(" · "),
    })),
  });
}
