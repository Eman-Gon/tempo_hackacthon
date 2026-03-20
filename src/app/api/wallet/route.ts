import { NextRequest, NextResponse } from "next/server";
import { InvalidAuthTokenError } from "@privy-io/node";
import {
  ensurePrivyEthereumWallet,
  verifyPrivyAccessToken,
} from "@/lib/privy";

export async function POST(req: NextRequest) {
  try {
    const { privyUserId } = await req.json();
    if (!privyUserId) {
      return NextResponse.json(
        { error: "privyUserId is required" },
        { status: 400 }
      );
    }

    const verificationKey = process.env.PRIVY_JWT_VERIFICATION_KEY;
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (verificationKey) {
      if (!accessToken) {
        return NextResponse.json(
          { error: "Missing Privy access token" },
          { status: 401 }
        );
      }

      const verifiedToken = await verifyPrivyAccessToken(accessToken);
      if (verifiedToken.user_id !== privyUserId) {
        return NextResponse.json(
          { error: "Unauthorized wallet request" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(await ensurePrivyEthereumWallet(privyUserId));
  } catch (error: unknown) {
    if (error instanceof InvalidAuthTokenError) {
      return NextResponse.json(
        { error: "Invalid Privy access token" },
        { status: 401 }
      );
    }

    console.error("Wallet error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get wallet",
      },
      { status: 500 }
    );
  }
}
