import { NextRequest, NextResponse } from "next/server";
import { privy } from "@/lib/privy";

export async function POST(req: NextRequest) {
  try {
    const { privyUserId } = await req.json();
    if (!privyUserId) {
      return NextResponse.json(
        { error: "privyUserId is required" },
        { status: 400 }
      );
    }

    // Try to find existing wallets for this user first
    const existingWallets = await privy.wallets().list({
      user_id: privyUserId,
    });

    if (existingWallets.data && existingWallets.data.length > 0) {
      const wallet = existingWallets.data[0];
      return NextResponse.json({
        walletId: wallet.id,
        address: wallet.address,
      });
    }

    // Only create a new wallet if none exists
    const wallet = await privy.wallets().create({
      chain_type: "ethereum",
      owner: { type: "user", user_id: privyUserId },
    });

    return NextResponse.json({
      walletId: wallet.id,
      address: wallet.address,
    });
  } catch (error: any) {
    console.error("Wallet creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wallet" },
      { status: 500 }
    );
  }
}
