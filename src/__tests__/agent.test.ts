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

function jsonResponse(data: any) {
  return { json: () => Promise.resolve(data), ok: true };
}

// The new algorithm flow:
// 1. Perplexity: generate 5 queries
// 2. Exa x5: parallel searches
// 3. Perplexity: pass 1 scoring
// 4. StableEnrich per top-8 candidate
// 5. Clado per candidate with linkedin URL
// 6. Browserbase per candidate
// 7. Hunter per top-5 candidate
// 8. StableEmail for high-scorers with verified email

/** Mock the query generation step (returns 2 queries for simplicity) */
function mockQueryGeneration() {
  mockFetch.mockResolvedValueOnce(
    jsonResponse({
      choices: [
        {
          message: {
            content: '["senior engineer linkedin", "react developer github"]',
          },
        },
      ],
    })
  );
}

/** Mock N parallel Exa searches returning empty results */
function mockEmptySearches(count: number) {
  for (let i = 0; i < count; i++) {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
  }
}

/** Mock pass 1 scoring with empty results */
function mockEmptyScoring() {
  mockFetch.mockResolvedValueOnce(
    jsonResponse({ choices: [{ message: { content: "[]" } }] })
  );
}

describe("runAgent", () => {
  const walletId = "test-wallet";
  const address =
    "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("emits search event first", async () => {
    const events: AgentEvent[] = [];

    mockQueryGeneration();
    mockEmptySearches(2);
    mockEmptyScoring();

    await runAgent("Senior Engineer", walletId, address, (e) =>
      events.push(e)
    );
    expect(events[0].type).toBe("search");
    expect(events[0].message).toContain("Generating");
  });

  it("returns empty array when no search results", async () => {
    mockQueryGeneration();
    mockEmptySearches(2);
    mockEmptyScoring();

    const results = await runAgent(
      "Senior Engineer",
      walletId,
      address,
      () => {}
    );
    expect(results).toEqual([]);
  });

  it("processes candidates through two-pass pipeline", async () => {
    const events: AgentEvent[] = [];

    // 1. Query generation
    mockQueryGeneration();

    // 2. Exa search #1 returns a candidate
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title: "Jane Doe - Senior Engineer",
            url: "https://linkedin.com/in/jane-doe",
            text: "Experienced engineer with 5 years at TechCorp",
            author: "TechCorp",
          },
        ],
      })
    );

    // 2. Exa search #2 returns another (and a duplicate)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title: "Jane Doe - Senior Engineer",
            url: "https://linkedin.com/in/jane-doe",
            text: "Experienced engineer",
            author: "TechCorp",
          },
          {
            title: "Bob Smith - Frontend Dev",
            url: "https://github.com/bobsmith",
            text: "React developer with portfolio",
            author: "StartupX",
          },
        ],
      })
    );

    // 3. Pass 1 scoring
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content:
                '[{"name":"Jane Doe","score":85,"reasoning":"Strong fit","skills":35,"experience":22,"location":12,"activity":16},{"name":"Bob Smith","score":65,"reasoning":"Decent match","skills":28,"experience":15,"location":10,"activity":12}]',
            },
          },
        ],
      })
    );

    // 4. Pass 2: StableEnrich for Jane
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ title: "Senior Engineer", company: "TechCorp" })
    );
    // 4. Clado for Jane (has linkedin URL)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ title: "Senior Engineer", company: "TechCorp" })
    );
    // 4. Browserbase for Jane
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        content: "Jane Doe is a senior engineer at TechCorp",
      })
    );

    // 4. StableEnrich for Bob
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ title: "Frontend Dev", company: "StartupX" })
    );
    // 4. Browserbase for Bob (no linkedin, no Clado)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: "Bob Smith React developer" })
    );

    // 5. Hunter for Jane
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          email: "jane@techcorp.com",
          verification: { status: "valid" },
        },
      })
    );
    // 5. Hunter for Bob
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          email: "bob@startupx.com",
          verification: { status: "valid" },
        },
      })
    );

    // 6. StableEmail outreach for Jane (score >= 70)
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    const results = await runAgent("Senior Engineer", walletId, address, (e) =>
      events.push(e)
    );

    // Jane should be deduped (appeared in both searches)
    expect(results.length).toBe(2);
    expect(results[0].name).toBe("Jane Doe");
    expect(results[0].score).toBe(85);
    expect(results[0].scoreBreakdown.skills).toBe(35);
    expect(results[0].scoreBreakdown.location).toBe(12);
    expect(results[0].scoreBreakdown.activity).toBe(16);
    expect(results[0].email).toBe("jane@techcorp.com");
    expect(results[1].name).toBe("Bob Smith");
  });

  it("deduplicates candidates by URL across queries", async () => {
    mockQueryGeneration();

    // Both searches return the same person
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title: "Alice Chen - Engineer",
            url: "https://linkedin.com/in/alice-chen",
            text: "Full-stack dev",
          },
        ],
      })
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title: "Alice Chen - Engineer",
            url: "https://linkedin.com/in/alice-chen/",
            text: "Full-stack developer",
          },
        ],
      })
    );

    // Pass 1 scoring
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content:
                '[{"name":"Alice Chen","score":70,"reasoning":"Good","skills":30,"experience":18,"location":10,"activity":12}]',
            },
          },
        ],
      })
    );

    // Pass 2: StableEnrich, Clado, Browserbase
    mockFetch.mockResolvedValueOnce(jsonResponse({ title: "Engineer" }));
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    mockFetch.mockResolvedValueOnce(jsonResponse({ content: "" }));

    // Hunter
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: null }));

    const results = await runAgent("Engineer", walletId, address, () => {});

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Alice Chen");
  });

  it("filters out LinkedIn posts and keeps profiles", async () => {
    mockQueryGeneration();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title: "Dana Park - Designer",
            url: "https://linkedin.com/in/dana-park",
            text: "UX designer",
          },
          {
            title: "Someone's Post",
            url: "https://linkedin.com/posts/someone-activity-12345",
            text: "Just got promoted",
          },
          {
            title: "Corp Page",
            url: "https://linkedin.com/company/corp",
            text: "We are hiring",
          },
        ],
      })
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));

    // Pass 1 scoring
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content:
                '[{"name":"Dana Park","score":60,"reasoning":"OK","skills":25,"experience":15,"location":8,"activity":12}]',
            },
          },
        ],
      })
    );

    // Pass 2: StableEnrich, Clado, Browserbase
    mockFetch.mockResolvedValueOnce(jsonResponse({ title: "Designer" }));
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    mockFetch.mockResolvedValueOnce(jsonResponse({ content: "" }));

    // Hunter
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: null }));

    const results = await runAgent("Designer", walletId, address, () => {});

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Dana Park");
  });

  it("emits spend events with costs", async () => {
    const events: AgentEvent[] = [];

    mockQueryGeneration();
    mockEmptySearches(2);
    mockEmptyScoring();

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

    mockQueryGeneration();
    mockEmptySearches(2);
    mockEmptyScoring();

    await runAgent("Engineer", walletId, address, (e) => events.push(e));

    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents.length).toBe(1);
    expect(completeEvents[0].data).toBeDefined();
  });

  it("uses fallback queries when AI generation fails", async () => {
    // Return garbage instead of JSON
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: "I cannot generate queries" } }],
      })
    );

    // 3 fallback queries, each returning empty
    mockEmptySearches(3);
    mockEmptyScoring();

    const results = await runAgent("Engineer", walletId, address, () => {});
    expect(results).toEqual([]);
  });

  it("skips names that are too long", async () => {
    mockQueryGeneration();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            title:
              "I earned a 3.9+ GPA in Computer Science from Stanford University and graduated with honors and distinction",
            url: "https://linkedin.com/in/some-profile",
            text: "Some text",
          },
          {
            title: "Sam Wilson - Engineer",
            url: "https://linkedin.com/in/sam-wilson",
            text: "Backend engineer at Acme",
            author: "Acme",
          },
        ],
      })
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));

    // Pass 1 scoring
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content:
                '[{"name":"Sam Wilson","score":65,"reasoning":"OK","skills":26,"experience":16,"location":10,"activity":13}]',
            },
          },
        ],
      })
    );

    // Pass 2: StableEnrich, Clado, Browserbase
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ title: "Engineer", company: "Acme" })
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    mockFetch.mockResolvedValueOnce(jsonResponse({ content: "" }));

    // Hunter
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          email: "sam@acme.com",
          verification: { status: "valid" },
        },
      })
    );

    const results = await runAgent("Engineer", walletId, address, () => {});

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Sam Wilson");
  });
});
