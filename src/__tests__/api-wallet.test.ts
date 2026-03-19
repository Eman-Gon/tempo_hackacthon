jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    wallets: () => ({
      create: jest.fn().mockResolvedValue({
        id: "wallet-abc",
        address: "0xdeadbeef1234567890abcdef1234567890abcdef",
      }),
      ethereum: () => ({
        signMessage: jest.fn(),
        signSecp256k1: jest.fn(),
        signTypedData: jest.fn(),
      }),
    }),
    users: () => ({ get: jest.fn() }),
  })),
}));

import { POST } from "@/app/api/wallet/route";
import { NextRequest } from "next/server";

function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/wallet", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/wallet", () => {
  it("returns 400 when privyUserId is missing", async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("privyUserId is required");
  });

  it("creates a wallet when privyUserId is provided", async () => {
    const req = createRequest({ privyUserId: "user-123" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.walletId).toBe("wallet-abc");
    expect(data.address).toBe("0xdeadbeef1234567890abcdef1234567890abcdef");
  });
});
