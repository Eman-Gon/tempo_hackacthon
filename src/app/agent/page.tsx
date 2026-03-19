"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface AgentEvent {
  type:
    | "search"
    | "enrich"
    | "analyze"
    | "contact"
    | "complete"
    | "error"
    | "spend";
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
  if (raw.includes("ECONNREFUSED") || raw.includes("fetch failed"))
    return "Unable to reach the API service. Please try again in a moment.";
  if (raw.includes("timeout") || raw.includes("ETIMEDOUT"))
    return "Request timed out. The service may be temporarily busy,try again.";
  if (raw.includes("429") || raw.includes("rate limit"))
    return "Rate limited by an API service. Wait a few seconds and try again.";
  if (raw.includes("502") || raw.includes("503"))
    return "An API service is temporarily unavailable. Try again shortly.";
  return raw;
}

/* ---------- tiny SVG icons (no dependency needed) ---------- */
const Icons = {
  home: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  wallet: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  ),
  bell: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  activity: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
};

/* ---------- Initials avatar ---------- */
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = [
    "bg-blue-100 text-blue-600",
    "bg-green-100 text-green-600",
    "bg-purple-100 text-purple-600",
    "bg-orange-100 text-orange-600",
    "bg-pink-100 text-pink-600",
    "bg-cyan-100 text-cyan-600",
  ];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={`${colors[idx]} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

/* ================================================================ */
export default function AgentPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [walletInfo, setWalletInfo] = useState<{ walletId: string; address: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [sidebarNav, setSidebarNav] = useState("search");
  const eventsEndRef = useRef<HTMLDivElement>(null);

  /* ---- derived data ---- */
  const costBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const event of events) {
      if (event.type === "spend" && event.cost) {
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

  const chartData = useMemo(
    () =>
      Object.entries(costBreakdown)
        .sort(([, a], [, b]) => b - a)
        .map(([service, cost]) => ({ service, cost: parseFloat(cost.toFixed(4)) })),
    [costBreakdown]
  );

  const topScore = candidates.length > 0 ? candidates[0].score : 0;
  const emailsFound = candidates.filter((c) => c.email).length;
  const contacted = candidates.filter((c) => c.outreachSent).length;

  /* ---- CSV export ---- */
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

  /* ---- fetch wallet on mount ---- */
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

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  /* ---- run research ---- */
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
      if (!response.ok) throw new Error("Research request failed");

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
            if (event.type === "error") event.message = friendlyError(event.message);
            setEvents((prev) => [...prev, event]);
            if (event.cost) setTotalSpent((prev) => prev + event.cost!);
            if (event.type === "complete" && event.data) setCandidates(event.data);
          } catch {
            /* skip malformed SSE */
          }
        }
      }
    } catch (err: any) {
      setError(friendlyError(err.message || "Something went wrong"));
    } finally {
      setIsRunning(false);
    }
  }, [walletInfo, jobDescription]);

  if (!walletInfo && !error)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );

  /* ============================================================ */
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f8f8]">
      {/* ---- LEFT SIDEBAR ---- */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100"
        >
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm">
            H
          </div>
          <span className="font-semibold text-[#1a1a1a] text-lg">HireAgent</span>
        </a>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { key: "home", icon: Icons.home, label: "Dashboard", href: "/" },
            { key: "search", icon: Icons.search, label: "Research", href: "#" },
            { key: "candidates", icon: Icons.users, label: "Candidates", href: "#" },
            { key: "analytics", icon: Icons.chart, label: "Analytics", href: "#" },
            { key: "activity", icon: Icons.activity, label: "Activity", href: "#" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSidebarNav(item.key);
                if (item.href !== "#") window.location.href = item.href;
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                sidebarNav === item.key
                  ? "bg-green-50 text-green-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-[#1a1a1a]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Wallet info at bottom */}
        {walletInfo && (
          <div className="px-4 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2.5">
              {Icons.wallet}
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#1a1a1a] truncate">
                  Wallet
                </div>
                <div className="text-[11px] text-gray-400 font-mono truncate">
                  {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ---- MAIN CONTENT ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP NAVBAR */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          {/* Search bar */}
          <div className="relative w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {Icons.search}
            </span>
            <input
              type="text"
              placeholder="Search candidates, roles..."
              className="w-full pl-10 pr-4 py-2 bg-[#f8f8f8] border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          {/* Right side */}
          <div className="flex items-center gap-4">
            <button className="relative text-gray-400 hover:text-[#1a1a1a] transition-colors">
              {Icons.bell}
              {events.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold text-sm">
              U
            </div>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ---- STAT CARDS ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Candidates Found",
                value: candidates.length,
                change: candidates.length > 0 ? `${candidates.length} new` : "-",
                positive: candidates.length > 0,
              },
              {
                label: "Top Score",
                value: topScore,
                change: topScore >= 80 ? "Excellent" : topScore >= 60 ? "Good" : "-",
                positive: topScore >= 60,
              },
              {
                label: "Emails Found",
                value: emailsFound,
                change:
                  candidates.length > 0
                    ? `${Math.round((emailsFound / candidates.length) * 100)}%`
                    : "-",
                positive: emailsFound > 0,
              },
              {
                label: "Total Spent",
                value: `$${totalSpent.toFixed(2)}`,
                change: `${Object.keys(costBreakdown).length} services`,
                positive: true,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
              >
                <div className="text-sm text-gray-500 mb-1">{stat.label}</div>
                <div className="text-2xl font-bold text-[#1a1a1a]">
                  {stat.value}
                </div>
                <div
                  className={`text-xs mt-1 font-medium ${
                    stat.positive ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {stat.change}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ---- LEFT COLUMN: Input + Chart + Activity ---- */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Job Description Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">
                  New Research
                </h3>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste a job description or describe the ideal candidate..."
                  className="w-full h-28 bg-[#f8f8f8] border border-gray-200 rounded-lg p-3 text-sm text-[#1a1a1a] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isRunning}
                />
                <button
                  onClick={runResearch}
                  disabled={isRunning || !jobDescription.trim() || !walletInfo}
                  className="mt-3 w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg font-medium text-white text-sm transition-colors shadow-sm"
                >
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Researching...
                    </span>
                  ) : (
                    "Find Candidates"
                  )}
                </button>
              </div>

              {/* Spend Chart */}
              {chartData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1a1a1a]">
                      Spend by Service
                    </h3>
                    <span className="text-xs text-gray-400">
                      ${totalSpent.toFixed(4)} total
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="service"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <Tooltip
                        formatter={(v) => [`$${Number(v).toFixed(4)}`, "Cost"]}
                        contentStyle={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="cost" fill="#16a34a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Activity Log */}
              {events.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">
                    Activity Log
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {events.map((event, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            event.type === "search"
                              ? "bg-blue-400"
                              : event.type === "enrich"
                                ? "bg-green-400"
                                : event.type === "analyze"
                                  ? "bg-amber-400"
                                  : event.type === "contact"
                                    ? "bg-purple-400"
                                    : event.type === "spend"
                                      ? "bg-emerald-400"
                                      : event.type === "error"
                                        ? "bg-red-400"
                                        : "bg-gray-300"
                          }`}
                        />
                        <span className="text-gray-600 leading-snug">
                          {event.message}
                        </span>
                        {event.cost && (
                          <span className="text-green-600 ml-auto flex-shrink-0 font-medium">
                            -${event.cost.toFixed(4)}
                          </span>
                        )}
                      </div>
                    ))}
                    <div ref={eventsEndRef} />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
                  <div className="font-medium text-red-700 mb-1">
                    Something went wrong
                  </div>
                  <div className="text-red-600">{error}</div>
                </div>
              )}
            </div>

            {/* ---- RIGHT COLUMN: Candidate List ---- */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-[#1a1a1a]">
                    Top Candidates
                  </h3>
                  {candidates.length > 0 && (
                    <button
                      onClick={exportCSV}
                      className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                    >
                      {Icons.download}
                      Export
                    </button>
                  )}
                </div>

                {candidates.length === 0 && !isRunning && (
                  <div className="px-5 py-12 text-center text-gray-400 text-sm">
                    Results will appear here after research completes.
                  </div>
                )}

                {isRunning && candidates.length === 0 && (
                  <div className="px-5 py-12 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Candidate rows */}
                <div className="divide-y divide-gray-100">
                  {candidates.map((candidate, i) => {
                    const isExpanded = expandedCandidate === i;
                    return (
                      <div
                        key={i}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() =>
                          setExpandedCandidate(isExpanded ? null : i)
                        }
                      >
                        {/* Row summary */}
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <Avatar name={candidate.name} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#1a1a1a] truncate">
                                {candidate.name}
                              </span>
                              {candidate.outreachSent && (
                                <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">
                                  Contacted
                                </span>
                              )}
                              {candidate.email && !candidate.outreachSent && (
                                <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                                  Email
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {candidate.title !== "N/A"
                                ? `${candidate.title}${candidate.company !== "N/A" ? ` · ${candidate.company}` : ""}`
                                : candidate.company !== "N/A"
                                  ? candidate.company
                                  : "-"}
                            </div>
                          </div>
                          {/* Score badge */}
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                              candidate.score >= 80
                                ? "bg-green-100 text-green-700"
                                : candidate.score >= 60
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {candidate.score}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-5 pb-4 space-y-3 border-t border-gray-50 pt-3">
                            {/* Summary */}
                            <p className="text-xs text-gray-500 leading-relaxed">
                              {candidate.summary || "No summary available."}
                            </p>

                            {/* AI reasoning */}
                            {candidate.reasoning && (
                              <div className="bg-green-50 rounded-lg p-3">
                                <div className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">
                                  AI Analysis
                                </div>
                                <p className="text-xs text-green-800">
                                  {candidate.reasoning}
                                </p>
                              </div>
                            )}

                            {/* Score breakdown bars */}
                            {candidate.scoreBreakdown && (
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                  Score Breakdown
                                </div>
                                {(
                                  [
                                    ["Skills", candidate.scoreBreakdown.skills],
                                    ["Experience", candidate.scoreBreakdown.experience],
                                    ["Education", candidate.scoreBreakdown.education],
                                    ["Relevance", candidate.scoreBreakdown.relevance],
                                  ] as [string, number][]
                                ).map(([label, value]) => (
                                  <div
                                    key={label}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-[11px] text-gray-400 w-16">
                                      {label}
                                    </span>
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          value >= 80
                                            ? "bg-green-500"
                                            : value >= 60
                                              ? "bg-amber-400"
                                              : value >= 40
                                                ? "bg-orange-400"
                                                : "bg-red-400"
                                        }`}
                                        style={{ width: `${value}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] text-gray-400 w-6 text-right">
                                      {value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Email */}
                            {candidate.email && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400">Email:</span>
                                <a
                                  href={`mailto:${candidate.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-green-600 hover:text-green-700 font-medium"
                                >
                                  {candidate.email}
                                </a>
                                {candidate.emailVerified && (
                                  <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">
                                    Verified
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Links */}
                            <div className="flex items-center gap-3">
                              {candidate.linkedinUrl && (
                                <a
                                  href={candidate.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-green-600 hover:text-green-700 font-medium"
                                >
                                  LinkedIn &rarr;
                                </a>
                              )}
                              {candidate.sources
                                .filter((s) => s !== candidate.linkedinUrl)
                                .map((url, j) => (
                                  <a
                                    key={j}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-gray-400 hover:text-gray-600 truncate max-w-[140px]"
                                  >
                                    Source {j + 1}
                                  </a>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
