import { createMppxClient } from "./mppx";

function stripMarkdown(text: string): string {
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/#{1,6}\s?/g, "")
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`{1,3}.*?`{1,3}/g, "")
    .replace(/[-*]\s/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isLinkedInProfile(url: string): boolean {
  return /linkedin\.com\/in\/[^/]+\/?$/.test(url);
}

function parseName(title: string): string {
  const rawName = title?.split(/[-|–—]/)[0]?.trim() || title || "Unknown";
  return (
    rawName
      .replace(/\s*[\|·]\s*.*/g, "")
      .replace(/\s*(Profile|Resume|CV|Freelancer|Prog\.AI|getprog).*$/i, "")
      .replace(/['']s Post$/i, "")
      .trim() || rawName
  );
}

export interface CandidateResult {
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  email?: string;
  emailVerified?: boolean;
  outreachSent?: boolean;
  summary: string;
  score: number;
  reasoning: string;
  scoreBreakdown: {
    skills: number;
    experience: number;
    location: number;
    activity: number;
  };
  sources: string[];
}

export interface AgentEvent {
  type: "search" | "enrich" | "analyze" | "contact" | "complete" | "error" | "spend";
  message: string;
  data?: any;
  cost?: number;
}

/* ---- API helpers ---- */

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

async function fetchPage(
  mppFetch: typeof fetch,
  url: string
): Promise<string> {
  try {
    const response = await mppFetch("https://mpp.browserbase.com/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    return data.content || "";
  } catch {
    return "";
  }
}

async function findEmail(
  mppFetch: typeof fetch,
  name: string,
  company: string
): Promise<{ email: string; verified: boolean } | null> {
  try {
    const nameParts = name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const response = await mppFetch(
      "https://hunter.mpp.paywithlocus.com/hunter/email-finder",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          company,
        }),
      }
    );
    const data = await response.json();
    if (data.data?.email) {
      return {
        email: data.data.email,
        verified: data.data.verification?.status === "valid",
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function sendOutreach(
  mppFetch: typeof fetch,
  to: string,
  candidateName: string,
  jobDescription: string
): Promise<boolean> {
  try {
    const response = await mppFetch("https://stableemail.dev/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [to],
        subject: `Exciting opportunity: ${jobDescription.slice(0, 60)}`,
        text: `Hi ${candidateName.split(" ")[0]},\n\nI came across your profile and was impressed by your background. We have an exciting opportunity that aligns well with your experience:\n\n${jobDescription.slice(0, 300)}\n\nWould you be open to a quick conversation to learn more?\n\nBest regards,\nHireAgent`,
        html: `<p>Hi ${candidateName.split(" ")[0]},</p><p>I came across your profile and was impressed by your background. We have an exciting opportunity that aligns well with your experience:</p><p><em>${jobDescription.slice(0, 300)}</em></p><p>Would you be open to a quick conversation to learn more?</p><p>Best regards,<br/>HireAgent</p>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function aiCall(
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

const SEARCH_DELAY = process.env.NODE_ENV === "test" ? 0 : 3000;
const MAX_RETRIES = 2;

/* ---- Main agent ---- */

export async function runAgent(
  jobDescription: string,
  walletId: string,
  address: `0x${string}`,
  onEvent: (event: AgentEvent) => void
): Promise<CandidateResult[]> {
  const mppx = createMppxClient(walletId, address);
  const mppFetch = mppx.fetch.bind(mppx) as typeof fetch;

  try {
    // ============================================================
    // STEP 1: Generate 5 targeted search queries with AI
    // ============================================================
    onEvent({
      type: "search",
      message: "Generating targeted search queries with AI...",
    });

    const queryGenPrompt = `You are a technical recruiter. Given this job description, generate exactly 3 diverse search queries to find matching candidates across DIFFERENT platforms. Do NOT put all queries on LinkedIn. Spread across: personal portfolio sites, GitHub profiles, tech blogs, company team pages, conference speaker pages, etc.

Query 1: Target LinkedIn profiles
Query 2: Target GitHub profiles or personal portfolio sites
Query 3: Target blog posts, conference talks, or team pages

Job description:
${jobDescription}

Return ONLY a JSON array of 3 strings, no other text. Example:
["senior React engineer San Francisco site:linkedin.com/in", "React TypeScript developer portfolio github.com", "frontend engineer speaker talk blog React"]`;

    const queryResult = await aiCall(mppFetch, queryGenPrompt);
    onEvent({
      type: "spend",
      message: "Generated search queries via Perplexity",
      cost: 0.03,
    });

    let queries: string[] = [];
    try {
      const jsonMatch = queryResult.match(/\[[\s\S]*\]/);
      if (jsonMatch) queries = JSON.parse(jsonMatch[0]);
    } catch {
      // fallback
    }
    // Ensure we always have queries
    if (!queries.length || queries.length < 2) {
      queries = [
        `site:linkedin.com/in/ ${jobDescription}`,
        `${jobDescription} engineer github.com portfolio`,
        `${jobDescription} developer open to work linkedin`,
      ];
    }

    // ============================================================
    // STEP 2: Run all queries in parallel, deduplicate by URL
    // ============================================================
    onEvent({
      type: "search",
      message: `Running ${queries.length} search queries in parallel...`,
    });

    // Run searches sequentially with delay + retry to avoid RPC rate limits
    const allResults: any[][] = [];
    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, SEARCH_DELAY));

      let results: any[] = [];
      let succeeded = false;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const backoff = SEARCH_DELAY * (attempt + 1);
            onEvent({
              type: "search",
              message: `Retrying Exa search ${i + 1} (attempt ${attempt + 1})...`,
            });
            await new Promise((r) => setTimeout(r, backoff));
          }
          results = await searchCandidates(mppFetch, queries[i]);
          succeeded = true;
          break;
        } catch {
          // retry
        }
      }

      if (succeeded) {
        allResults.push(results);
        onEvent({
          type: "spend",
          message: `Exa search ${i + 1}/${queries.length} complete (${results.length} results)`,
          cost: 0.01,
        });
      } else {
        allResults.push([]);
        onEvent({
          type: "search",
          message: `Exa search ${i + 1}/${queries.length} failed after retries, skipping`,
        });
      }
    }

    // Flatten and filter valid URLs
    const rawResults = allResults.flat().filter(
      (r: any) =>
        r.url &&
        (isLinkedInProfile(r.url) || !r.url.includes("linkedin.com"))
    );

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueResults: any[] = [];
    for (const r of rawResults) {
      const normalizedUrl = r.url.replace(/\/+$/, "").toLowerCase();
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueResults.push(r);
      }
    }

    onEvent({
      type: "search",
      message: `Found ${uniqueResults.length} unique candidates (from ${rawResults.length} total results)`,
    });

    // ============================================================
    // STEP 3: Parse names, deduplicate by name, build candidate list
    // ============================================================
    const seenNames = new Set<string>();
    const candidates: CandidateResult[] = [];

    for (const result of uniqueResults) {
      const name = parseName(result.title);
      if (name.length > 60 || name.split(" ").length > 6) continue;

      const nameLower = name.toLowerCase();
      if (seenNames.has(nameLower)) continue;
      seenNames.add(nameLower);

      const rawSummary = result.text || "";
      const linkedinUrl = isLinkedInProfile(result.url) ? result.url : undefined;

      candidates.push({
        name,
        title: "N/A",
        company: result.author?.replace(/\s*(Prog\.AI|getprog\.ai|Freelancer|LinkedIn).*$/i, "").trim() || "N/A",
        linkedinUrl,
        summary: stripMarkdown(rawSummary).slice(0, 500),
        score: 0,
        reasoning: "",
        scoreBreakdown: { skills: 0, experience: 0, location: 0, activity: 0 },
        sources: [result.url],
      });
    }

    // ============================================================
    // STEP 4: PASS 1 - Cheap AI scoring on Exa data only
    // ============================================================
    onEvent({
      type: "analyze",
      message: `Pass 1: Quick-scoring ${candidates.length} candidates with AI...`,
    });

    const pass1Prompt = `You are a technical recruiter scoring candidates against a job description.

JOB DESCRIPTION:
${jobDescription}

SCORING RUBRIC (100 points total):
- skills (max 40): Does their described stack/skills match the job requirements?
- experience (max 25): Years of experience, company quality, depth of work
- location (max 15): Are they likely in the right city/region or remote-friendly?
- activity (max 20): Recent signals like GitHub activity, "open to work", recent posts, job changes

For each candidate, return:
- "name": exact candidate name
- "score": total score 0-100 (sum of the 4 categories)
- "reasoning": 1-2 sentence explanation
- "skills": 0-40
- "experience": 0-25
- "location": 0-15
- "activity": 0-20

Return ONLY a JSON array, no other text.

CANDIDATES:
${candidates.map((c) => `- ${c.name} (${c.company}): ${c.summary.slice(0, 300)}`).join("\n")}`;

    const pass1Result = await aiCall(mppFetch, pass1Prompt);
    onEvent({
      type: "spend",
      message: "Pass 1 scoring complete via Perplexity",
      cost: 0.03,
    });

    // Apply pass 1 scores
    try {
      const jsonMatch = pass1Result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]) as {
          name: string;
          score: number;
          reasoning?: string;
          skills?: number;
          experience?: number;
          location?: number;
          activity?: number;
        }[];
        for (const s of scores) {
          const candidate = candidates.find(
            (c) =>
              c.name.toLowerCase() === s.name.toLowerCase() ||
              c.name.toLowerCase().includes(s.name.toLowerCase()) ||
              s.name.toLowerCase().includes(c.name.toLowerCase())
          );
          if (candidate) {
            candidate.score = s.score;
            candidate.reasoning = s.reasoning || "";
            candidate.scoreBreakdown = {
              skills: s.skills || 0,
              experience: s.experience || 0,
              location: s.location || 0,
              activity: s.activity || 0,
            };
          }
        }
      }
    } catch {
      // scoring parse failed
    }

    // Fallback scores for unmatched
    candidates.forEach((c, i) => {
      if (c.score === 0) {
        c.score = Math.max(50 - i * 5, 10);
        c.reasoning = "Score estimated. Insufficient data for AI analysis.";
        c.scoreBreakdown = {
          skills: Math.round(c.score * 0.4),
          experience: Math.round(c.score * 0.25),
          location: Math.round(c.score * 0.15),
          activity: Math.round(c.score * 0.2),
        };
      }
    });

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // ============================================================
    // STEP 5: PASS 2 - Deep enrichment on top 8 only
    // ============================================================
    const topCandidates = candidates.slice(0, 8);

    onEvent({
      type: "enrich",
      message: `Pass 2: Deep enrichment on top ${topCandidates.length} candidates...`,
    });

    for (const candidate of topCandidates) {
      // StableEnrich
      let enriched: any = {};
      try {
        onEvent({
          type: "enrich",
          message: `Enriching: ${candidate.name}`,
        });
        enriched = await enrichPerson(mppFetch, candidate.name, candidate.company !== "N/A" ? candidate.company : undefined);
        onEvent({
          type: "spend",
          message: `Enriched ${candidate.name} via StableEnrich`,
          cost: 0.02,
        });

        if (enriched.title) candidate.title = enriched.title;
        if (enriched.company) {
          candidate.company = enriched.company
            .replace(/\s*(Prog\.AI|getprog\.ai|Freelancer|LinkedIn).*$/i, "")
            .trim() || candidate.company;
        }
        if (enriched.bio && !candidate.summary) {
          candidate.summary = stripMarkdown(enriched.bio).slice(0, 500);
        }
        if (enriched.linkedin_url && !candidate.linkedinUrl) {
          candidate.linkedinUrl = enriched.linkedin_url;
        }
      } catch {
        // enrichment may fail
      }

      // Clado LinkedIn deep research
      if (candidate.linkedinUrl) {
        try {
          onEvent({
            type: "enrich",
            message: `Deep LinkedIn research: ${candidate.name}`,
          });
          const linkedinData = await deepLinkedInResearch(mppFetch, candidate.linkedinUrl);
          onEvent({
            type: "spend",
            message: `LinkedIn research complete for ${candidate.name} via Clado`,
            cost: 0.05,
          });

          if (linkedinData.title && candidate.title === "N/A") candidate.title = linkedinData.title;
          if (linkedinData.company && candidate.company === "N/A") {
            candidate.company = linkedinData.company;
          }
          if (linkedinData.summary && candidate.summary.length < 50) {
            candidate.summary = stripMarkdown(linkedinData.summary).slice(0, 500);
          }
        } catch {
          // LinkedIn research may fail
        }
      }

      // Browserbase page scrape
      const sourceUrl = candidate.sources[0];
      if (sourceUrl) {
        try {
          onEvent({
            type: "enrich",
            message: `Scraping profile: ${candidate.name}`,
          });
          const pageContent = await fetchPage(mppFetch, sourceUrl);
          onEvent({
            type: "spend",
            message: `Scraped page for ${candidate.name} via Browserbase`,
            cost: 0.01,
          });

          if (pageContent && candidate.summary.length < 50) {
            candidate.summary = stripMarkdown(pageContent).slice(0, 500);
          }
        } catch {
          // page fetch may fail
        }
      }
    }

    // ============================================================
    // STEP 6: Find emails for top 5 via Hunter
    // ============================================================
    const emailCandidates = candidates.slice(0, 5);

    for (const candidate of emailCandidates) {
      if (candidate.company === "N/A") continue;

      onEvent({
        type: "contact",
        message: `Finding email for ${candidate.name}...`,
      });

      const emailResult = await findEmail(mppFetch, candidate.name, candidate.company);
      if (emailResult) {
        candidate.email = emailResult.email;
        candidate.emailVerified = emailResult.verified;
        onEvent({
          type: "spend",
          message: `Found email for ${candidate.name}${emailResult.verified ? " (verified)" : ""} via Hunter`,
          cost: 0.01,
        });
      }
    }

    // ============================================================
    // STEP 7: Send outreach to top candidates with verified emails
    // ============================================================
    for (const candidate of candidates.filter(
      (c) => c.score >= 70 && c.email && c.emailVerified
    )) {
      onEvent({
        type: "contact",
        message: `Sending outreach to ${candidate.name}...`,
      });

      const sent = await sendOutreach(
        mppFetch,
        candidate.email!,
        candidate.name,
        jobDescription
      );
      if (sent) {
        candidate.outreachSent = true;
        onEvent({
          type: "spend",
          message: `Outreach sent to ${candidate.name}`,
          cost: 0.02,
        });
      }
    }

    onEvent({
      type: "complete",
      message: `Found ${candidates.length} candidates, emailed ${candidates.filter((c) => c.outreachSent).length}`,
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
