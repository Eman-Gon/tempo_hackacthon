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

import { runAgent, AgentEvent, CandidateResult } from "@/lib/agent";

describe("runAgent", () => {
  const walletId = "test-wallet";
  const address = "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("emits search event first", async () => {
    const events: AgentEvent[] = [];

    // Mock Exa search
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ results: [] }),
    });
    // Mock Perplexity scoring
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "[]" } }],
        }),
    });

    await runAgent("Senior Engineer", walletId, address, (e) => events.push(e));

    expect(events[0].type).toBe("search");
    expect(events[0].message).toContain("Searching");
  });

  it("returns empty array when no search results", async () => {
    // Mock Exa search - no results
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ results: [] }),
    });
    // Mock Perplexity scoring
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "[]" } }],
        }),
    });

    const results = await runAgent(
      "Senior Engineer",
      walletId,
      address,
      () => {}
    );

    expect(results).toEqual([]);
  });

  it("processes candidates from search results", async () => {
    const events: AgentEvent[] = [];

    // Mock Exa search
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          results: [
            {
              title: "Jane Doe - Senior Engineer",
              url: "https://example.com/jane",
              text: "Experienced engineer",
              author: "TechCorp",
            },
          ],
        }),
    });

    // Mock StableEnrich
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          title: "Senior Engineer",
          company: "TechCorp",
        }),
    });

    // Mock Perplexity scoring
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: '[{"name": "Jane Doe", "score": 85}]',
              },
            },
          ],
        }),
    });

    const results = await runAgent(
      "Senior Engineer",
      walletId,
      address,
      (e) => events.push(e)
    );

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Jane Doe");
    expect(results[0].score).toBe(85);
  });

  it("emits spend events with costs", async () => {
    const events: AgentEvent[] = [];

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ results: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "[]" } }],
        }),
    });

    await runAgent("Engineer", walletId, address, (e) => events.push(e));

    const spendEvents = events.filter((e) => e.type === "spend");
    expect(spendEvents.length).toBeGreaterThan(0);
    spendEvents.forEach((e) => {
      expect(e.cost).toBeDefined();
      expect(e.cost).toBeGreaterThan(0);
    });
  });

  it("emits error event on failure", async () => {
    const events: AgentEvent[] = [];

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      runAgent("Engineer", walletId, address, (e) => events.push(e))
    ).rejects.toThrow("Network error");

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents.length).toBe(1);
  });

  it("emits complete event with candidate data", async () => {
    const events: AgentEvent[] = [];

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ results: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "[]" } }],
        }),
    });

    await runAgent("Engineer", walletId, address, (e) => events.push(e));

    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents.length).toBe(1);
    expect(completeEvents[0].data).toBeDefined();
  });
});
