"use client";

import { useState, useCallback } from "react";
import { useAgent } from "../context";

export default function ResearchPage() {
  const {
    jobDescription,
    setJobDescription,
    isRunning,
    isWalletLoading,
    walletInfo,
    error,
    runResearch,
    searchHistory,
    loadSearch,
  } = useAgent();

  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [mode, setMode] = useState<"structured" | "freeform">("structured");
  const [walletFundedById, setWalletFundedById] = useState<
    Record<string, boolean>
  >({});

  const maskedWalletAddress = walletInfo
    ? `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}`
    : "";

  const buildAndRun = useCallback(() => {
    if (mode === "structured") {
      const parts: string[] = [];
      if (role) parts.push(role);
      if (experience) parts.push(`${experience} experience`);
      if (skills) parts.push(`Skills: ${skills}`);
      if (location) parts.push(`Location: ${location}`);
      const combined = parts.join(". ");
      if (!combined.trim()) return;
      runResearch(combined);
    } else {
      runResearch();
    }
  }, [mode, role, location, skills, experience, runResearch]);

  // When switching to structured, try to parse existing description
  const switchToStructured = () => {
    setMode("structured");
    setRole("");
    setLocation("");
    setSkills("");
    setExperience("");
  };

  const inputClass =
    "w-full bg-[#f8f8f8] border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  const isStructuredValid = role.trim().length > 0;
  const isFreeformValid = jobDescription.trim().length > 0;
  const walletFundedFromStorage =
    walletInfo && typeof window !== "undefined"
      ? localStorage.getItem(`hireagent-wallet-funded:${walletInfo.walletId}`) ===
        "true"
      : false;
  const walletFunded =
    walletInfo &&
    (walletFundedById[walletInfo.walletId] || walletFundedFromStorage);
  const canRun =
    !isRunning &&
    walletInfo &&
    walletFunded &&
    (mode === "structured" ? isStructuredValid : isFreeformValid);

  const copyWalletAddress = useCallback(async () => {
    if (!walletInfo) return;
    try {
      await navigator.clipboard.writeText(walletInfo.address);
    } catch {
      // Clipboard failures are non-fatal in this flow.
    }
  }, [walletInfo]);

  const markWalletFunded = useCallback(() => {
    if (!walletInfo) return;
    localStorage.setItem(`hireagent-wallet-funded:${walletInfo.walletId}`, "true");
    setWalletFundedById((prev) => ({ ...prev, [walletInfo.walletId]: true }));
  }, [walletInfo]);

  const resetWalletFunded = useCallback(() => {
    if (!walletInfo) return;
    localStorage.removeItem(`hireagent-wallet-funded:${walletInfo.walletId}`);
    setWalletFundedById((prev) => ({ ...prev, [walletInfo.walletId]: false }));
  }, [walletInfo]);

  return (
    <div className="max-w-2xl space-y-4">
      {/* Search Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        {/* Mode toggle */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a]">
            New Research
          </h3>
          <div className="flex bg-[#f8f8f8] rounded-lg p-0.5 border border-gray-200">
            <button
              onClick={switchToStructured}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === "structured"
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Fields
            </button>
            <button
              onClick={() => setMode("freeform")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === "freeform"
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Freeform
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900/80">
          Each search first charges a fixed $0.70 access fee. Provider costs are
          then charged from your embedded wallet while the run is in progress.
        </div>

        {walletInfo && !walletFunded && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-900 mb-1">
              One-time setup (2 quick steps)
            </div>
            <div className="text-xs text-blue-900/80 mb-1">
              Wallet: <span className="font-mono">{maskedWalletAddress}</span>
            </div>
            <div className="text-xs text-blue-900/80 mb-2">
              1. Open wallet and add funds.
              <br />
              2. Come back and click &quot;Ready to Search&quot;.
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://wallet.tempo.xyz"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-md border border-blue-200 bg-white text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                Step 1: Open Wallet
              </a>
              <button
                type="button"
                onClick={copyWalletAddress}
                className="px-2.5 py-1.5 rounded-md border border-blue-200 bg-white text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                Copy Address
              </button>
              <button
                type="button"
                onClick={markWalletFunded}
                className="px-2.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                Step 2: Ready to Search
              </button>
            </div>
          </div>
        )}

        {walletInfo && walletFunded && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs font-semibold text-emerald-900 mb-1">
              Setup complete
            </div>
            <div className="text-xs text-emerald-900/80 mb-2">
              You can search now. If you clicked by mistake, reset below.
            </div>
            <button
              type="button"
              onClick={resetWalletFunded}
              className="px-2.5 py-1.5 rounded-md border border-emerald-300 bg-white text-emerald-900 text-xs font-medium hover:bg-emerald-100 transition-colors"
            >
              Go Back (Reset)
            </button>
          </div>
        )}

        {mode === "structured" ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Role / Title *
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior React Engineer, ML Researcher, Product Designer"
                className={inputClass}
                disabled={isRunning}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bay Area, NYC, Remote"
                  className={inputClass}
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Experience
                </label>
                <input
                  type="text"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 5+ years, Senior, Entry-level"
                  className={inputClass}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Skills / Technologies
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, Node.js, Python, Figma"
                className={inputClass}
                disabled={isRunning}
              />
            </div>
          </div>
        ) : (
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste a job description or describe the ideal candidate..."
            className="w-full h-32 bg-[#f8f8f8] border border-gray-200 rounded-lg p-3 text-sm text-[#1a1a1a] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isRunning}
          />
        )}

        <button
          onClick={buildAndRun}
          disabled={!canRun}
          className="mt-4 w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg font-medium text-white text-sm transition-colors shadow-sm"
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Researching...
            </span>
          ) : walletInfo && !walletFunded ? (
            "Fund Wallet First"
          ) : isWalletLoading ? (
            "Preparing wallet..."
          ) : (
            "Find Candidates"
          )}
        </button>
      </div>

      {/* Wallet state */}
      {isWalletLoading && !walletInfo && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
          <div className="font-medium text-blue-700 mb-1">
            Creating your wallet
          </div>
          <div className="text-blue-600">
            This only takes a moment. Once it is ready, you can run the agent.
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

      {/* Search History */}
      {searchHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">
              Past Searches
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {searchHistory.map((record) => (
              <button
                key={record.id}
                onClick={() => loadSearch(record.id)}
                disabled={isRunning}
                className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="text-sm font-medium text-[#1a1a1a] truncate">
                  {record.jobDescription}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>
                    {record.candidates.length} candidate
                    {record.candidates.length !== 1 ? "s" : ""}
                  </span>
                  <span>${record.totalSpent.toFixed(2)} spent</span>
                  <span>
                    {new Date(record.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
