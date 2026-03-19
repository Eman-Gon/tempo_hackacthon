"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useAgent } from "../context";

export default function AnalyticsPage() {
  const { chartData, totalSpent, costBreakdown } = useAgent();

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-16 text-center text-gray-400 text-sm">
        No spend data yet. Run a search from the Research tab to see analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a]">
            Spend by Service
          </h3>
          <span className="text-xs text-gray-400">
            ${totalSpent.toFixed(4)} total
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barSize={36}>
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

      {/* Breakdown table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-4">
          Cost Breakdown
        </h3>
        <div className="space-y-3">
          {Object.entries(costBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([service, cost]) => {
              const pct = totalSpent > 0 ? (cost / totalSpent) * 100 : 0;
              return (
                <div key={service} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 font-medium">
                    {service}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right font-mono">
                    ${cost.toFixed(4)}
                  </span>
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
