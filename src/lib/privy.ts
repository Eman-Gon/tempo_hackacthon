import { PrivyClient } from "@privy-io/node";
import { toAccount } from "viem/accounts";
import { keccak256 } from "viem";

export const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

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
        envelope as any
      )) as `0x${string}`;
    },
    async signTypedData(typedData) {
      const result = await privy
        .wallets()
        .ethereum()
        .signTypedData(walletId, { params: typedData as any });
      return result.signature as `0x${string}`;
    },
  });
}
