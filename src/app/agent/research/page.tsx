"use client";

import { useAgent } from "../context";

export default function ResearchPage() {
  const { jobDescription, setJobDescription, isRunning, walletInfo, error, runResearch } =
    useAgent();

  return (
    <div className="max-w-2xl">
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

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <div className="font-medium text-red-700 mb-1">
            Something went wrong
          </div>
          <div className="text-red-600">{error}</div>
        </div>
      )}
    </div>
  );
}
