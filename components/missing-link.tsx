import Link from "next/link";
import { PawPrint, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";

// A clinic's records hang off a chain: client → pet → everything else.
// Four `/new` routes sit further down that chain than a fresh database
// reaches, and three of them used to open a form with an empty picker and
// say nothing about why. An empty picker asks the reader to guess which
// link is missing, on the screen where their hands are full.
//
// `EmptyState`'s `page` size is the right frame: this is the whole area the
// form would have filled, not a section inside it. What it does not carry is
// the *reason*, so the description names the missing link and the action
// goes straight to the route that creates it.
//
// `need` is the missing link, not the route asking for it: `/invoices/new`
// needs a client and no animal, while `/appointments/new` and `/visits/new`
// need an animal. Naming the wrong link would send the vet to the wrong form
// and leave them exactly as stuck.
//
// The sentence stays for everyone; only the button is conditional. A
// technician can open `/appointments` and `/visits` and finds them empty for
// exactly the reason written here -- so the explanation is as true for them
// as for anyone, and removing it would leave the emptiest screen in the
// product saying nothing. What they cannot do is create the missing link:
// they hold neither `clients.write` nor `pets.write`, and `/pets/new` answers
// them with `ForbiddenState`. Offering a button the server will refuse is
// worse than offering none.
//
// The `/new` routes were safe already, because each checks its own
// permission before rendering anything. The gap was the list screens, which
// devui-firstrun found while wiring them: the same component, reached from a
// place with a wider audience.
//
// `FirstStepCard` makes the opposite choice on the dashboard -- absent
// entirely without the permission -- and the difference is the surface. A
// dashboard row with nothing to do is noise on a page of other things; this
// is the whole screen somebody has just walked into, and the reason they are
// stuck is the one thing worth saying there.
export async function MissingLink({ need }: { need: "client" | "pet" }) {
  // One async function rather than a wrapper around an async child: a
  // component that returns another component's promise renders as
  // nothing outside a server request, so the version with a helper
  // could not be tested at all -- and this is the screen whose whole
  // job is to say something.
  const variant: {
    icon: typeof Users;
    title: "missingClient" | "missingPet";
    hint: "missingClientHint" | "missingPetHint";
    href: string;
    namespace: "client" | "pet";
    permission: Permission;
  } =
    need === "client"
      ? {
          icon: Users,
          title: "missingClient",
          hint: "missingClientHint",
          href: "/clients/new",
          namespace: "client",
          permission: "clients.write",
        }
      : {
          icon: PawPrint,
          title: "missingPet",
          hint: "missingPetHint",
          href: "/pets/new",
          namespace: "pet",
          permission: "pets.write",
        };

  const [t, tAction, session] = await Promise.all([
    getTranslations("common"),
    getTranslations(variant.namespace),
    requireSession(),
  ]);
  const Icon = variant.icon;

  return (
    <EmptyState
      icon={Icon}
      title={t(variant.title)}
      description={t(variant.hint)}
      action={
        can(session.user.role, variant.permission) ? (
          <Link href={variant.href} className={buttonVariants()}>
            {tAction("new")}
          </Link>
        ) : undefined
      }
    />
  );
}
