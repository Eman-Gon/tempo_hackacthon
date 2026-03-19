jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({})),
}));

import { POST } from "@/app/api/wallet/route";
import { NextRequest } from "next/server";

function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/wallet", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/wallet", () => {
  it("returns 400 when privyUserId is missing", async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("privyUserId is required");
  });

  it("returns the hardcoded funded wallet", async () => {
    const req = createRequest({ privyUserId: "did:privy:user-123" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.walletId).toBe("js13iejxuggh7hr4oay0eodi");
    expect(data.address).toBe("0x52207fb0B18D48E4f4F69f8AeB63FC1e4fCc2FE1");
  });
});
