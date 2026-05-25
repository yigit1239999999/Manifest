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
