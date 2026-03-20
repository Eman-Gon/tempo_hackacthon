import { PrivyClient } from "@privy-io/node";
import { toAccount } from "viem/accounts";
import { keccak256 } from "viem";

export const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  jwtVerificationKey: process.env.PRIVY_JWT_VERIFICATION_KEY,
});

type PrivyEthereumSignTypedDataInput = Parameters<
  ReturnType<ReturnType<typeof privy.wallets>["ethereum"]>["signTypedData"]
>[1];
type PrivyTypedDataPayload =
  PrivyEthereumSignTypedDataInput["params"]["typed_data"];

interface LinkedWalletAccount {
  id?: string | null;
  address?: string;
  chain_type?: string;
  type: string;
  wallet_client_type?: string;
}

interface PrivyUserWithLinkedAccounts {
  linked_accounts: LinkedWalletAccount[];
}

export function getEmbeddedEthereumWallet(
  user: PrivyUserWithLinkedAccounts
) {
  const embeddedWallet = user.linked_accounts.find(
    (account) =>
      account.type === "wallet" &&
      account.chain_type === "ethereum" &&
      account.wallet_client_type === "privy" &&
      Boolean(account.id) &&
      Boolean(account.address)
  );

  if (!embeddedWallet?.id) return null;
  if (!embeddedWallet.address) return null;

  return {
    walletId: embeddedWallet.id,
    address: embeddedWallet.address as `0x${string}`,
  };
}

export async function ensurePrivyEthereumWallet(privyUserId: string) {
  const user = await privy.users()._get(privyUserId);
  const existingWallet = getEmbeddedEthereumWallet(user);

  if (existingWallet) {
    return existingWallet;
  }

  const updatedUser = await privy.users().pregenerateWallets(privyUserId, {
    wallets: [{ chain_type: "ethereum" }],
  });
  const generatedWallet = getEmbeddedEthereumWallet(updatedUser);

  if (!generatedWallet) {
    throw new Error("Failed to create an embedded wallet for this user");
  }

  return generatedWallet;
}

export function verifyPrivyAccessToken(accessToken: string) {
  return privy.utils().auth().verifyAccessToken(accessToken);
}

function toPrivyTypedDataInput(
  typedData: unknown
): PrivyEthereumSignTypedDataInput {
  const payload = typedData as {
    domain: PrivyTypedDataPayload["domain"];
    message: PrivyTypedDataPayload["message"];
    primaryType: PrivyTypedDataPayload["primary_type"];
    types: PrivyTypedDataPayload["types"];
  };

  return {
    params: {
      typed_data: {
        domain: payload.domain,
        message: payload.message,
        primary_type: payload.primaryType,
        types: payload.types,
      },
    },
  };
}

export function createPrivyAccount(
  walletId: string,
  address: `0x${string}`
) {
  return toAccount({
    address,
    async signMessage({ message }) {
      const result = await privy
        .wallets()
        .ethereum()
        .signMessage(walletId, {
          message:
            typeof message === "string"
              ? message
              : new Uint8Array(
                  Buffer.from(
                    (message.raw as string).replace(/^0x/, ""),
                    "hex"
                  )
                ),
        });
      return result.signature as `0x${string}`;
    },
    async signTransaction(transaction, options) {
      const serializer = options?.serializer;
      if (!serializer) throw new Error("Tempo serializer required");
      const unsignedSerialized = await serializer(transaction);
      const hash = keccak256(unsignedSerialized);
      const result = await privy
        .wallets()
        .ethereum()
        .signSecp256k1(walletId, { params: { hash } });
      const signature = result.signature as `0x${string}`;
      const { SignatureEnvelope } = await import("ox/tempo");
      const envelope = SignatureEnvelope.from(signature);
      return (await serializer(
        transaction,
        envelope as unknown as Parameters<typeof serializer>[1]
      )) as `0x${string}`;
    },
    async signTypedData(typedData) {
      const result = await privy
        .wallets()
        .ethereum()
        .signTypedData(walletId, toPrivyTypedDataInput(typedData));
      return result.signature as `0x${string}`;
    },
  });
}
