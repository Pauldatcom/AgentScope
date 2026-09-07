import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiJson } from "../api";

interface ModelCall {
  id: string;
  round_index: number;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_creation_tokens: number | null;
  is_error: boolean;
}

interface ToolCall {
  id: string;
  tool_name: string;
  wall_latency_ms: number | null;
  is_error: boolean;
}

interface SessionDetail {
  session: {
    external_session_id: string;
    agent: string | null;
    model: string | null;
    started_at: string | null;
    ended_at: string | null;
  };
  model_calls: ModelCall[];
  tool_calls: ToolCall[];
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiJson<SessionDetail>(`/sessions/${id}`)
      .then(setDetail)
      .catch((e: unknown) => setError(String(e)));
  }, [id]);

  if (error) return <pre className="text-red-700">{error}</pre>;
  if (!detail) return <p>Chargement…</p>;

  const s = detail.session;
  const calls = detail.model_calls.sort((a, b) => a.round_index - b.round_index);
  const tools = detail.tool_calls;

  const cumulative: number[] = [];
  let total = 0;
  for (const c of calls) {
    total += (c.prompt_tokens ?? 0) + (c.completion_tokens ?? 0);
    cumulative.push(total);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Session {s.external_session_id}</h1>
        <div className="mt-2 text-sm text-slate-600">
          <span className="mr-4">Agent: {s.agent ?? "unknown"}</span>
          <span className="mr-4">Modèle: {s.model ?? "unknown"}</span>
          <span>Début: {s.started_at ?? "n/a"}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded border bg-white p-4 text-center">
          <div className="text-3xl font-bold">{calls.length}</div>
          <div className="text-sm text-slate-500">Appels modèle</div>
        </div>
        <div className="rounded border bg-white p-4 text-center">
          <div className="text-3xl font-bold">{tools.length}</div>
          <div className="text-sm text-slate-500">Appels outils</div>
        </div>
        <div className="rounded border bg-white p-4 text-center">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-sm text-slate-500">Tokens totaux</div>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="font-semibold">Timeline des appels</h2>
        <div className="mt-4 space-y-2">
          {calls.map((c, i) => (
            <div key={c.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Round {c.round_index}</span>
                <span className="text-sm text-slate-500">{c.model ?? "?"}</span>
              </div>
              <div className="mt-1 flex gap-4 text-sm text-slate-600">
                <span>Prompt: {c.prompt_tokens ?? "—"}</span>
                <span>Completion: {c.completion_tokens ?? "—"}</span>
                <span>Cache: {c.cache_creation_tokens ?? "—"}</span>
                {c.is_error && <span className="text-red-600">ERREUR</span>}
              </div>
              {cumulative.length > 1 && (
                <div className="mt-2 h-2 rounded bg-slate-100">
                  <div
                    className="h-2 rounded bg-blue-500"
                    style={{ width: `${(cumulative[i] / cumulative[cumulative.length - 1]) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="font-semibold">Appels d'outils</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-1 text-left">Outil</th>
              <th className="py-1 text-left">Latence (ms)</th>
              <th className="py-1 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-1">{t.tool_name}</td>
                <td className="py-1">{t.wall_latency_ms ?? "—"}</td>
                <td className="py-1">
                  {t.is_error ? (
                    <span className="text-red-600">erreur</span>
                  ) : (
                    <span className="text-green-600">ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
