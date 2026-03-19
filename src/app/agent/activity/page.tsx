"use client";

import { useEffect, useRef } from "react";
import { useAgent } from "../context";

const dotColor: Record<string, string> = {
  search: "bg-blue-400",
  enrich: "bg-green-400",
  analyze: "bg-amber-400",
  contact: "bg-purple-400",
  spend: "bg-emerald-400",
  error: "bg-red-400",
  complete: "bg-green-500",
};

export default function ActivityPage() {
  const { events, isRunning } = useAgent();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (events.length === 0 && !isRunning) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-16 text-center text-gray-400 text-sm">
        No activity yet. Run a search from the Research tab to see events.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[#1a1a1a] mb-4">
        Activity Log
        {isRunning && (
          <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </h3>
      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
        {events.map((event, i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                dotColor[event.type] || "bg-gray-300"
              }`}
            />
            <span className="text-gray-600 leading-snug">{event.message}</span>
            {event.cost && (
              <span className="text-green-600 ml-auto flex-shrink-0 font-medium">
                -${event.cost.toFixed(4)}
              </span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
