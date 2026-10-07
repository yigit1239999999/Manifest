// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ClinicZoneProvider } from "@/components/clinic-zone";
import { DateTimeInput } from "@/components/ui/datetime-input";

function inZone(timeZone: string, ui: React.ReactNode) {
  const { container } = render(
    <ClinicZoneProvider timeZone={timeZone}>{ui}</ClinicZoneProvider>,
  );
  return {
    visible: container.querySelector<HTMLInputElement>(
      'input:not([type="hidden"])',
    )!,
    submitted: container.querySelector<HTMLInputElement>(
      'input[type="hidden"]',
    )!,
  };
}

describe("DateTimeInput", () => {
  it("shows the stored instant on the clinic's clock, not the server's", () => {
    // 08:30 UTC is 11:30 in Istanbul, and 11:30 is what the clinic wrote.
    const { visible } = inZone(
      "Europe/Istanbul",
      <DateTimeInput name="startsAt" defaultValue="2026-09-23T08:30:00.000Z" />,
    );
    expect(visible.type).toBe("datetime-local");
    expect(visible.value).toBe("2026-09-23T11:30");
  });

  it("submits the instant the wall time stands for", () => {
    const { submitted } = inZone(
      "Europe/Istanbul",
      <DateTimeInput name="startsAt" defaultValue="2026-09-23T08:30:00.000Z" />,
    );
    expect(submitted.value).toBe("2026-09-23T08:30:00.000Z");
  });

  describe('granularity="day"', () => {
    it("asks for a date and nothing else", () => {
      // Four of this app's dates are days: a vaccination's next due date, a
      // reminder's due date, a follow-up, an invoice's due date. Asking for
      // a time of day there fills the column with the browser's 00:00,
      // which nobody chose and nothing reads.
      const { visible } = inZone(
        "Europe/Istanbul",
        <DateTimeInput
          name="nextDueAt"
          granularity="day"
          defaultValue="2027-03-14T00:00:00+03:00"
        />,
      );
      expect(visible.type).toBe("date");
      expect(visible.value).toBe("2027-03-14");
    });

    it("stores midnight on the clinic's clock, not UTC midnight", () => {
      // The New York test. `America/New_York` is in the clinic zone list
      // and runs four or five hours behind UTC, so UTC midnight there is
      // the evening of the day before: a due date stored that way reads
      // back one day early for the clinic that set it. 05:00Z is midnight
      // in New York on 14 March 2027, which is also the day the clocks go
      // forward — the offset has to be taken at the instant, not assumed.
      const { visible, submitted } = inZone(
        "America/New_York",
        <DateTimeInput
          name="nextDueAt"
          granularity="day"
          defaultValue="2027-03-14T05:00:00.000Z"
        />,
      );
      expect(visible.value).toBe("2027-03-14");
      expect(submitted.value).toBe("2027-03-14T05:00:00.000Z");
    });

    it("round-trips the same day it was given, in a westward zone", () => {
      const { visible, submitted } = inZone(
        "America/Los_Angeles",
        <DateTimeInput
          name="dueAt"
          granularity="day"
          defaultValue="2026-12-01T08:00:00.000Z"
        />,
      );
      expect(visible.value).toBe("2026-12-01");
      // Read back on the clinic's clock, the submitted instant is still the
      // first of December and not the thirtieth of November.
      const readBack = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(submitted.value));
      expect(readBack).toBe("2026-12-01");
    });

    it("submits nothing for an empty optional day field", () => {
      const { submitted } = inZone(
        "Europe/Istanbul",
        <DateTimeInput name="followupAt" granularity="day" />,
      );
      expect(submitted.value).toBe("");
    });
  });
});
