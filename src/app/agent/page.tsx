"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";

interface AgentEvent {
  type: "search" | "enrich" | "analyze" | "contact" | "complete" | "error" | "spend";
  message: string;
  data?: any;
  cost?: number;
}

interface Candidate {
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
    education: number;
    relevance: number;
  };
  sources: string[];
}

// Friendly error messages
function friendlyError(raw: string): string {
  if (raw.includes("InsufficientBalance")) {
    const match = raw.match(/available: (\d+), required: (\d+)/);
    if (match) {
      const available = (parseInt(match[1]) / 1000000).toFixed(2);
      const required = (parseInt(match[2]) / 1000000).toFixed(4);
      return `Insufficient wallet balance. Available: $${available}, Required: $${required}. Please fund your wallet at wallet.tempo.xyz`;
    }
    return "Insufficient wallet balance. Please fund your wallet at wallet.tempo.xyz";
  }
  if (raw.includes("ECONNREFUSED") || raw.includes("fetch failed")) {
    return "Unable to reach the API service. Please try again in a moment.";
  }
  if (raw.includes("timeout") || raw.includes("ETIMEDOUT")) {
    return "Request timed out. The service may be temporarily busy — try again.";
  }
  if (raw.includes("429") || raw.includes("rate limit")) {
    return "Rate limited by an API service. Wait a few seconds and try again.";
  }
  if (raw.includes("502") || raw.includes("503")) {
    return "An API service is temporarily unavailable. Try again shortly.";
  }
  return raw;
}

export default function AgentPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [walletInfo, setWalletInfo] = useState<{
    walletId: string;
    address: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Compute cost breakdown from spend events
  const costBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const event of events) {
      if (event.type === "spend" && event.cost) {
        // Extract service name from message
        let service = "Other";
        if (event.message.includes("Exa")) service = "Exa";
        else if (event.message.includes("StableEnrich")) service = "StableEnrich";
        else if (event.message.includes("LinkedIn") || event.message.includes("Clado")) service = "Clado";
        else if (event.message.includes("Browserbase") || event.message.includes("Scraped")) service = "Browserbase";
        else if (event.message.includes("Perplexity") || event.message.includes("scoring")) service = "Perplexity";
        else if (event.message.includes("Hunter") || event.message.includes("email")) service = "Hunter";
        else if (event.message.includes("Outreach") || event.message.includes("outreach")) service = "StableEmail";
        breakdown[service] = (breakdown[service] || 0) + event.cost;
      }
    }
    return breakdown;
  }, [events]);

  // CSV export
  const exportCSV = useCallback(() => {
    if (candidates.length === 0) return;
    const headers = ["Name", "Title", "Company", "Score", "Reasoning", "Email", "Verified", "Outreach Sent", "LinkedIn", "Sources"];
    const rows = candidates.map((c) => [
      c.name,
      c.title,
      c.company,
      c.score.toString(),
      `"${(c.reasoning || "").replace(/"/g, '""')}"`,
      c.email || "",
      c.emailVerified ? "Yes" : "No",
      c.outreachSent ? "Yes" : "No",
      c.linkedinUrl || "",
      c.sources.join("; "),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hireagent-candidates-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [candidates]);

  // Fetch wallet on mount
  useEffect(() => {
    fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyUserId: "default" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.walletId) setWalletInfo(data);
        else setError("Failed to load wallet");
      })
      .catch(() => setError("Failed to load wallet"));
  }, []);

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const runResearch = useCallback(async () => {
    if (!walletInfo || !jobDescription.trim()) return;

    setIsRunning(true);
    setEvents([]);
    setCandidates([]);
    setTotalSpent(0);
    setError(null);
    setShowCostBreakdown(false);

    try {
      const response = await fetch("/api/research/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          walletId: walletInfo.walletId,
          address: walletInfo.address,
        }),
      });

      if (!response.ok) {
        throw new Error("Research request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as AgentEvent;

            // Friendly error messages
            if (event.type === "error") {
              event.message = friendlyError(event.message);
            }

            setEvents((prev) => [...prev, event]);

            if (event.cost) {
              setTotalSpent((prev) => prev + event.cost!);
            }

            if (event.type === "complete" && event.data) {
              setCandidates(event.data);
              setShowCostBreakdown(true);
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err: any) {
      setError(friendlyError(err.message || "Something went wrong"));
    } finally {
      setIsRunning(false);
    }
  }, [walletInfo, jobDescription]);

  if (!walletInfo && !error) return <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>;

  return (
    <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <a href="/" className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
          HireAgent
        </a>
        <div className="flex items-center gap-4">
          {walletInfo && (
            <span className="text-xs text-gray-500 font-mono">
              {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Left: Input + Events */}
        <div className="flex flex-col gap-6">
          {/* Job Description Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste a job description or describe the ideal candidate..."
              className="w-full h-40 bg-gray-900 border border-gray-800 rounded-lg p-4 text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isRunning}
            />
            <button
              onClick={runResearch}
              disabled={isRunning || !jobDescription.trim() || !walletInfo}
              className="mt-3 w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg font-medium transition-colors"
            >
              {isRunning ? "Researching..." : "Find Candidates"}
            </button>
          </div>

          {/* Spend Tracker */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">
                Live Spend
              </span>
              <span className="text-lg font-bold text-indigo-400">
                ${totalSpent.toFixed(4)}
              </span>
            </div>

            {/* Event Log */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.length === 0 && (
                <p className="text-gray-600 text-sm">
                  Events will appear here as the agent works...
                </p>
              )}
              {events.map((event, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      event.type === "search"
                        ? "bg-blue-400"
                        : event.type === "enrich"
                          ? "bg-green-400"
                          : event.type === "analyze"
                            ? "bg-yellow-400"
                            : event.type === "contact"
                              ? "bg-purple-400"
                              : event.type === "spend"
                                ? "bg-indigo-400"
                                : event.type === "error"
                                  ? "bg-red-400"
                                  : "bg-gray-400"
                    }`}
                  />
                  <span className="text-gray-400">{event.message}</span>
                  {event.cost && (
                    <span className="text-indigo-400 ml-auto flex-shrink-0">
                      -${event.cost.toFixed(4)}
                    </span>
                  )}
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          </div>

          {/* Cost Breakdown */}
          {showCostBreakdown && Object.keys(costBreakdown).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Cost Breakdown</span>
                <span className="text-sm font-bold text-indigo-400">${totalSpent.toFixed(4)} total</span>
              </div>
              <div className="space-y-2">
                {Object.entries(costBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([service, cost]) => {
                    const pct = totalSpent > 0 ? (cost / totalSpent) * 100 : 0;
                    return (
                      <div key={service} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-24">{service}</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-16 text-right">
                          ${cost.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
              <div className="font-medium mb-1">Something went wrong</div>
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">
              Candidates
              {candidates.length > 0 && (
                <span className="text-gray-500 font-normal ml-2">
                  ({candidates.length})
                </span>
              )}
            </h2>
            {candidates.length > 0 && (
              <button
                onClick={exportCSV}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Export CSV
              </button>
            )}
          </div>

          {candidates.length === 0 && !isRunning && (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <p>Results will appear here after research completes.</p>
            </div>
          )}

          {isRunning && candidates.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="space-y-4 overflow-y-auto">
            {candidates.map((candidate, i) => {
              const isExpanded = expandedCandidate === i;
              return (
                <div
                  key={i}
                  onClick={() => setExpandedCandidate(isExpanded ? null : i)}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-indigo-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {candidate.name}
                        </h3>
                        {candidate.outreachSent && (
                          <span className="text-[10px] bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">
                            Contacted
                          </span>
                        )}
                        {candidate.email && !candidate.outreachSent && (
                          <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">
                            Email Found
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {candidate.title} at {candidate.company}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Score ring */}
                      <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1f2937" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15.5" fill="none"
                            strokeWidth="3"
                            strokeDasharray={`${candidate.score * 0.975} 100`}
                            strokeLinecap="round"
                            className={
                              candidate.score >= 80
                                ? "stroke-green-500"
                                : candidate.score >= 60
                                  ? "stroke-yellow-500"
                                  : "stroke-gray-500"
                            }
                          />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                          candidate.score >= 80
                            ? "text-green-400"
                            : candidate.score >= 60
                              ? "text-yellow-400"
                              : "text-gray-500"
                        }`}>
                          {candidate.score}
                        </span>
                      </div>
                      <span className="text-gray-600 text-xs">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm text-gray-400 ${isExpanded ? "" : "line-clamp-3"}`}>
                    {candidate.summary}
                  </p>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
                      {/* AI Reasoning */}
                      {candidate.reasoning && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">AI Analysis</span>
                          <p className="text-sm text-gray-300 mt-1">{candidate.reasoning}</p>
                        </div>
                      )}

                      {/* Score Breakdown Chart */}
                      {candidate.scoreBreakdown && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Score Breakdown</span>
                          <div className="mt-2 space-y-2">
                            {(
                              [
                                ["Skills", candidate.scoreBreakdown.skills],
                                ["Experience", candidate.scoreBreakdown.experience],
                                ["Education", candidate.scoreBreakdown.education],
                                ["Relevance", candidate.scoreBreakdown.relevance],
                              ] as [string, number][]
                            ).map(([label, value]) => (
                              <div key={label} className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-20">{label}</span>
                                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      value >= 80
                                        ? "bg-green-500"
                                        : value >= 60
                                          ? "bg-yellow-500"
                                          : value >= 40
                                            ? "bg-orange-500"
                                            : "bg-red-500"
                                    }`}
                                    style={{ width: `${value}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8 text-right">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {candidate.title !== "N/A" && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Role</span>
                          <p className="text-sm text-gray-300">{candidate.title}</p>
                        </div>
                      )}
                      {candidate.company !== "N/A" && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Company</span>
                          <p className="text-sm text-gray-300">{candidate.company}</p>
                        </div>
                      )}
                      {candidate.sources.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Sources</span>
                          <div className="flex flex-col gap-1 mt-1">
                            {candidate.sources.map((url, j) => (
                              <a
                                key={j}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-indigo-400 hover:text-indigo-300 truncate"
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Email & Outreach Status */}
                      {candidate.email && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Email</span>
                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={`mailto:${candidate.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-indigo-400 hover:text-indigo-300"
                            >
                              {candidate.email}
                            </a>
                            {candidate.emailVerified && (
                              <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">
                                Verified
                              </span>
                            )}
                            {candidate.outreachSent && (
                              <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">
                                Outreach Sent
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-1">
                        {candidate.linkedinUrl && (
                          <a
                            href={candidate.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                          >
                            LinkedIn &#8594;
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
