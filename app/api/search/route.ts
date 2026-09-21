import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { quickSearchClients } from "@/modules/clients/queries";
import { quickSearchPets } from "@/modules/pets/queries";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ clients: [], pets: [] });
  }

  const [clients, pets] = await Promise.all([
    quickSearchClients(session.user.clinicId, q),
    quickSearchPets(session.user.clinicId, q),
  ]);

  // Only the rows. Both queries now also report whether they truncated,
  // which the pickers need and the palette does not use yet: saying
  // "there is more" here would be a new sentence on a surface nobody
  // has designed it for. Deliberately unchanged behaviour, not an
  // oversight — the pair is available the day the palette wants it.
  return NextResponse.json({ clients: clients.items, pets: pets.items });
}
