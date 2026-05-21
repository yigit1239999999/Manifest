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
  }
}
