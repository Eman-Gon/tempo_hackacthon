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

jest.mock("mppx/client", () => ({
  Mppx: {
    create: jest.fn().mockReturnValue({
      fetch: jest.fn(),
    }),
  },
  tempo: jest.fn().mockReturnValue([]),
}));

import { createMppxClient } from "@/lib/mppx";

describe("createMppxClient", () => {
  const walletId = "test-wallet";
  const address = "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`;

  it("creates an mppx client", () => {
    const client = createMppxClient(walletId, address);
    expect(client).toBeDefined();
    expect(client.fetch).toBeDefined();
  });

  it("calls Mppx.create with polyfill true", () => {
    const { Mppx } = require("mppx/client");
    createMppxClient(walletId, address);
    expect(Mppx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        polyfill: true,
      })
    );
  });
});
