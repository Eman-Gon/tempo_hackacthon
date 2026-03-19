jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    wallets: () => ({
      ethereum: () => ({
        signMessage: jest.fn().mockResolvedValue({ signature: "0xsig" }),
        signSecp256k1: jest.fn().mockResolvedValue({ signature: "0xsig" }),
        signTypedData: jest.fn().mockResolvedValue({ signature: "0xsig" }),
      }),
      create: jest.fn(),
    }),
    users: () => ({ get: jest.fn() }),
  })),
}));

const mockFetch = jest.fn();
jest.mock("mppx/client", () => ({
  Mppx: {
    create: jest.fn().mockReturnValue({ fetch: mockFetch }),
  },
  tempo: jest.fn().mockReturnValue([]),
}));

import { POST } from "@/app/api/research/route";
import { NextRequest } from "next/server";

function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/research", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/research", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns 400 when fields are missing", async () => {
    const req = createRequest({ jobDescription: "test" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when jobDescription is missing", async () => {
    const req = createRequest({
      walletId: "w-1",
      address: "0x123",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns candidates on success", async () => {
    // Mock Exa search
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ results: [] }),
    });
    // Mock Perplexity scoring
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "[]" } }],
        }),
    });

    const req = createRequest({
      jobDescription: "Senior Engineer",
      walletId: "w-1",
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.candidates).toBeDefined();
    expect(data.events).toBeDefined();
    expect(data.totalCost).toBeDefined();
  });
});
