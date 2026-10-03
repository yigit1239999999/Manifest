import Link from "next/link";
import { PawPrint, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";
import { safeNext } from "@/lib/next-param";

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
export async function MissingLink({
  need,
  next,
  title,
  description,
}: {
  need: "client" | "pet";
  /**
   * What the screen would have said if the chain were whole.
   *
   * Two kinds of place render this, and only one of them has a subject
   * of its own. A `/new` route has nothing to say except why it cannot
   * open: the gate IS the news, and these stay unset there. A list
   * screen is about something -- appointments, invoices, reminders --
   * and when the gate replaces its empty state the screen loses its
   * voice entirely: a vet who came to look around is told only to go
   * and create something else. pm graded all three C for that, and
   * graded `/prescriptions` A for the opposite: it says what lives
   * there and where it comes from, and offers no button at all.
   *
   * So the missing link stays -- it is true, the button is the way out,
   * and `e2e/first-run.spec.ts:201` holds every empty list to naming it
   * -- but it becomes the screen's SECOND sentence rather than its only
   * one. That is why the description is composed here rather than by
   * the caller: a caller that forgot the second half would take the
   * whole reason off the screen, and the guard would be the only thing
   * that noticed. The pair is passed together because a title without
   * its description is the gate again, under a friendlier heading.
   */
  title?: string;
  description?: string;
  /**
   * Where to come back to once the missing link exists.
   *
   * Without it the vet saves the new record, lands on its page, and has
   * to remember the errand they were on -- which on an empty clinic is
   * two manual steps in an eight-screen walk. The value is validated
   * before it decides anything (`lib/next-param.ts`), here and again in
   * the action that redirects, because neither may assume the other
   * looked.
   */
  next?: string;
}) {
  // One async function rather than a wrapper around an async child: a
  // component that returns another component's promise renders as
  // nothing outside a server request, so the version with a helper
  // could not be tested at all -- and this is the screen whose whole
  // job is to say something.
  const variant: {
    icon: typeof Users;
    title: "missingClient" | "missingPet";
    hint: "missingClientHint" | "missingPetHint";
    second: "missingClientSecond" | "missingPetSecond";
    href: string;
    namespace: "client" | "pet";
    permission: Permission;
  } =
    need === "client"
      ? {
          icon: Users,
          title: "missingClient",
          hint: "missingClientHint",
          second: "missingClientSecond",
          href: "/clients/new",
          namespace: "client",
          permission: "clients.write",
        }
      : {
          icon: PawPrint,
          title: "missingPet",
          hint: "missingPetHint",
          second: "missingPetSecond",
          href: "/pets/new",
          namespace: "pet",
          permission: "pets.write",
        };

  const errand = safeNext(next);
  const href = errand
    ? `${variant.href}?next=${encodeURIComponent(errand)}`
    : variant.href;

  const [t, tAction, session] = await Promise.all([
    getTranslations("common"),
    getTranslations(variant.namespace),
    requireSession(),
  ]);
  const Icon = variant.icon;

  return (
    <EmptyState
      icon={Icon}
      title={title ?? t(variant.title)}
      description={
        description ? `${description} ${t(variant.second)}` : t(variant.hint)
      }
      action={
        can(session.user.role, variant.permission) ? (
          <Link href={href} className={buttonVariants()}>
            {tAction("new")}
          </Link>
        ) : undefined
      }
    />
  );
}
