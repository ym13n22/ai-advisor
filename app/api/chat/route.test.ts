import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/profileRepository", () => ({ getDemoUserId: vi.fn(async () => "demo-user-a") }));
vi.mock("@/server/chatService", () => ({ handleUserMessage: vi.fn(async (input) => ({ ok: true, input })) }));

describe("chat api", () => {
  beforeEach(() => vi.resetModules());

  it("accepts valid user message", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ text: "要不要买", productId: "p1" }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("rejects empty user message", async () => {
    const { POST } = await import("./route");
    await expect(POST(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ text: "" }) }))).rejects.toThrow();
  });
});
