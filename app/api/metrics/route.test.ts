import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/profileRepository", () => ({ getDemoUserId: vi.fn(async () => "demo-user-a") }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiCallLog: { findMany: vi.fn(async () => [{ success: true, latencyMs: 10 }]) },
    recognitionResult: { findMany: vi.fn(async () => [{ confidence: 0.9, intent: "买入", emotion: "平静" }]) },
    conflictEvent: { findMany: vi.fn(async () => [{ overallConflictLevel: "high" }]) },
    profileUpdateLog: { findMany: vi.fn(async () => [{ success: true, output: { reevaluated: { overallConflictLevel: "none" } } }]) },
    complianceCheckLog: { findMany: vi.fn(async () => [{ success: true }]) }
  }
}));

describe("metrics api", () => {
  it("returns aggregated metrics", async () => {
    const { GET } = await import("./route");
    const json = await (await GET()).json();
    expect(json.callSuccessRate).toBe(100);
    expect(json.highConflictRate).toBe(100);
  });
});
