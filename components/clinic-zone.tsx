"use client";

// The clinic's time zone, available to every client component below the app
// layout. Forms need it to read a typed-in wall-clock time the way the
// clinic means it — the browser's own zone is a staff member's laptop
// setting, not where the appointment happens.

import * as React from "react";

const ClinicZoneContext = React.createContext<string | undefined>(undefined);

export function ClinicZoneProvider({
  timeZone,
  children,
}: {
  timeZone?: string;
  children: React.ReactNode;
}) {
  return (
    <ClinicZoneContext.Provider value={timeZone}>
      {children}
    </ClinicZoneContext.Provider>
  );
}

/** The clinic zone, falling back to the browser's so nothing ever breaks. */
export function useClinicZone(): string | undefined {
  const fromClinic = React.useContext(ClinicZoneContext);
  if (fromClinic) return fromClinic;
  if (typeof Intl === "undefined") return undefined;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
