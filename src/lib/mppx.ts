import { Mppx, tempo } from "mppx/client";
import { createPrivyAccount } from "./privy";

export function createMppxClient(
  walletId: string,
  address: `0x${string}`
) {
  const account = createPrivyAccount(walletId, address);
  return Mppx.create({
    polyfill: true,
    methods: [tempo({ account })],
  });
}
