"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AgentEvent, Candidate } from "@/lib/types";

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
    return "Request timed out. The service may be temporarily busy, try again.";
  if (raw.includes("429") || raw.includes("rate limit"))
    return "Rate limited by an API service. Wait a few seconds and try again.";
  if (raw.includes("502") || raw.includes("503"))
    return "An API service is temporarily unavailable. Try again shortly.";
  return raw;
}

interface AgentContextValue {
  jobDescription: string;
  setJobDescription: (v: string) => void;
  events: AgentEvent[];
  candidates: Candidate[];
  isRunning: boolean;
  totalSpent: number;
  walletInfo: { walletId: string; address: string } | null;
  error: string | null;
  costBreakdown: Record<string, number>;
  chartData: { service: string; cost: number }[];
  topScore: number;
  emailsFound: number;
  contacted: number;
  runResearch: () => Promise<void>;
  exportCSV: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
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

  /* ---- derived ---- */
  const costBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const event of events) {
      if (event.type === "spend" && event.cost) {
        let service = "Other";
        if (event.message.includes("Exa")) service = "Exa";
        else if (event.message.includes("StableEnrich"))
          service = "StableEnrich";
        else if (
          event.message.includes("LinkedIn") ||
          event.message.includes("Clado")
        )
          service = "Clado";
        else if (
          event.message.includes("Browserbase") ||
          event.message.includes("Scraped")
        )
          service = "Browserbase";
        else if (
          event.message.includes("Perplexity") ||
          event.message.includes("scoring")
        )
          service = "Perplexity";
        else if (
          event.message.includes("Hunter") ||
          event.message.includes("email")
        )
          service = "Hunter";
        else if (
          event.message.includes("Outreach") ||
          event.message.includes("outreach")
        )
          service = "StableEmail";
        breakdown[service] = (breakdown[service] || 0) + event.cost;
      }
    }
    return breakdown;
  }, [events]);

  const chartData = useMemo(
    () =>
      Object.entries(costBreakdown)
        .sort(([, a], [, b]) => b - a)
        .map(([service, cost]) => ({
          service,
          cost: parseFloat(cost.toFixed(4)),
        })),
    [costBreakdown]
  );

  const topScore = candidates.length > 0 ? candidates[0].score : 0;
  const emailsFound = candidates.filter((c) => c.email).length;
  const contacted = candidates.filter((c) => c.outreachSent).length;

  /* ---- CSV export ---- */
  const exportCSV = useCallback(() => {
    if (candidates.length === 0) return;
    const headers = [
      "Name",
      "Title",
      "Company",
      "Score",
      "Reasoning",
      "Email",
      "Verified",
      "Outreach Sent",
      "LinkedIn",
      "Sources",
    ];
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
            if (event.type === "error")
              event.message = friendlyError(event.message);
            setEvents((prev) => [...prev, event]);
            if (event.cost) setTotalSpent((prev) => prev + event.cost!);
            if (event.type === "complete" && event.data)
              setCandidates(event.data);
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

  const value = useMemo(
    () => ({
      jobDescription,
      setJobDescription,
      events,
      candidates,
      isRunning,
      totalSpent,
      walletInfo,
      error,
      costBreakdown,
      chartData,
      topScore,
      emailsFound,
      contacted,
      runResearch,
      exportCSV,
    }),
    [
      jobDescription,
      events,
      candidates,
      isRunning,
      totalSpent,
      walletInfo,
      error,
      costBreakdown,
      chartData,
      topScore,
      emailsFound,
      contacted,
      runResearch,
      exportCSV,
    ]
  );

  return (
    <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
  );
}
