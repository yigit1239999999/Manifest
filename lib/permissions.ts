// Role-based access control.
//
// Permissions are a flat string set per role. Services call
// `requirePermission(ctx.userRole, "x.write")` at the top of any
// mutation; UI helpers like `can(role, "x.write")` hide buttons that
// would only get rejected after a click.

import { forbidden } from "./errors";

export type UserRole =
  | "ADMIN"
  | "VETERINARIAN"
  | "VET_TECH"
  | "RECEPTIONIST";

export type Permission =
  | "clients.read"
  | "clients.write"
  | "clients.archive"
  | "pets.read"
  | "pets.write"
  | "pets.archive"
  | "visits.read"
  | "visits.write"
  | "appointments.read"
  | "appointments.write"
  | "vaccinations.write"
  | "prescriptions.write"
  | "treatments.write"
  | "diagnostics.write"
  /**
   * Marking a result as read, and writing its interpretation.
   *
   * Separate from `diagnostics.write` because the read marker has
   * exactly one meaning -- did the person who decides see this? -- and
   * if anyone else can clear it, it stops answering its own question.
   * A technician enters results, which is `diagnostics.write`, and
   * cannot say on a vet's behalf that a vet has seen one.
   *
   * Interpretation is behind the same gate, and not as an extra: a
   * written comment counts as having read the result, so leaving it
   * under `diagnostics.write` would let the marker be cleared through
   * the back door by the same people the front door excludes.
   */
  | "diagnostics.interpret"
  | "notes.write"
  | "reminders.write"
  | "invoices.read"
  | "invoices.write"
  | "invoices.void"
  | "payments.write"
  | "audit.read"
  | "users.manage"
  | "settings.manage";

const PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "clients.read",
    "clients.write",
    "clients.archive",
    "pets.read",
    "pets.write",
    "pets.archive",
    "visits.read",
    "visits.write",
    "appointments.read",
    "appointments.write",
    "vaccinations.write",
    "prescriptions.write",
    "treatments.write",
    "diagnostics.write",
    "diagnostics.interpret",
    "notes.write",
    "reminders.write",
    "invoices.read",
    "invoices.write",
    "invoices.void",
    "payments.write",
    "audit.read",
    "users.manage",
    "settings.manage",
  ]),
  VETERINARIAN: new Set<Permission>([
    "clients.read",
    "clients.write",
    "clients.archive",
    "pets.read",
    "pets.write",
    "pets.archive",
    "visits.read",
    "visits.write",
    "appointments.read",
    "appointments.write",
    "vaccinations.write",
    "prescriptions.write",
    "treatments.write",
    "diagnostics.write",
    "diagnostics.interpret",
    "notes.write",
    "reminders.write",
    "invoices.read",
    "invoices.write",
    "payments.write",
    "audit.read",
  ]),
  VET_TECH: new Set<Permission>([
    "clients.read",
    "pets.read",
    "visits.read",
    "appointments.read",
    "vaccinations.write",
    "treatments.write",
    "diagnostics.write",
    "notes.write",
    "reminders.write",
    "invoices.read",
  ]),
  RECEPTIONIST: new Set<Permission>([
    "clients.read",
    "clients.write",
    "pets.read",
    "pets.write",
    "visits.read",
    "appointments.read",
    "appointments.write",
    // Typing in a laboratory report is transcription, and reception
    // already does it -- on paper, into a file. Routing it through a
    // technician costs nothing and adds a handover, which is what the
    // case that prompted all of this actually was: everybody did
    // their job and the work fell in the gap between two of them.
    //
    // Safe because the dangerous half is a different key:
    // `diagnostics.interpret` keeps the written opinion and the read
    // marker with the person who decides.
    "diagnostics.write",
    "notes.write",
    "reminders.write",
    "invoices.read",
    "invoices.write",
    "payments.write",
  ]),
};

function asRole(role: string): UserRole | null {
  return role in PERMISSIONS ? (role as UserRole) : null;
}

export function can(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const key = asRole(role);
  if (!key) return false;
  return PERMISSIONS[key].has(permission);
}

export function requirePermission(
  role: string | undefined,
  permission: Permission,
): void {
  if (!can(role, permission)) {
    throw forbidden(`Bu işlem için yetkin yok (${permission}).`);
  }
}
