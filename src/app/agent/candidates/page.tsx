"use client";

import { useState } from "react";
import { useAgent } from "../context";
import { Icons } from "@/lib/icons";
import { Avatar } from "@/components/Avatar";

export default function CandidatesPage() {
  const { candidates, isRunning, exportCSV } = useAgent();
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">
          Top Candidates
          {candidates.length > 0 && (
            <span className="text-gray-400 font-normal ml-2">
              ({candidates.length})
            </span>
          )}
        </h3>
        {candidates.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
          >
            {Icons.download}
            Export CSV
          </button>
        )}
      </div>

      {candidates.length === 0 && !isRunning && (
        <div className="px-5 py-16 text-center text-gray-400 text-sm">
          No candidates yet. Run a search from the Research tab.
        </div>
      )}

      {isRunning && candidates.length === 0 && (
        <div className="px-5 py-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {candidates.map((candidate, i) => {
          const isExpanded = expandedCandidate === i;
          return (
            <div
              key={i}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedCandidate(isExpanded ? null : i)}
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
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {candidate.summary || "No summary available."}
                  </p>

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

                  {candidate.scoreBreakdown && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Score Breakdown
                      </div>
                      {(
                        [
                          ["Skills", candidate.scoreBreakdown.skills, 40],
                          ["Experience", candidate.scoreBreakdown.experience, 25],
                          ["Location", candidate.scoreBreakdown.location, 15],
                          ["Activity", candidate.scoreBreakdown.activity, 20],
                        ] as [string, number, number][]
                      ).map(([label, value, max]) => {
                        const pct = max > 0 ? (value / max) * 100 : 0;
                        return (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400 w-16">
                              {label}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct >= 75
                                    ? "bg-green-500"
                                    : pct >= 50
                                      ? "bg-amber-400"
                                      : pct >= 25
                                        ? "bg-orange-400"
                                        : "bg-red-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-gray-400 w-12 text-right">
                              {value}/{max}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

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
                          className="text-xs text-gray-400 hover:text-gray-600 truncate max-w-[200px]"
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
  );
}
