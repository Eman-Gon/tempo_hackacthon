const mockCreate = jest.fn().mockResolvedValue({
  id: "wallet-abc",
  address: "0xdeadbeef1234567890abcdef1234567890abcdef",
});

// Async iterator that yields wallets from a configurable array
let mockWalletList: any[] = [];

jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    wallets: () => ({
      create: mockCreate,
      list: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => {
          let i = 0;
          return {
            next: () =>
              i < mockWalletList.length
                ? Promise.resolve({ value: mockWalletList[i++], done: false })
                : Promise.resolve({ value: undefined, done: true }),
          };
        },
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
  beforeEach(() => {
    mockWalletList = [];
    mockCreate.mockClear();
  });

  it("returns 400 when privyUserId is missing", async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("privyUserId is required");
  });

  it("creates a new wallet when no existing wallet found", async () => {
    mockWalletList = [];
    const req = createRequest({ privyUserId: "did:privy:user-123" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.walletId).toBe("wallet-abc");
    expect(data.address).toBe("0xdeadbeef1234567890abcdef1234567890abcdef");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns existing wallet when one is found", async () => {
    mockWalletList = [
      {
        id: "wallet-existing",
        address: "0x1111111111111111111111111111111111111111",
      },
    ];
    const req = createRequest({ privyUserId: "did:privy:user-123" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.walletId).toBe("wallet-existing");
    expect(data.address).toBe("0x1111111111111111111111111111111111111111");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
