"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Icons } from "@/lib/icons";
import { AgentProvider, useAgent } from "./context";

const navItems = [
  { key: "home", icon: Icons.home, label: "Homepage", href: "/" },
  { key: "research", icon: Icons.search, label: "Research", href: "/agent/research" },
  { key: "candidates", icon: Icons.users, label: "Candidates", href: "/agent/candidates" },
  { key: "analytics", icon: Icons.chart, label: "Analytics", href: "/agent/analytics" },
  { key: "activity", icon: Icons.activity, label: "Activity", href: "/agent/activity" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { walletInfo, events, candidates, totalSpent, costBreakdown, topScore, emailsFound } = useAgent();
  const { logout, user } = usePrivy();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f8f8]">
      {/* SIDEBAR */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100"
        >
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm">
            H
          </div>
          <span className="font-semibold text-[#1a1a1a] text-lg">
            HireAgent
          </span>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-[#1a1a1a]"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          {walletInfo && (
            <div className="flex items-center gap-2.5">
              {Icons.wallet}
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#1a1a1a] truncate">
                  Wallet
                </div>
                <div className="text-[11px] text-gray-400 font-mono truncate">
                  {walletInfo.address.slice(0, 6)}...
                  {walletInfo.address.slice(-4)}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP NAVBAR */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
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
          <div className="flex items-center gap-4">
            <button className="relative text-gray-400 hover:text-[#1a1a1a] transition-colors">
              {Icons.bell}
              {events.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold text-sm">
              {user?.email?.address?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* STAT CARDS */}
        <div className="px-6 pt-6 pb-0">
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
        </div>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto px-6 pb-6">{children}</main>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, user } = usePrivy();

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f8f8]">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f8f8]">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-xl bg-green-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-5">
            H
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] mb-2">
            Welcome to HireAgent
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Continue to create your wallet and start searching for candidates.
            Each run starts with a $0.70 access fee, then provider spend happens
            in real time while calls are running.
          </p>
          <div className="rounded-xl border border-gray-200 bg-[#f8f8f8] p-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#1a1a1a]">
              Before you continue
            </div>
            <div className="mt-2 text-xs leading-5 text-gray-500">
              A wallet is created first, then each search charges a fixed $0.70
              access fee. Variable provider costs are charged from your wallet
              during the run and results are shown in this dashboard.
            </div>
          </div>
          <button
            onClick={login}
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white text-sm transition-colors shadow-sm"
          >
            Continue
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Powered by Privy. A wallet will be created for you automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AgentProvider privyUserId={user?.id || ""}>
      <Shell>{children}</Shell>
    </AgentProvider>
  );
}

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
