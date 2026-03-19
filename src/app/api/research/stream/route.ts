import { NextRequest } from "next/server";
import { runAgent, AgentEvent } from "@/lib/agent";

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
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`
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
