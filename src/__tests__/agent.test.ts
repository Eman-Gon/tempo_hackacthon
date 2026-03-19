jest.mock("@privy-io/node", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    wallets: () => ({
      ethereum: () => ({
        signMessage: jest.fn().mockResolvedValue({ signature: "0xsig" }),
        signSecp256k1: jest.fn().mockResolvedValue({ signature: "0xsig" }),
        signTypedData: jest.fn().mockResolvedValue({ signature: "0xsig" }),
      }),
      create: jest.fn(),
    }),
    users: () => ({ get: jest.fn() }),
  })),
}));

const mockFetch = jest.fn();
jest.mock("mppx/client", () => ({
  Mppx: {
    create: jest.fn().mockReturnValue({
      fetch: mockFetch,
    }),
  },
  tempo: jest.fn().mockReturnValue([]),
}));

import { runAgent, AgentEvent } from "@/lib/agent";

// Helper: create a mock JSON response
function jsonResponse(data: any) {
  return { json: () => Promise.resolve(data), ok: true };
}

describe("runAgent", () => {
  const walletId = "test-wallet";
  const address = "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("emits search event first", async () => {
    const events: AgentEvent[] = [];

    // Exa search - no results
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    // Perplexity scoring
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "[]" } }] })
    );

    await runAgent("Senior Engineer", walletId, address, (e) => events.push(e));
    expect(events[0].type).toBe("search");
    expect(events[0].message).toContain("Searching");
  });

  it("returns empty array when no search results", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "[]" } }] })
    );

    const results = await runAgent("Senior Engineer", walletId, address, () => {});
    expect(results).toEqual([]);
  });

  it("processes candidates from search results", async () => {
    const events: AgentEvent[] = [];

    // 1. Exa search
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title: "Jane Doe - Senior Engineer",
            url: "https://linkedin.com/in/jane",
            text: "Experienced engineer with 5 years",
            author: "TechCorp",
          },
        ],
      })
    );

    // 2. StableEnrich
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ title: "Senior Engineer", company: "TechCorp" })
    );

    // 3. Clado LinkedIn research (url contains linkedin.com)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ title: "Senior Engineer", company: "TechCorp" })
    );

    // 4. Browserbase fetch
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: "Jane Doe is a senior engineer at TechCorp" })
    );

    // 5. Perplexity scoring
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content:
                '[{"name":"Jane Doe","score":85,"reasoning":"Strong fit","skills":90,"experience":80,"education":75,"relevance":85}]',
            },
          },
        ],
      })
    );

    // 6. Hunter email-finder
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { email: "jane@techcorp.com", verification: { status: "valid" } } })
    );

    // 7. Hunter email-verifier
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { status: "valid" } })
    );

    // 8. StableEmail outreach
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    const results = await runAgent(
      "Senior Engineer",
      walletId,
      address,
      (e) => events.push(e)
    );

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Jane Doe");
    expect(results[0].score).toBe(85);
    expect(results[0].reasoning).toBe("Strong fit");
    expect(results[0].email).toBe("jane@techcorp.com");
  });

  it("emits spend events with costs", async () => {
    const events: AgentEvent[] = [];

    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "[]" } }] })
    );

    await runAgent("Engineer", walletId, address, (e) => events.push(e));

    const spendEvents = events.filter((e) => e.type === "spend");
    expect(spendEvents.length).toBeGreaterThan(0);
    spendEvents.forEach((e) => {
      expect(e.cost).toBeDefined();
      expect(e.cost).toBeGreaterThan(0);
    });
  });

  it("emits complete event with candidate data", async () => {
    const events: AgentEvent[] = [];

    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "[]" } }] })
    );

    await runAgent("Engineer", walletId, address, (e) => events.push(e));

    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents.length).toBe(1);
    expect(completeEvents[0].data).toBeDefined();
  });
});
