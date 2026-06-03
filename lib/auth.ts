import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signInSchema } from "@/modules/auth/schema";

const EIGHT_HOURS = 60 * 60 * 8;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: EIGHT_HOURS },
  jwt: { maxAge: EIGHT_HOURS },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          clinicId: user.clinicId,
          role: user.role,
          // Captured into the JWT so the `jwt` callback can reject tokens
          // issued before the most recent password change.
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Sign-in path: copy claims into the JWT.
        token.clinicId = user.clinicId;
        token.role = user.role;
        token.pwc = user.passwordChangedAt;
        return token;
      }

      // Subsequent requests: cheap lookup confirms the user is still
      // active and the password hasn't been rotated since this token
      // was issued. Returning null invalidates the session.
      if (!token.sub) return token;
      const current = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { active: true, passwordChangedAt: true },
      });
      if (!current || !current.active) return null;
      if (
        current.passwordChangedAt &&
        token.iat != null &&
        current.passwordChangedAt.getTime() > token.iat * 1000
      ) {
        return null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.clinicId = (token.clinicId as string | undefined) ?? "";
        session.user.role = (token.role as string | undefined) ?? "";
      }
      return session;
    },
  },
});
