"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "./ui";

type Point = { date: string; chat: number; claude_code: number; cowork: number; other: number; total: number };

/* Fixed order = fixed colors. Never re-assigned when a series is empty. */
const SERIES = [
  { key: "chat", label: "Chat", color: "var(--series-chat)" },
  { key: "claude_code", label: "Claude Code", color: "var(--series-code)" },
  { key: "cowork", label: "Cowork", color: "var(--series-cowork)" },
  { key: "other", label: "Other", color: "var(--series-other)" },
] as const;

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtUsd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUsdTick = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `$${Math.round(v)}`);

const axis = { stroke: "var(--text-3)", fontSize: 11, tickLine: false, axisLine: false } as const;

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />;
}

function ViewToggle({ view, setView }: { view: "chart" | "table"; setView: (v: "chart" | "table") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card-muted p-0.5 text-xs" role="tablist">
      {(["chart", "table"] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={cn("rounded-md px-2.5 py-1 capitalize", view === v ? "bg-card font-medium text-text shadow-sm" : "text-text-2")}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function SpendTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="min-w-44 rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
      <div className="mb-1.5 font-medium text-text">{fmtDay(String(label))}</div>
      {SERIES.filter((s) => p[s.key] > 0).map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-text-2">
            <Swatch color={s.color} />
            {s.label}
          </span>
          <span className="tabular text-text">{fmtUsd(p[s.key])}</span>
        </div>
      ))}
      <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-medium">
        <span>Total</span>
        <span className="tabular">{fmtUsd(p.total)}</span>
      </div>
    </div>
  );
}

/** Daily spend, stacked by product. Has a table view for exact values. */
export function SpendChart({ data, height = 260 }: { data: Point[]; height?: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const present = SERIES.filter((s) => data.some((d) => d[s.key] > 0));
  const top = [...present].reverse()[0]?.key;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2">
          {present.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <Swatch color={s.color} />
              {s.label}
            </span>
          ))}
        </div>
        <ViewToggle view={view} setView={setView} />
      </div>

      {view === "chart" ? (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={24} {...axis} />
              <YAxis tickFormatter={fmtUsdTick} width={52} {...axis} />
              <Tooltip content={(props) => <SpendTooltip {...(props as TooltipContentProps<number, string>)} />} cursor={{ fill: "var(--card-muted)" }} />
              {present.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="spend"
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                  maxBarSize={24}
                  radius={s.key === top ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs tabular">
            <thead className="sticky top-0 bg-card-muted text-text-2">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                {present.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">
                    {s.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="px-3 py-1.5">{fmtDay(d.date)}</td>
                  {present.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">
                      {fmtUsd(d[s.key])}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium">{fmtUsd(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{fmtDay(String(label))}</div>
      <div className="mt-0.5 text-text-2">
        <span className="tabular text-text">{payload[0].value}</span> active {payload[0].value === 1 ? "person" : "people"}
      </div>
    </div>
  );
}

/** Daily active people: single series, so the card title names it (no legend). */
export function ActiveUsersChart({ data, height = 200 }: { data: { date: string; users: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={24} {...axis} />
          <YAxis allowDecimals={false} width={44} {...axis} />
          <Tooltip content={(props) => <UsersTooltip {...(props as TooltipContentProps<number, string>)} />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="users"
            stroke="var(--series-single)"
            strokeWidth={2}
            fill="var(--series-single)"
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--series-single)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars with values at the tip — plain HTML so labels never clip. */
export function ProductBars({ rows }: { rows: { key: string; label: string; cents: number; users: number }[] }) {
  const colors: Record<string, string> = Object.fromEntries(SERIES.map((s) => [s.key, s.color]));
  const max = Math.max(1, ...rows.map((r) => r.cents));
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.label}: ${fmtUsd(r.cents / 100)} · ${r.users} people`}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5">
              <Swatch color={colors[r.key] ?? "var(--text-3)"} />
              {r.label}
            </span>
            <span className="text-text-2">
              <span className="tabular text-text">{fmtUsd(r.cents / 100)}</span> · {r.users} {r.users === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-card-muted">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(1.5, (r.cents / max) * 100)}%`, background: colors[r.key] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
