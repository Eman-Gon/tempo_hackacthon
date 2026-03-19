"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

const services = [
  { name: "Exa", desc: "AI-powered candidate search" },
  { name: "StableEnrich", desc: "Profile enrichment" },
  { name: "Clado", desc: "LinkedIn deep research" },
  { name: "Browserbase", desc: "Full page scraping" },
  { name: "Perplexity", desc: "AI scoring & reasoning" },
  { name: "Hunter", desc: "Email discovery" },
  { name: "StableEmail", desc: "Automated outreach" },
];

const steps = ["Search", "Enrich", "Scrape", "Score", "Find Email", "Outreach"];

export default function Home() {
  const router = useRouter();

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-3xl mx-auto text-center">
        <div className="mb-3 text-sm font-medium text-green-600 tracking-wider uppercase">
          Powered by Tempo MPP
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold mb-4 text-[#1a1a1a]">
          HireAgent
        </h1>
        <p className="text-gray-500 text-lg mb-4 leading-relaxed max-w-xl mx-auto">
          An AI recruiter that autonomously finds, researches, scores, and
          contacts candidates, paying for 7 premium data sources in real time.
        </p>
        <p className="text-gray-400 text-sm mb-10">
          No API keys. No billing setup. Just a funded wallet and the 402
          protocol.
        </p>

        <button
          onClick={() => router.push("/agent")}
          className="px-10 py-4 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white transition-all text-lg shadow-lg shadow-green-600/20 hover:shadow-green-600/30 hover:scale-[1.02] active:scale-95"
        >
          Start Researching
        </button>

        {/* Service cards */}
        <div className="mt-20 mb-10">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-6">
            7 Paid APIs &middot; Zero API Keys &middot; One Wallet
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {services.map((s, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-sm font-semibold text-[#1a1a1a]">
                  {s.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
              </div>
            ))}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left shadow-sm">
              <div className="text-sm font-semibold text-green-700">Tempo</div>
              <div className="text-xs text-green-600/70 mt-0.5">
                Payment layer
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline steps */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap text-xs text-gray-400">
          {steps.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-[#1a1a1a] font-medium shadow-sm">
                {step}
              </span>
              {i < steps.length - 1 && <span className="text-gray-300">&#8594;</span>}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
