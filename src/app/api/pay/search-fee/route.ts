import { Mppx, tempo } from "mppx/nextjs";

const SEARCH_FEE = process.env.SEARCH_FEE_AMOUNT ?? "0.70";
const RECIPIENT = process.env.MPP_RECIPIENT;
const SECRET_KEY = process.env.MPP_SECRET_KEY;
const CURRENCY =
  process.env.MPP_CURRENCY ?? "0x20c0000000000000000000000000000000000000";
const TESTNET = process.env.MPP_TESTNET !== "false";

function createFeeHandler() {
  if (!RECIPIENT) {
    throw new Error("MPP_RECIPIENT is not configured");
  }
  if (!SECRET_KEY) {
    throw new Error("MPP_SECRET_KEY is not configured");
  }

  return Mppx.create({
    methods: [
      tempo.charge({
        recipient: RECIPIENT as `0x${string}`,
        testnet: TESTNET,
      }),
    ],
    secretKey: SECRET_KEY,
  });
}

async function confirmFeePaid() {
  return Response.json({
    ok: true,
    amount: SEARCH_FEE,
  });
}

export const POST = async (request: Request) => {
  try {
    const payment = createFeeHandler();
    return payment.charge({
      amount: SEARCH_FEE,
      currency: CURRENCY,
      decimals: 6,
      recipient: RECIPIENT as `0x${string}`,
      description: "HireAgent search access fee",
    })(confirmFeePaid)(request);
  } catch (error: unknown) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Fee route configuration error",
      },
      { status: 500 }
    );
  }
};
