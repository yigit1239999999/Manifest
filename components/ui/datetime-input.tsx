"use client";

// A date field that means what the clinic's clock says.
//
// The visible <input> holds a wall-clock time with no zone attached.
// Submitted as-is it would be parsed against whatever clock the server runs
// on (UTC on Vercel), so 11:30 at an Istanbul clinic would be stored as
// 14:30. This component keeps the wall time on screen and submits the
// instant it stands for in the clinic's zone.
//
// `granularity` picks which question the field asks. Four of the dates in
// this app are days, not moments — a vaccination's next due date, a
// reminder's due date, a visit's follow-up, an invoice's due date. Asking
// for a time of day there is not only friction: nobody knows the answer, so
// every one of them gets the browser's 00:00 and the column fills with a
// number that means nothing. Nothing reads it either — the reminder
// scheduler takes the date parts and rebuilds the moment at the clinic's
// `morningHour` (`lib/whatsapp/schedule.ts`) — so this is friction, not a
// defect, and the fix is to stop asking.
//
// It is the same mechanism underneath and deliberately not a second one:
// a day still submits an instant, and that instant is midnight *on the
// clinic's clock*. Storing UTC midnight instead would put a New York clinic
// on the previous day, which is not hypothetical — `America/New_York` and
// `America/Los_Angeles` are both in the clinic zone list
// (`modules/notifications/schema.ts`).
//
// `Appointment.startsAt` is deliberately left alone: its time of day is real
// information and the reminder window genuinely reads it.

import * as React from "react";
import { useClinicZone } from "@/components/clinic-zone";
import { Input } from "@/components/ui/input";
import { toDateTimeInput, wallTimeToInstant } from "@/lib/format";

interface Props
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "name" | "defaultValue" | "value" | "onChange"
  > {
  name: string;
  /** The stored instant, or null for a new record. */
  defaultValue?: Date | string | null;
  /** `minute` asks for a date and a time; `day` asks only for a date. */
  granularity?: "minute" | "day";
  /**
   * The wall-clock text shown in the field, when a parent needs to drive it.
   *
   * Optional, and passing it makes the field controlled. Only one call site
   * needs this: the vaccination form's suggestion chip has to be able to
   * put a date into the field, and the sentence under the field has to know
   * whether there is one (backlog 20). Everywhere else the field keeps its
   * own state and nothing above it has to care.
   */
  value?: string;
  onValueChange?: (wall: string) => void;
}

export function DateTimeInput({
  name,
  defaultValue,
  granularity = "minute",
  value,
  onValueChange,
  ...props
}: Props) {
  const timeZone = useClinicZone();
  const day = granularity === "day";

  const initial = React.useMemo(() => {
    if (!defaultValue) return "";
    const date =
      defaultValue instanceof Date ? defaultValue : new Date(defaultValue);
    if (Number.isNaN(date.getTime())) return "";
    const wall = toDateTimeInput(date, timeZone);
    // "2026-09-23T00:00" -> "2026-09-23". The same conversion either way, so
    // a day field cannot drift from a minute field.
    return day ? wall.slice(0, 10) : wall;
  }, [defaultValue, timeZone, day]);

  const [ownWall, setOwnWall] = React.useState(initial);
  const wall = value ?? ownWall;

  function change(next: string) {
    if (value === undefined) setOwnWall(next);
    onValueChange?.(next);
  }

  // Midnight on the clinic's clock, not on the server's and not UTC's.
  const instant = wall
    ? wallTimeToInstant(day ? `${wall}T00:00` : wall, timeZone)
    : null;

  return (
    <>
      <Input
        {...props}
        type={day ? "date" : "datetime-local"}
        value={wall}
        onChange={(e) => change(e.target.value)}
      />
      {/* What the form actually submits. */}
      <input type="hidden" name={name} value={instant?.toISOString() ?? wall} />
    </>
  );
}
