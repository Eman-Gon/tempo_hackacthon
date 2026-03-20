const mockSignMessage = jest.fn();
const mockSignSecp256k1 = jest.fn();
const mockSignTypedData = jest.fn();
const mockGetUser = jest.fn();
const mockPregenerateWallets = jest.fn();
const mockVerifyAccessToken = jest.fn();

jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    wallets: () => ({
      ethereum: () => ({
        signMessage: mockSignMessage,
        signSecp256k1: mockSignSecp256k1,
        signTypedData: mockSignTypedData,
      }),
    }),
    users: () => ({
      _get: mockGetUser,
      pregenerateWallets: mockPregenerateWallets,
    }),
    utils: () => ({
      auth: () => ({
        verifyAccessToken: mockVerifyAccessToken,
      }),
    }),
  })),
}));

import {
  createPrivyAccount,
  ensurePrivyEthereumWallet,
  getEmbeddedEthereumWallet,
} from "@/lib/privy";

const embeddedWallet = {
  id: "wallet-123",
  address: "0x1234567890abcdef1234567890abcdef12345678",
  type: "wallet" as const,
  chain_type: "ethereum",
  wallet_client_type: "privy",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSignMessage.mockResolvedValue({
    signature: "0xmocksignature123",
  });
  mockSignSecp256k1.mockResolvedValue({
    signature: "0xmockrawsig456",
  });
  mockSignTypedData.mockResolvedValue({
    signature: "0xmocktypedsig789",
  });
});

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
    const transaction = {} as Parameters<typeof account.signTransaction>[0];
    const options = {} as Parameters<typeof account.signTransaction>[1];

    await expect(
      account.signTransaction(transaction, options)
    ).rejects.toThrow("Tempo serializer required");
  });
});

describe("getEmbeddedEthereumWallet", () => {
  it("returns the embedded ethereum wallet when present", () => {
    expect(
      getEmbeddedEthereumWallet({
        linked_accounts: [
          {
            ...embeddedWallet,
          },
          {
            id: "wallet-solana",
            address: "solana-address",
            type: "wallet",
            chain_type: "solana",
            wallet_client_type: "privy",
          },
        ],
      })
    ).toEqual({
      walletId: embeddedWallet.id,
      address: embeddedWallet.address,
    });
  });

  it("returns null when no embedded ethereum wallet exists", () => {
    expect(
      getEmbeddedEthereumWallet({
        linked_accounts: [
          {
            id: "external-wallet",
            address: embeddedWallet.address,
            type: "wallet",
            chain_type: "ethereum",
            wallet_client_type: "metamask",
          },
        ],
      })
    ).toBeNull();
  });
});

describe("ensurePrivyEthereumWallet", () => {
  it("reuses an existing embedded wallet", async () => {
    mockGetUser.mockResolvedValue({
      linked_accounts: [embeddedWallet],
    });

    await expect(ensurePrivyEthereumWallet("did:privy:user-123")).resolves.toEqual(
      {
        walletId: embeddedWallet.id,
        address: embeddedWallet.address,
      }
    );
    expect(mockPregenerateWallets).not.toHaveBeenCalled();
  });

  it("pregenerates a wallet when the user does not have one yet", async () => {
    mockGetUser.mockResolvedValue({
      linked_accounts: [],
    });
    mockPregenerateWallets.mockResolvedValue({
      linked_accounts: [embeddedWallet],
    });

    await expect(ensurePrivyEthereumWallet("did:privy:user-123")).resolves.toEqual(
      {
        walletId: embeddedWallet.id,
        address: embeddedWallet.address,
      }
    );
    expect(mockPregenerateWallets).toHaveBeenCalledWith(
      "did:privy:user-123",
      {
        wallets: [{ chain_type: "ethereum" }],
      }
    );
  });

  it("throws when wallet generation does not return an embedded wallet", async () => {
    mockGetUser.mockResolvedValue({
      linked_accounts: [],
    });
    mockPregenerateWallets.mockResolvedValue({
      linked_accounts: [],
    });

    await expect(
      ensurePrivyEthereumWallet("did:privy:user-123")
    ).rejects.toThrow("Failed to create an embedded wallet for this user");
  });
});
