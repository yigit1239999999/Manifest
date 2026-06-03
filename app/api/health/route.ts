import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Cheap liveness/readiness probe. Pings the database with a 1-second budget
// so a load balancer can route around a degraded instance.

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db_timeout")), 1000),
      ),
    ]);
    return Response.json(
      {
        status: "ok",
        db: "ok",
        sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("health.db_check_failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        status: "degraded",
        db: "unreachable",
        sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
