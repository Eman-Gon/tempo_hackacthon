import { NextRequest } from "next/server";
import { runAgent, AgentEvent } from "@/lib/agent";
import { createMppxClient } from "@/lib/mppx";

async function chargeSearchFee(
  request: NextRequest,
  walletId: string,
  address: `0x${string}`
) {
  const mppx = createMppxClient(walletId, address);
  const feeUrl = new URL("/api/pay/search-fee", request.url).toString();

  const response = await mppx.fetch(feeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletId }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Search fee payment failed");
  }
}

export async function POST(req: NextRequest) {
  const { jobDescription, walletId, address } = await req.json();

  if (!jobDescription || !walletId || !address) {
    return new Response(
      JSON.stringify({
        error: "jobDescription, walletId, and address are required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await chargeSearchFee(req, walletId, address as `0x${string}`);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Search fee payment failed";
    const status = message.includes("InsufficientBalance") ? 402 : 500;

    return new Response(
      JSON.stringify({
        error: message,
      }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const candidates = await runAgent(
          jobDescription,
          walletId,
          address as `0x${string}`,
          (event: AgentEvent) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
        );

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "complete", data: candidates })}\n\n`
          )
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Research stream failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
