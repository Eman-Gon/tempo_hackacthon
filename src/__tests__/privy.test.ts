import { createPrivyAccount } from "@/lib/privy";

// Mock the PrivyClient
jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    wallets: () => ({
      ethereum: () => ({
        signMessage: jest.fn().mockResolvedValue({
          signature: "0xmocksignature123",
        }),
        signSecp256k1: jest.fn().mockResolvedValue({
          signature: "0xmockrawsig456",
        }),
        signTypedData: jest.fn().mockResolvedValue({
          signature: "0xmocktypedsig789",
        }),
      }),
      create: jest.fn().mockResolvedValue({
        id: "wallet-123",
        address: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    }),
    users: () => ({
      get: jest.fn().mockResolvedValue({
        id: "user-123",
        linked_accounts: [],
      }),
    }),
  })),
}));

describe("createPrivyAccount", () => {
  const walletId = "test-wallet-id";
  const address = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;

  it("returns an account object with the correct address", () => {
    const account = createPrivyAccount(walletId, address);
    expect(account.address).toBe(address);
  });

  it("has signMessage function", () => {
    const account = createPrivyAccount(walletId, address);
    expect(typeof account.signMessage).toBe("function");
  });

  it("has signTransaction function", () => {
    const account = createPrivyAccount(walletId, address);
    expect(typeof account.signTransaction).toBe("function");
  });

  it("has signTypedData function", () => {
    const account = createPrivyAccount(walletId, address);
    expect(typeof account.signTypedData).toBe("function");
  });

  it("signMessage handles string messages", async () => {
    const account = createPrivyAccount(walletId, address);
    const result = await account.signMessage({ message: "hello" });
    expect(result).toBe("0xmocksignature123");
  });

  it("signTransaction throws without serializer", async () => {
    const account = createPrivyAccount(walletId, address);
    await expect(
      account.signTransaction({} as any, {} as any)
    ).rejects.toThrow("Tempo serializer required");
  });
});
