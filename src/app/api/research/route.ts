import { NextRequest, NextResponse } from "next/server";
import { runAgent, AgentEvent } from "@/lib/agent";

export async function POST(req: NextRequest) {
  try {
    const { jobDescription, walletId, address } = await req.json();

    if (!jobDescription || !walletId || !address) {
      return NextResponse.json(
        { error: "jobDescription, walletId, and address are required" },
        { status: 400 }
      );
    }

    const events: AgentEvent[] = [];

    const candidates = await runAgent(
      jobDescription,
      walletId,
      address as `0x${string}`,
      (event) => {
        events.push(event);
      }
    );

    const totalCost = events
      .filter((e) => e.type === "spend")
      .reduce((sum, e) => sum + (e.cost || 0), 0);

    return NextResponse.json({
      candidates,
      events,
      totalCost,
    });
  } catch (error: any) {
    console.error("Research error:", error);
    return NextResponse.json(
      { error: error.message || "Research failed" },
      { status: 500 }
    );
  }
}
