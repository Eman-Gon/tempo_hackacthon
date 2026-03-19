import { createMppxClient } from "./mppx";

export interface CandidateResult {
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  summary: string;
  score: number;
  sources: string[];
}

export interface AgentEvent {
  type: "search" | "enrich" | "analyze" | "complete" | "error" | "spend";
  message: string;
  data?: any;
  cost?: number;
}

async function searchCandidates(
  mppFetch: typeof fetch,
  query: string
): Promise<any[]> {
  const response = await mppFetch("https://exa.mpp.tempo.xyz/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      num_results: 10,
      type: "neural",
      use_autoprompt: true,
      contents: { text: { max_characters: 1000 } },
    }),
  });
  const data = await response.json();
  return data.results || [];
}

async function enrichPerson(
  mppFetch: typeof fetch,
  name: string,
  company?: string
): Promise<any> {
  const response = await mppFetch(
    "https://stableenrich.dev/api/v1/people/enrich",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, company }),
    }
  );
  return response.json();
}

async function deepLinkedInResearch(
  mppFetch: typeof fetch,
  linkedinUrl: string
): Promise<any> {
  const response = await mppFetch(
    "https://clado.mpp.paywithlocus.com/api/research",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: linkedinUrl }),
    }
  );
  return response.json();
}

async function aiSummary(
  mppFetch: typeof fetch,
  prompt: string
): Promise<string> {
  const response = await mppFetch(
    "https://perplexity.mpp.paywithlocus.com/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function runAgent(
  jobDescription: string,
  walletId: string,
  address: `0x${string}`,
  onEvent: (event: AgentEvent) => void
): Promise<CandidateResult[]> {
  const mppx = createMppxClient(walletId, address);
  const mppFetch = mppx.fetch.bind(mppx) as typeof fetch;

  try {
    // Step 1: Search for candidates
    onEvent({
      type: "search",
      message: "Searching for candidates matching job description...",
    });

    const searchQuery = `professionals matching: ${jobDescription}`;
    const searchResults = await searchCandidates(mppFetch, searchQuery);
    onEvent({
      type: "spend",
      message: `Found ${searchResults.length} potential candidates via Exa`,
      cost: 0.01,
    });

    // Step 2: Enrich top candidates
    const candidates: CandidateResult[] = [];
    for (const result of searchResults.slice(0, 5)) {
      const name =
        result.title?.split(/[-|–]/)[0]?.trim() || result.title || "Unknown";

      onEvent({
        type: "enrich",
        message: `Enriching profile: ${name}`,
      });

      let enriched: any = {};
      try {
        enriched = await enrichPerson(mppFetch, name);
        onEvent({
          type: "spend",
          message: `Enriched ${name} via StableEnrich`,
          cost: 0.02,
        });
      } catch {
        // enrichment may fail for some candidates
      }

      // Step 3: LinkedIn deep research if URL found
      let linkedinData: any = {};
      const linkedinUrl =
        enriched.linkedin_url || result.url?.includes("linkedin.com")
          ? result.url
          : null;

      if (linkedinUrl) {
        try {
          onEvent({
            type: "enrich",
            message: `Deep LinkedIn research: ${name}`,
          });
          linkedinData = await deepLinkedInResearch(mppFetch, linkedinUrl);
          onEvent({
            type: "spend",
            message: `LinkedIn research complete for ${name}`,
            cost: 0.05,
          });
        } catch {
          // LinkedIn research may fail
        }
      }

      candidates.push({
        name,
        title: enriched.title || linkedinData.title || "N/A",
        company:
          enriched.company || linkedinData.company || result.author || "N/A",
        linkedinUrl: linkedinUrl || undefined,
        summary: result.text || enriched.bio || "",
        score: 0,
        sources: [result.url, linkedinUrl].filter(Boolean),
      });
    }

    // Step 4: AI scoring
    onEvent({
      type: "analyze",
      message: "Scoring and ranking candidates with AI...",
    });

    const scoringPrompt = `Given this job description:
${jobDescription}

Score these candidates from 0-100 based on fit. Return JSON array with "name" and "score" fields only.

Candidates:
${candidates.map((c) => `- ${c.name}: ${c.title} at ${c.company}. ${c.summary}`).join("\n")}`;

    const scoringResult = await aiSummary(mppFetch, scoringPrompt);
    onEvent({
      type: "spend",
      message: "AI scoring complete via Perplexity",
      cost: 0.03,
    });

    // Parse scores
    try {
      const jsonMatch = scoringResult.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]) as {
          name: string;
          score: number;
        }[];
        for (const s of scores) {
          const candidate = candidates.find(
            (c) => c.name.toLowerCase() === s.name.toLowerCase()
          );
          if (candidate) candidate.score = s.score;
        }
      }
    } catch {
      // fallback: assign sequential scores
      candidates.forEach((c, i) => (c.score = 100 - i * 15));
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    onEvent({
      type: "complete",
      message: `Found and scored ${candidates.length} candidates`,
      data: candidates,
    });

    return candidates;
  } catch (error: any) {
    onEvent({
      type: "error",
      message: error.message || "Agent encountered an error",
    });
    throw error;
  }
}
