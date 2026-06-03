// Stub out the strict env vars `lib/env.ts` insists on so unit tests can
// import service modules without a real environment. The DB-touching
// callers are mocked via `vi.mock("@/lib/prisma")` in each test file.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DIRECT_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SECRET ??= "test-secret-must-be-at-least-32-characters-long";

import "@testing-library/jest-dom/vitest";
