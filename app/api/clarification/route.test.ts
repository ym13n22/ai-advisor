import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/profileRepository", () => ({ getDemoUserId: vi.fn(async () => "demo-user-a") }));
vi.mock("@/server/chatService", () => ({ handleClarificationAnswer: vi.fn(async (input) => ({ updated: true, input })) }));

describe("clarification api", () => {
  it("accepts clarification answer", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://x/api/clarification", { method: "POST", body: JSON.stringify({ conversationId: "c1", conflictPairId: "pair1", answer: "最多亏损 5%" }) });
    expect(await (await POST(req)).json()).toMatchObject({ updated: true });
  });
});
