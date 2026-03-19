"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

const services = [
  { name: "Exa", desc: "AI-powered candidate search", color: "text-blue-400" },
  { name: "StableEnrich", desc: "Profile enrichment", color: "text-green-400" },
  { name: "Clado", desc: "LinkedIn deep research", color: "text-cyan-400" },
  { name: "Browserbase", desc: "Full page scraping", color: "text-orange-400" },
  { name: "Perplexity", desc: "AI scoring & reasoning", color: "text-yellow-400" },
  { name: "Hunter", desc: "Email discovery", color: "text-purple-400" },
  { name: "StableEmail", desc: "Automated outreach", color: "text-pink-400" },
];

export default function Home() {
  const router = useRouter();

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-2 text-sm font-medium text-indigo-400 tracking-wider uppercase">
          Powered by Tempo MPP
        </div>
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          HireAgent
        </h1>
        <p className="text-gray-400 text-xl mb-4 leading-relaxed">
          An AI recruiter that autonomously finds, researches, scores, and contacts candidates — paying for 7 premium data sources in real time.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          No API keys. No billing setup. Just a funded wallet and the 402 protocol.
        </p>

        <button
          onClick={() => router.push("/agent")}
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-white transition-all text-lg hover:scale-105 active:scale-95"
        >
          Start Researching
        </button>

        {/* Service grid */}
        <div className="mt-16 mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">
            7 Paid APIs. Zero API Keys. One Wallet.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {services.map((s, i) => (
              <div
                key={i}
                className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-left"
              >
                <div className={`text-sm font-semibold ${s.color}`}>{s.name}</div>
                <div className="text-xs text-gray-500 mt-1">{s.desc}</div>
              </div>
            ))}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-left">
              <div className="text-sm font-semibold text-gray-400">Tempo</div>
              <div className="text-xs text-gray-500 mt-1">Payment layer</div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <span>Search</span>
          <span>&#8594;</span>
          <span>Enrich</span>
          <span>&#8594;</span>
          <span>Scrape</span>
          <span>&#8594;</span>
          <span>Score</span>
          <span>&#8594;</span>
          <span>Find Email</span>
          <span>&#8594;</span>
          <span>Outreach</span>
        </div>
      </div>
    </main>
  );
}
