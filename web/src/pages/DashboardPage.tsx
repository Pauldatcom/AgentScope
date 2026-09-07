import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { apiJson } from "../api";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

interface TokensByModel {
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  sessions_counted: number;
}

interface SessionsByAgent {
  agent: string;
  count: number;
}

interface ToolDistribution {
  tool_name: string;
  count: number;
  share: number;
}

interface ErrorRate {
  total: number;
  with_error: number;
  rate: number | null;
}

interface IndicatorDef {
  id: string;
  name: string;
  calc: string;
  unit: string;
  scope: string;
  missing: string;
}

interface DashboardData {
  indicators: {
    tokens_by_model: TokensByModel[];
    sessions_by_agent: SessionsByAgent[];
    tool_distribution: ToolDistribution[];
    error_rate: ErrorRate;
  };
  definitions: Record<string, IndicatorDef>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg className="h-8 w-8 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const sourceId = searchParams.get("source_id") ?? "";
  const agent = searchParams.get("agent") ?? "";
  const model = searchParams.get("model") ?? "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (sourceId) params.set("source_id", sourceId);
    if (agent) params.set("agent", agent);
    if (model) params.set("model", model);
    const qs = params.toString();
    apiJson<DashboardData>(`/dashboard${qs ? `?${qs}` : ""}`)
      .then(setData)
      .catch((e: unknown) => setError(String(e)));
  }, [sourceId, agent, model]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  if (error) return <pre className="text-red-700">{error}</pre>;
  if (!data) return <Spinner />;

  const tokens = data.indicators.tokens_by_model ?? [];
  const tools = data.indicators.tool_distribution ?? [];
  const agents = data.indicators.sessions_by_agent ?? [];
  const errorRate = data.indicators.error_rate;

  const totalTokens = tokens.reduce((sum, t) => sum + t.total_tokens, 0);
  const totalSessions = agents.reduce((sum, a) => sum + a.count, 0);
  const totalToolCalls = tools.reduce((sum, t) => sum + t.count, 0);
  const hasData = totalSessions > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-slate-600">No data yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Import a trace file to see indicators.
          </p>
          <Link
            to="/imports"
            className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Go to Import
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Agent</span>
          <input
            type="text"
            value={agent}
            onChange={(e) => setFilter("agent", e.target.value)}
            placeholder="All"
            className="rounded border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Model</span>
          <input
            type="text"
            value={model}
            onChange={(e) => setFilter("model", e.target.value)}
            placeholder="All"
            className="rounded border px-3 py-1.5 text-sm"
          />
        </label>
        {(sourceId || agent || model) && (
          <button
            onClick={() => setSearchParams(new URLSearchParams())}
            className="rounded border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total tokens" value={totalTokens.toLocaleString()} />
        <KpiCard label="Sessions" value={String(totalSessions)} />
        <KpiCard label="Tool calls" value={String(totalToolCalls)} />
        <KpiCard
          label="Error rate"
          value={errorRate?.rate != null ? `${(errorRate.rate * 100).toFixed(1)}%` : "n/a"}
          sub={errorRate ? `${errorRate.with_error} / ${errorRate.total} sessions` : undefined}
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-700">Tokens by model</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tokens}>
              <XAxis dataKey="model" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total_tokens" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-700">Tool distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={tools} dataKey="count" nameKey="tool_name" cx="50%" cy="50%" outerRadius={80}>
                {tools.map((_: ToolDistribution, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-700">Sessions by agent</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agents}>
              <XAxis dataKey="agent" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Indicator definitions */}
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-700">Indicator definitions</h2>
        <dl className="mt-2 space-y-3 text-sm">
          {Object.values<IndicatorDef>(data.definitions ?? {}).map((d) => (
            <div key={d.id} className="border-l-2 border-slate-200 pl-3">
              <dt className="font-semibold text-slate-800">{d.name}</dt>
              <dd className="mt-1 space-y-0.5 text-slate-500">
                <div><span className="font-medium text-slate-600">Calculation:</span> {d.calc}</div>
                <div><span className="font-medium text-slate-600">Unit:</span> {d.unit}</div>
                <div><span className="font-medium text-slate-600">Scope:</span> {d.scope}</div>
                <div><span className="font-medium text-slate-600">Missing values:</span> {d.missing}</div>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
