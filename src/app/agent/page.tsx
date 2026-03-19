"use client";

export const dynamic = "force-dynamic";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";

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

export default function AgentPage() {
  const { authenticated, ready, user, logout } = usePrivy();
  const router = useRouter();

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
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  // Create/fetch wallet on mount
  useEffect(() => {
    if (!user?.id) return;

    fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyUserId: user.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.walletId) setWalletInfo(data);
        else setError("Failed to create wallet");
      })
      .catch(() => setError("Failed to create wallet"));
  }, [user?.id]);

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
            setEvents((prev) => [...prev, event]);

            if (event.cost) {
              setTotalSpent((prev) => prev + event.cost!);
            }

            if (event.type === "complete" && event.data) {
              setCandidates(event.data);
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsRunning(false);
    }
  }, [walletInfo, jobDescription]);

  if (!ready) return <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>;

  return (
    <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          HireAgent
        </h1>
        <div className="flex items-center gap-4">
          {walletInfo && (
            <span className="text-xs text-gray-500 font-mono">
              {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
            </span>
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
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

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-200">
            Candidates
            {candidates.length > 0 && (
              <span className="text-gray-500 font-normal ml-2">
                ({candidates.length})
              </span>
            )}
          </h2>

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
                      <div
                        className={`text-lg font-bold ${
                          candidate.score >= 80
                            ? "text-green-400"
                            : candidate.score >= 60
                              ? "text-yellow-400"
                              : "text-gray-500"
                        }`}
                      >
                        {candidate.score}
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
                            LinkedIn →
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
