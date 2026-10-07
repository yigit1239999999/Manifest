import Link from "next/link";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/card";
import {
  CalendarClock,
  ClipboardList,
  PhoneOff,
  PawPrint,
  Pill,
  Receipt,
  Stethoscope,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { telHref } from "@/lib/phone";
import { dashboardInsights } from "@/modules/dashboard/queries";
import { blockedReminders } from "@/modules/notifications/queries";
import { unreadDiagnostics } from "@/modules/diagnostics/queries";
import { getClinicCurrency, getClinicSettings } from "@/modules/clinics/queries";
import { setVaccinationDueDismissedAction } from "@/modules/vaccinations/actions";
import { VaccinationDueDismissButton } from "@/components/vaccination-due-dismiss-button";
import { FirstStepCard } from "@/components/first-step-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColumnBars, HorizontalBars } from "@/components/charts";
import {
  currencySymbol,
  firstName,
  formatDate,
  formatDateTime,
  formatMoney,
  intlLocale,
} from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";
import { newAppointmentHref } from "@/modules/appointments/prefill";

export default async function DashboardPage() {
  const session = await requireSession();
  const [
    t,
    tCommon,
    tSpecies,
    tVisitType,
    tDiag,
    tDiagType,
    insights,
    blocked,
    unread,
    clinicSettings,
    currency,
    fmt,
  ] = await Promise.all([
      getTranslations("dashboard"),
      getTranslations("common"),
      getTranslations("enum.species"),
      getTranslations("enum.visitType"),
      getTranslations("diagnostic"),
      getTranslations("enum.diagnosticType"),
      dashboardInsights(session.user.clinicId),
      // Only the number here; the rows live on the tab this card sends
      // the reader to.
      blockedReminders(session.user.clinicId, { take: 0 }),
      // Rows, not just a number: one link cannot take a vet to three
      // results, and the job finishes where each result's text is.
      unreadDiagnostics(session.user.clinicId),
      // Only the first-run header says the clinic's name; the query is
      // request-cached and the layout has already asked for it.
      getClinicSettings(session.user.clinicId),
      getClinicCurrency(session.user.clinicId),
      getFormatContext(),
    ]);

  const weekFmt = new Intl.DateTimeFormat(intlLocale(fmt.locale), {
    day: "numeric",
    month: "short",
    timeZone: fmt.timeZone,
  });
  const monthFmt = new Intl.DateTimeFormat(intlLocale(fmt.locale), {
    month: "short",
    timeZone: fmt.timeZone,
  });

  const metrics = [
    {
      key: "clients" as const,
      icon: Users,
      value: insights.counts.clients,
      href: "/clients",
      hint: undefined as string | undefined,
    },
    {
      key: "pets" as const,
      icon: PawPrint,
      value: insights.counts.pets,
      href: "/pets",
      hint: undefined,
    },
    {
      key: "visits" as const,
      icon: Stethoscope,
      value: insights.counts.visits,
      href: "/visits",
      hint: undefined,
    },
    {
      key: "upcomingAppointments" as const,
      icon: CalendarClock,
      value: insights.counts.upcomingAppointments,
      href: "/appointments",
      hint: undefined,
    },
    {
      key: "activePrescriptions" as const,
      icon: Pill,
      value: insights.counts.activePrescriptions,
      href: "/prescriptions",
      hint: undefined,
    },
    {
      key: "outstandingInvoices" as const,
      icon: Receipt,
      value: insights.counts.outstandingInvoices,
      // The list of what is owed, not every invoice ever raised.
      href: "/invoices?status=unpaid",
      // The count is currency-agnostic and stays whole. The amount beside
      // it is only what is owed in the clinic's own currency — adding
      // dollars to lira and printing one symbol was the defect — so when
      // there is debt in others, the hint says they exist. Not how much:
      // the size lives under the revenue chart, and this card has room for
      // the fact. Naming a screen to go and read it would be worse, since
      // `/invoices` has no total to read (TEAM.md #33).
      hint:
        formatMoney(fmt, insights.outstandingInvoiceCents, currency) +
        (insights.outstandingOtherCurrencies.length > 0
          ? ` · ${t("chart.otherCurrencyCount", {
              count: insights.outstandingOtherCurrencies.length,
            })}`
          : "") +
        // Not owed, so not in the figure; but a draft nobody sent is money
        // nobody asks for, and this is where the evening check looks.
        (insights.draftInvoiceCount > 0
          ? ` · ${t("draftInvoices", { count: insights.draftInvoiceCount })}`
          : ""),
    },
    {
      key: "openReminders" as const,
      icon: ClipboardList,
      value: insights.counts.openReminders,
      href: "/reminders",
      hint: undefined,
    },
    // Its own card rather than a line under the one above, and the
    // reason is not the wording -- it is that the other card's
    // destination was conditional on data. The same card sent a vet to
    // two different places on two mornings depending on whether the
    // hint was there, and a heading cannot fix that: the day the hint
    // disappears the heading is wrong again (ux).
    //
    // Split, every card's three parts describe one set: the title, the
    // number and where it goes. And the number that is worth acting on
    // stops being a 12px grey footnote under a volume count that is
    // not -- it gets the same weight as the others and a whole card as
    // its target.
    //
    // Titled exactly as the tab it opens, so the word a vet reads here
    // is the word they land on.
    //
    // Absent rather than zero, which is the same call the overdue
    // vaccination card already makes: a card saying nothing is wrong
    // takes space every morning to say it on the days it matters
    // least.
    ...(blocked.unreachedTotal
      ? [
          {
            key: "unreachedReminders" as const,
            icon: PhoneOff,
            value: blocked.unreachedTotal,
            href: "/reminders?status=blocked&group=unreached",
            hint: undefined,
          },
        ]
      : []),
  ];

  const visitsLast12WeeksData = insights.visitsLast12Weeks.map((w) => ({
    label: weekFmt.format(w.weekStart),
    value: w.count,
  }));

  // Read once: the empty sentence and the footnote have to agree about
  // whether there is money elsewhere, and two reads of the same thing is
  // how they stop agreeing.
  const revenueOtherCurrencies = insights.revenueOtherCurrencies;

  const revenueLast6MonthsData = insights.revenueLast6Months.map((m) => ({
    label: monthFmt.format(m.monthStart),
    value: m.cents,
    display: formatMoney(fmt, m.cents, currency),
  }));

  // Which link of the mandatory chain is missing, or neither. Read from
  // the two counts the metric cards are already printing, so a clinic
  // that is past this asks the database nothing extra to be told
  // nothing. Clients first: an animal cannot be registered without an
  // owner, so a clinic with neither has exactly one place to start and
  // being offered the second would be a dead end.
  const firstStep =
    insights.counts.clients === 0
      ? ("client" as const)
      : insights.counts.pets === 0
        ? ("pet" as const)
        : undefined;

  const speciesBars = insights.petsBySpecies.map((g) => ({
    label: tSpecies(g.species as never),
    value: g.count,
  }));

  const visitTypeBars = insights.visitsByType.map((g) => ({
    label: tVisitType(g.type as never),
    value: g.count,
  }));

  // A clinic with nothing in it gets a different page, not the same
  // page full of zeroes. Seven noughts and a column of "nothing yet"
  // sentences is a dashboard that works perfectly and says only that
  // you have not started -- read on the evening somebody has just
  // finished setting the thing up.
  //
  // Read from counts the page already has, so a clinic past this asks
  // the database nothing extra to be told nothing.
  const clinicName = clinicSettings?.name ?? "";

  const firstRun =
    insights.counts.clients === 0 &&
    insights.counts.pets === 0 &&
    insights.counts.visits === 0;

  // The pair, because a row of a spreadsheet is a client AND an animal:
  // `modules/import/request.ts` refuses anyone holding one without the
  // other, and the rail asks for the same two. A role that cannot import
  // is shown nothing rather than a sentence with no way out of it -- the
  // card is already saying "your clinic administrator can add the first
  // client and animal" in that case, and a second silent line would be
  // the same fact twice.
  //
  // Reception holds this permission and that is not incidental: the
  // spreadsheet is usually on their machine.
  const canImport =
    can(session.user.role, "clients.write") &&
    can(session.user.role, "pets.write");
  const canBook = can(session.user.role, "appointments.write");

  if (firstRun) {
    return (
      // Placed rather than stacked, and only on this branch.
      //
      // With the example block gone the screen held one greeting and
      // one card in the top-left corner of roughly 976x800, and ui read
      // it as a page whose content had been cut off early rather than a
      // page with one thing on it. The emptiness is not filled -- there
      // is nothing honest to fill it with -- it is made deliberate: a
      // single object placed in a large field reads as "this is the one
      // job", where the same object parked in a corner reads as "the
      // rest is missing".
      //
      // Optical rather than true centre: `pb-16` lifts the block above
      // the middle, which is where the eye expects a subject to sit.
      // `min-h` is read off the viewport minus the top bar and this
      // element's own padding, so it claims the field it centres in
      // without inventing scroll.
      //
      // The column is capped to the card's own width -- the same
      // token, so the two cannot drift apart -- and that gives the
      // greeting and the card one left edge and one right edge. Two
      // blocks of different widths centred separately are each centred
      // and together look misaligned.
      //
      // Only here. Every other dashboard flows from the top, which is
      // right when there is something to read in order, and that branch
      // has its own test saying so.
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center pb-16">
        <div className="flex w-full max-w-lg flex-col gap-8">
          {/* Not `subtitle` ("today's summary"), which is a lie on day
              zero. The key stays for the other states.

              `readyFor` lost its second sentence and kept its first.
              It used to read "... is ready. The panel starts filling
              with your first record", and that second half was one side
              of a repetition: the example block underneath said the same
              thing in its own words. With the block gone it would have
              been the only line left describing what WILL happen, on a
              screen whose job is to ask for something.

              The first half stays on composition, and the reason it was
              nearly kept for is worth recording because it was checked
              and found false: it is NOT the only place the clinic's name
              appears -- `topbar.tsx` draws it on every screen. What it
              does is finish the greeting. Without it the header is a
              lone "Hello <name>" over a sparse screen, and the card
              below is left carrying the page by itself; ui read that on
              screen rather than arguing it.

              Same key, no new one, and `PageHeader` is untouched. */}
          <PageHeader
            title={t("greeting", { name: firstName(session.user.name ?? "") })}
            description={t("readyFor", { clinic: clinicName })}
          />

          {/* The one fully present thing on the screen: full contrast,
              its own shadow. The focus is built by holding everything
              else back rather than by making this bigger.

              `visit`, not `client`, and the difference is the whole
              first-run idea: a clinic with nothing at all is asked for
              the thing it came to do, and the owner and animal it needs
              get made on the way there. The card falls back to the
              client ask by itself for anyone who cannot write a visit. */}
          <FirstStepCard need="visit" size="page" />

          {/* The other way to do the SAME job, and that is the whole of
              what it is allowed to be.

              `first-step-card.tsx` says the card has exactly two states and
              that a third line would turn it into a setup wizard, naming
              the shape it would take: "now switch on reminders", "now add
              your staff". A spreadsheet is not one of those. It is not new
              work -- it is the work the card is already asking for,
              arriving by the door of somebody who has the records already
              (ux). So the rule this screen now holds is narrower than "at
              most three blocks": there may be one alternative, and it may
              only lead where the ask leads. `first-run-screen.test.ts`
              checks the destination for that reason.

              A footnote, not a second invitation. The card keeps the
              weight: no emphasis here, and the sentence is the vet's
              choice to ignore. The whole of it is the link rather than a
              word inside it -- with the emphasis gone, a coloured phrase
              in a muted line would leave COLOUR as the only thing saying
              it can be clicked, and the underline only arrives on hover
              (ux). `sign-up-form.tsx` already writes it this way.

              Not centred, though the pattern it copies is: the column is
              one `max-w-lg` box so the greeting and the card share a left
              edge, and a centred third line puts a second alignment on a
              screen that has one.

              Only while the clinic is empty. The first-run screen stops
              being the first-run screen the evening the first visit is
              written, which is exactly why `/import` is in the sidebar as
              well -- the second spreadsheet arrives months later, and a
              door that exists only on day one is shut by the end of it. */}
          {canImport && (
            <p className="text-sm text-muted-foreground">
              <Link href="/import" className="text-primary hover:underline">
                {t("importInvite")}
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("greeting", { name: firstName(session.user.name ?? "") })}
        description={t("subtitle")}
      />

      {firstStep && <FirstStepCard need={firstStep} size="inline" />}

      {/* Two across on a phone: eight full-width figures took ~600px
          before anything a vet acts on. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map(({ key, icon: Icon, value, href, hint }) => (
          <Link
            key={key}
            href={href}
            className={cn(surface, "p-4 transition-colors hover:border-primary/30")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`metrics.${key}` as never)}
              </span>
              <Icon className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
            </div>
            {/* `tabular-nums` here and not on each card: six cards sit in
                one grid and their figures are read across as much as down.
                Proportional digits give "1" a narrower column than "8", so
                the six numbers start at six slightly different places. */}
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
            {hint && (
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {hint}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* `[&>*]:min-w-0`, the same fix as the four detail pages in
          `462af2e` and found the same way — by measuring, not by
          reading. A grid item's `min-width` is `auto`, so it refuses
          to be narrower than its own min-content, and the card grew
          to 450px inside a 294px column: pm measured 140px of
          sideways page scroll at 390px.

          Only when the chart has bars to draw. On an empty clinic
          the card says "no visits yet" and everything fits, so a
          sweep signing up a fresh clinic reports this route clean —
          which is exactly what pm's did, on the same build, minutes
          apart from the run that found it. */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("sections.upcomingAppointments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.upcomingAppointments.length === 0 ? (
              <EmptyState size="inline" title={t("empty.appointments")} />
            ) : (
              <ul className="-mx-2 flex flex-col gap-1">
                {insights.upcomingAppointments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/appointments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-control px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {a.pet.name} · {ownerLabel(a.client)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(fmt, a.startsAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.recentVisits")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.recentVisits.length === 0 ? (
              <EmptyState size="inline" title={t("empty.visits")} />
            ) : (
              <ul className="-mx-2 flex flex-col gap-1">
                {insights.recentVisits.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/visits/${v.id}`}
                      className="flex items-center justify-between gap-3 rounded-control px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">
                          {v.pet.name} · {ownerLabel(v.client)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(fmt, v.visitedAt)} · {tVisitType(v.type)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* A result nobody has read is the only thing on this page
            that can cost an animal rather than a morning, so it goes
            above the vaccination backlog.

            Rows and not a single number, because one link cannot take
            a vet to three results and the job ends where each
            result's text is -- this card carries them there and the
            button is waiting when they arrive.

            Absent at zero, and value drew the line finer than that:
            no "everything has been read" sentence either. The vet
            said they would like one and the answer is still no. A
            reassurance we print is a claim we have to keep being
            right about; something never asserted cannot be wrong. */}
        {unread.total > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{tDiag("sectionUnread")}</CardTitle>
              {/* The total, not the row count: the list is capped, and
                  "three of three" and "three of forty" are different
                  mornings. */}
              <p className="text-sm text-muted-foreground">
                {tDiag("unreadCount", { count: unread.total })}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="-mx-2 flex flex-col gap-1">
                {unread.items.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-control px-2 py-2"
                  >
                    <span className="text-sm font-medium">
                      <Link
                        href={`/pets/${d.pet.id}`}
                        className="hover:underline"
                      >
                        {d.pet.name}
                      </Link>{" "}
                      · {d.name ?? tDiagType(d.type as never)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(fmt, d.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Only when there is something overdue. A card that says
            "nothing is overdue" every day takes a place on the
            dashboard to speak on the days it is least needed, and
            teaches the eye to skip the place where the bad news
            appears. Above the upcoming card on purpose: a backlog is
            read before a plan. */}
        {(insights.overdueVaccinationCount > 0 || insights.overdueOlderVaccinationCount > 0) && (
          <Card id="overdue-vaccinations" className="scroll-mt-20 lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("sections.overdueVaccinations")}</CardTitle>
              {/* The count, not the row count: the list shows five and
                  "five of five" and "five of forty" are different
                  mornings. */}
              <p className="text-sm text-muted-foreground">
                {t("overdueVaccinationsCount", { count: insights.overdueVaccinationCount })}
              </p>
              {insights.overdueOlderVaccinationCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("overdueVaccinationsOlder", { count: insights.overdueOlderVaccinationCount })}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <ul className="-mx-2 flex flex-col gap-1">
                {insights.overdueVaccinations.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-control px-2 py-2"
                  >
                    {/* The animal is a link for the same reason it is one on a
                        reminder row: somebody reading which vaccinations
                        are overdue wants to go to the animal, and the card
                        was making them find it by hand. Half of what this
                        card is for is getting them there.

                        Both lists on this page, not just the one that was
                        reported: the same gap, and one linked card beside
                        one unlinked card is a worse answer than neither. */}
                    <span className="text-sm font-medium">
                      <Link href={`/pets/${v.pet.id}`} className="hover:underline">
                        {v.pet.name}
                      </Link>{" "}
                      · {v.name}
                    </span>
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(fmt, v.nextDueAt)}
                      </span>
                      {/* The two things an overdue line leads to: ringing
                          the owner and booking the animal in. They used
                          to be two pages away. */}
                      {telHref(v.pet.owner?.phone) && (
                        <a
                          href={telHref(v.pet.owner?.phone) ?? undefined}
                          className="whitespace-nowrap text-xs text-muted-foreground hover:underline"
                        >
                          {v.pet.owner?.phone}
                        </a>
                      )}
                      {/* Booked as the vaccine it is for. No day: it
                          is already overdue, so the form offers the
                          next slot the clinic is open. */}
                      {canBook && (
                        <Link
                          href={newAppointmentHref({
                            petId: v.pet.id,
                            type: "VACCINATION",
                            reason: v.name,
                          })}
                          className="whitespace-nowrap text-xs font-medium text-primary hover:underline"
                        >
                          {t("overdueVaccinationsBook")}
                        </Link>
                      )}
                      <VaccinationDueDismissButton
                        action={setVaccinationDueDismissedAction.bind(null, v.id)}
                        label={t("overdueVaccinationsDismiss")}
                        // `actionFor`, the same pattern every named row
                        // action on `/reminders` uses -- "Close: Zeytin ·
                        // Karma aşı". Ten rows carry ten buttons reading
                        // "Close", and by voice they are one button ten
                        // times over unless the row is in the name.
                        //
                        // It replaces a key of its own, which had put the
                        // word "aşı" after a vaccine name that already
                        // ended in it. Building the sentence out of the
                        // shared pattern instead of writing a new one
                        // also means no new place for a Turkish suffix to
                        // go wrong: `actionFor` joins with a colon and
                        // inflects nothing.
                        name={tCommon("actionFor", {
                          action: t("overdueVaccinationsDismiss"),
                          subject: `${v.pet.name} · ${v.name}`,
                        })}
                        undoLabel={t("overdueVaccinationsUndo")}
                        undoneLabel={t("overdueVaccinationsDismissed")}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card id="upcoming-vaccinations" className="scroll-mt-20 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("sections.upcomingVaccinations")}</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.upcomingVaccinations.length === 0 ? (
              <EmptyState size="inline" title={t("empty.vaccinations")} />
            ) : (
              <ul className="-mx-2 flex flex-col gap-1">
                {insights.upcomingVaccinations.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-control px-2 py-2"
                  >
                    {/* Not `v.pet?.name ?? "?"`. `Vaccination.petId` is
                        non-null in the schema and the query includes the
                        relation, so the guard defended a case that cannot
                        happen — and printed a made-up "?" for it, which is
                        the thing TEAM.md #21 is about. ux read the `?.` as
                        evidence the field was nullable; defensive code had
                        become the documentation. */}
                    <span className="text-sm font-medium">
                      <Link href={`/pets/${v.pet.id}`} className="hover:underline">
                        {v.pet.name}
                      </Link>{" "}
                      · {v.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(fmt, v.nextDueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* The work comes first: what is booked, what was seen, what is
            unread and what is overdue. Charts describe the clinic and are
            read on a quiet afternoon, so they follow (ux measured the
            overdue list at y≈1475 on a 900px screen behind them). */}
        <Card>
          <CardHeader>
            <CardTitle>{t("sections.visitsLast12Weeks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnBars
              data={visitsLast12WeeksData}
              emptyLabel={t("empty.visits")}
              partialLast={{
                note: t("chart.partialPeriod"),
                inProgress: t("chart.inProgress"),
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.revenueLast6Months")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnBars
              data={revenueLast6MonthsData}
              // Two different pieces of news, and they were one: "nothing
              // was paid" and "nothing was paid in lira". The second is
              // what a clinic with four paid dollar invoices was being
              // told, and it sends a vet after money that is already
              // collected. Lists learned this distinction two releases
              // ago (`empty` against `emptyFiltered`); the chart had one
              // empty sentence and a filter nobody had told it about
              // (TEAM.md #19).
              emptyLabel={
                revenueOtherCurrencies.length > 0
                  ? t("empty.revenueCurrency", {
                      // The symbol, not the ISO code. ux measured the card
                      // saying "no invoices paid in TRY" directly above
                      // "$11,595.67" — two ways of naming money in one
                      // card, and the rest of the panel uses symbols.
                      // Turkish does not call it TRY either; a vet says
                      // TL. Read from the same formatter the amounts use,
                      // so the next currency arrives in one place.
                      currency: currencySymbol(fmt, currency),
                    })
                  : t("empty.revenue")
              }
              formatValue={(v) => formatMoney(fmt, v, currency)}
              partialLast={{
                note: t("chart.partialPeriod"),
                inProgress: t("chart.inProgress"),
              }}
              // What the chart cannot show, said in the chart's own card
              // and in its accessible name. The bars are only the clinic's
              // own currency, because adding dollars to lira and printing
              // one symbol is a number that exists nowhere; the rest is
              // reported at its real size, per currency, because "4
              // invoices elsewhere" does not say whether the chart is
              // missing pocket change or the entire total. In the case
              // that found this, it was the entire total.
              footnote={
                revenueOtherCurrencies.length > 0
                  ? revenueOtherCurrencies
                      .map((m) =>
                        t("chart.otherCurrency", {
                          amount: formatMoney(fmt, m.cents, m.currency),
                          count: m.invoices,
                        }),
                      )
                      .join(" · ")
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.petsBySpecies")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Counts animals, not visits: `modules/dashboard/queries.ts`
                groups by pet. It said "no visits yet" to a clinic with a
                hundred animals and no visits on the books. */}
            <HorizontalBars data={speciesBars} emptyLabel={t("empty.pets")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.visitsByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={visitTypeBars} emptyLabel={t("empty.visits")} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
