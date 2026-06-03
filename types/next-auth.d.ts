import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      clinicId: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    clinicId: string;
    role: string;
    /** Milliseconds since epoch of the last password change; null = never. */
    passwordChangedAt: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    clinicId?: string;
    role?: string;
    /** Mirror of User.passwordChangedAt, copied in at sign-in time. */
    pwc?: number | null;
  }
}
