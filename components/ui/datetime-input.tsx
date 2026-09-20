"use client";

// A date-and-time field that means what the clinic's clock says.
//
// The visible <input type="datetime-local"> holds a wall-clock time with no
// zone attached. Submitted as-is it would be parsed against whatever clock
// the server runs on (UTC on Vercel), so 11:30 at an Istanbul clinic would
// be stored as 14:30. This component keeps the wall time on screen and
// submits the instant it stands for in the clinic's zone.

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
}

export function DateTimeInput({ name, defaultValue, ...props }: Props) {
  const timeZone = useClinicZone();
  const initial = React.useMemo(() => {
    if (!defaultValue) return "";
    const date =
      defaultValue instanceof Date ? defaultValue : new Date(defaultValue);
    return Number.isNaN(date.getTime()) ? "" : toDateTimeInput(date, timeZone);
  }, [defaultValue, timeZone]);

  const [wall, setWall] = React.useState(initial);
  const instant = wall ? wallTimeToInstant(wall, timeZone) : null;

  return (
    <>
      <Input
        {...props}
        type="datetime-local"
        value={wall}
        onChange={(e) => setWall(e.target.value)}
      />
      {/* What the form actually submits. */}
      <input type="hidden" name={name} value={instant?.toISOString() ?? wall} />
    </>
  );
}
