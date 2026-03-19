"use client";

export const dynamic = "force-dynamic";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { login, authenticated, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (authenticated) {
      router.push("/agent");
    }
  }, [authenticated, router]);

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="max-w-lg mx-auto text-center px-6">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          HireAgent
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          AI recruiter that autonomously researches candidates and pays for
          premium data sources in real time.
        </p>

        {ready && !authenticated && (
          <button
            onClick={login}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-white transition-colors text-lg"
          >
            Sign in with Google
          </button>
        )}

        {!ready && (
          <div className="text-gray-500">Loading...</div>
        )}

        <div className="mt-12 grid grid-cols-3 gap-6 text-sm text-gray-500">
          <div>
            <div className="text-2xl mb-2">&#128269;</div>
            <div>Exa Search</div>
          </div>
          <div>
            <div className="text-2xl mb-2">&#128100;</div>
            <div>People Enrichment</div>
          </div>
          <div>
            <div className="text-2xl mb-2">&#129302;</div>
            <div>AI Scoring</div>
          </div>
        </div>
      </div>
    </main>
  );
}
