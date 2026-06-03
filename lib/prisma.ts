import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

// Append safe pool + timeout defaults onto whatever pooled URL the user
// provided. 50 vets × connection_limit=15 stays under Supabase's 200-pgbouncer
// ceiling, pool_timeout caps backpressure, and statement_timeout ensures a
// runaway query can never block other writers indefinitely.
function withPoolDefaults(url: string): string {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    if (!params.has("connection_limit")) params.set("connection_limit", "15");
    if (!params.has("pool_timeout")) params.set("pool_timeout", "10");
    if (!params.has("statement_timeout")) params.set("statement_timeout", "15000");
    parsed.search = params.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: withPoolDefaults(env.DATABASE_URL),
  });
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 5_000,
      timeout: 15_000,
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
