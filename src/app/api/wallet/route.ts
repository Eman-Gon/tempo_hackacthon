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

    // Use the funded wallet
    const FUNDED_WALLET_ID = "js13iejxuggh7hr4oay0eodi";
    const FUNDED_WALLET_ADDRESS = "0x52207fb0B18D48E4f4F69f8AeB63FC1e4fCc2FE1";

    return NextResponse.json({
      walletId: FUNDED_WALLET_ID,
      address: FUNDED_WALLET_ADDRESS,
    });
  } catch (error: any) {
    console.error("Wallet creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wallet" },
      { status: 500 }
    );
  }
}
