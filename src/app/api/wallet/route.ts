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

    // Create a new embedded wallet (Privy auto-deduplicates if one exists)
    const wallet = await privy.wallets().create({
      chain_type: "ethereum",
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
