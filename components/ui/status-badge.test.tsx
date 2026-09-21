// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AppointmentStatus,
  InvoiceStatus,
  MessageStatus,
  PrescriptionStatus,
  ReminderStatus,
} from "@/generated/prisma/enums";
import {
  StatusBadge,
  statusTone,
  type StatusKind,
} from "@/components/ui/status-badge";

const classesOf = (c: HTMLElement) => c.firstElementChild!.className;

describe("StatusBadge", () => {
  it("renders the label it is given rather than owning the translation", () => {
    render(<StatusBadge kind="invoice" status="PAID" label="Ödendi" />);
    expect(screen.getByText("Ödendi")).toBeInTheDocument();
  });

  it("tells two statuses of the same kind apart", () => {
    // The bug this component exists for: every screen rendered every status
    // as `<Badge variant="secondary">`, so PAID and DRAFT were the same pill.
    const paid = render(<StatusBadge kind="invoice" status="PAID" label="Ödendi" />);
    const draft = render(<StatusBadge kind="invoice" status="DRAFT" label="Taslak" />);
    expect(classesOf(paid.container)).not.toEqual(classesOf(draft.container));
  });

  it("gives the same tone the same look across kinds", () => {
    // Half-collected money and a no-show are both "someone has to act"; they
    // must not be two different ambers on two screens (TEAM.md #18).
    const partial = render(<StatusBadge kind="invoice" status="PARTIAL" label="x" />);
    const noShow = render(
      <StatusBadge kind="appointment" status="NO_SHOW" label="y" />,
    );
    expect(classesOf(partial.container)).toEqual(classesOf(noShow.container));
  });

  it("keeps caller classes so a call site can hold its layout", () => {
    const { container } = render(
      <StatusBadge kind="invoice" status="PAID" label="Ödendi" className="w-fit" />,
    );
    expect(classesOf(container)).toContain("w-fit");
  });
});

/** Every status the database can hand us, by kind. */
const enums: Record<StatusKind, Record<string, string>> = {
  appointment: AppointmentStatus,
  invoice: InvoiceStatus,
  reminder: ReminderStatus,
  message: MessageStatus,
  prescription: PrescriptionStatus,
  // Not a database enum: `User.active` is a boolean, named here so the
  // coverage check below still walks every kind.
  staff: { active: "active", inactive: "inactive" },
  // Not one either: `archivedAt` is a nullable timestamp with one named
  // state.
  archive: { archived: "archived" },
};

const everyTone = () =>
  (Object.entries(enums) as [StatusKind, Record<string, string>][]).flatMap(
    ([kind, values]) =>
      // @ts-expect-error - widened status on purpose: this walks the runtime
      // enum, which is exactly the set the narrow type is meant to match.
      Object.values(values).map((status) => statusTone(kind, status)),
  );

describe("the tone map covers every status the database can produce", () => {
  // The types already enforce this at build time via `satisfies`. This is the
  // same rule stated where a reader will meet it, and it fails with the
  // missing value's name rather than a structural type error.
  for (const [kind, values] of Object.entries(enums) as [
    StatusKind,
    Record<string, string>,
  ][]) {
    it(`maps every ${kind} status`, () => {
      const unmapped = Object.values(values).filter(
        // @ts-expect-error - widened status on purpose, see `everyTone`.
        (status) => statusTone(kind, status) === undefined,
      );
      expect(unmapped).toEqual([]);
    });
  }
});

describe("colour is earned, not default", () => {
  // The rule the map encodes. Written as a test because a rule in a task
  // description expires and a rule in a test does not (TEAM.md #6).
  it("leaves the ordinary, in-flight states neutral", () => {
    expect(statusTone("appointment", "SCHEDULED")).toBe("neutral");
    // Confirming an appointment is the normal state of a working day, not an
    // achievement. Green here would turn an ordinary list into a wall of
    // green and ARRIVED would stop meaning anything.
    expect(statusTone("appointment", "CONFIRMED")).toBe("neutral");
    expect(statusTone("invoice", "DRAFT")).toBe("neutral");
    expect(statusTone("reminder", "PENDING")).toBe("neutral");
  });

  it("spends the positive tone only where the loop closed", () => {
    expect(statusTone("invoice", "PAID")).toBe("positive");
    expect(statusTone("appointment", "COMPLETED")).toBe("positive");
    expect(statusTone("reminder", "ACKNOWLEDGED")).toBe("positive");
  });

  it("reads the same word differently for a reminder and for a message", () => {
    // A message's job was to go out, and it went out: done. A reminder went
    // out but the animal has not come back, so the work is still open. If
    // both were green, /reminders would be a wall of green made of
    // reminders that achieved nothing, and a loop that is failing would
    // look exactly like a loop that is working.
    expect(statusTone("message", "SENT")).toBe("positive");
    expect(statusTone("reminder", "SENT")).toBe("neutral");
  });

  it("treats a hand-sent message as intent, not as delivery", () => {
    // `SENT` means a carrier accepted it. `MANUAL` means someone opened the
    // text; there is no evidence it was ever sent, so it cannot claim to
    // have closed.
    expect(statusTone("message", "MANUAL")).toBe("neutral");
  });

  it("reserves danger for our own failures, and nothing else", () => {
    expect(statusTone("message", "FAILED")).toBe("danger");

    // A patient who did not turn up is not our failure, it is the loss this
    // release exists to chase: a row waiting for someone, not a dead end.
    expect(statusTone("appointment", "NO_SHOW")).toBe("attention");

    const danger = everyTone().filter((tone) => tone === "danger");
    expect(danger).toHaveLength(1);
  });

  it("puts the row that needs a person right now in the attention tone", () => {
    // The owner is standing in the waiting room. `positive` means "closed
    // well"; an arrival has not closed, it has just begun.
    expect(statusTone("appointment", "ARRIVED")).toBe("attention");
    // Work is already happening here, so it asks nothing of anyone.
    expect(statusTone("appointment", "IN_PROGRESS")).toBe("neutral");
    // An account that cannot sign in is an exception to notice.
    expect(statusTone("staff", "inactive")).toBe("attention");
    expect(statusTone("staff", "active")).toBe("neutral");
  });

  it("does not dress a cancellation as a failure", () => {
    // TEAM.md #25: a cancelled appointment is a closed record, not a fault.
    // Red here teaches people to read every cancellation as something wrong.
    expect(statusTone("appointment", "CANCELLED")).toBe("quiet");
    expect(statusTone("invoice", "VOID")).toBe("quiet");
    expect(statusTone("reminder", "DISMISSED")).toBe("quiet");
  });

  it("keeps the loud tones rare enough to mean something", () => {
    // Half-collected money is the one state in the app that quietly rots.
    expect(statusTone("invoice", "PARTIAL")).toBe("attention");

    const loud = everyTone().filter(
      (tone) => tone === "attention" || tone === "danger",
    );
    // If a later status pushes this over a third, the question to ask is
    // not "raise the threshold" but "does this one really need a colour" —
    // that is the whole premise of the map.
    expect(loud.length / everyTone().length).toBeLessThan(0.34);
  });
});

describe("appearance", () => {
  it("paints every tone from a role token, never a raw palette colour", () => {
    for (const status of Object.values(InvoiceStatus)) {
      const { container } = render(
        <StatusBadge kind="invoice" status={status} label="x" />,
      );
      expect(classesOf(container)).not.toMatch(
        /(text|bg|border)-(amber|red|green|yellow|slate|gray)-\d/,
      );
    }
  });

  it("uses logical direction utilities only", () => {
    // TEAM.md #31.
    const { container } = render(
      <StatusBadge kind="invoice" status="PARTIAL" label="Kısmen ödendi" />,
    );
    const classes = classesOf(container).split(/\s+/);
    const physical = classes.filter((c) =>
      /^-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-(left|right))(-|$)/.test(
        c,
      ),
    );
    expect(physical).toEqual([]);
  });

  it("shows the longest translation whole instead of clipping it", () => {
    // TEAM.md #32. The longest status label in either language today.
    const longest = "Kısmen ödendi";
    const { container } = render(
      <StatusBadge kind="invoice" status="PARTIAL" label={longest} />,
    );
    expect(screen.getByText(longest)).toBeInTheDocument();
    // No truncation and no fixed width: a longer German or Turkish label
    // has to be able to make the pill wider, not disappear into an ellipsis.
    expect(classesOf(container)).not.toMatch(/truncate|overflow-hidden|w-\d/);
  });
});
