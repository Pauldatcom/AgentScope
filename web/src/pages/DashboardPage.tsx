import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { apiJson } from "../api";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

export function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson("/dashboard")
      .then(setData)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <pre className="text-red-700">{error}</pre>;
  if (!data) return <p>Chargement…</p>;

  const tokens = data.indicators?.tokens_by_model ?? [];
  const tools = data.indicators?.tool_distribution ?? [];
  const agents = data.indicators?.sessions_by_agent ?? [];
  const errorRate = data.indicators?.error_rate;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Tokens consommés par modèle</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tokens}>
              <XAxis dataKey="model" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_tokens" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Répartition des outils</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={tools} dataKey="count" nameKey="tool_name" cx="50%" cy="50%" outerRadius={80}>
                {tools.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Sessions par agent</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agents}>
              <XAxis dataKey="agent" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded border bg-white p-4">
          <h2 className="font-semibold">Taux d'erreur</h2>
          <p className="text-3xl font-bold">
            {errorRate?.rate != null ? `${(errorRate.rate * 100).toFixed(1)}%` : "n/a"}
          </p>
          <p className="text-sm text-slate-500">
            {errorRate?.with_error} / {errorRate?.total} sessions
          </p>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Définitions des indicateurs</h2>
        <dl className="mt-2 space-y-2 text-sm">
          {Object.values<any>(data.definitions ?? {}).map((d) => (
            <div key={d.id}>
              <dt className="font-semibold">{d.name}</dt>
              <dd className="text-slate-600">
                <div>Calcul : {d.calc}</div>
                <div>Unité : {d.unit}</div>
                <div>Périmètre : {d.scope}</div>
                <div>Manquants : {d.missing}</div>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
