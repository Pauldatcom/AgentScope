import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiJson, apiUrl, readApiError } from "../api";

interface Source {
  id: string;
  name: string;
  version: string;
}

interface ImportReport {
  import_id: string;
  source_id: string;
  filename: string;
  file_hash: string;
  status: string;
  rows_read: number;
  sessions_imported: number;
  model_calls_imported: number;
  tool_calls_imported: number;
  duplicates: number;
  is_duplicate_run: boolean;
}

export function ImportPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiJson<Source[]>("/sources")
      .then((list) => {
        setSources(list);
        setSourceId((current) => current || list[0]?.id || "");
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  async function submit() {
    if (!file || !sourceId) return;
    setError(null);
    setReport(null);
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("source_id", sourceId);
    form.append("mapping_json", "{}");
    try {
      const response = await fetch(apiUrl("/imports/upload"), {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setReport(await response.json());
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importer un fichier</h1>
      <p className="text-slate-600">
        Choisissez une source déjà connue, puis un fichier JSONL, CSV ou Parquet.
        Un mapping vide réutilise le mapping actif de la source.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Source</span>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="rounded border bg-white px-3 py-2"
            disabled={sources.length === 0}
          >
            {sources.length === 0 && <option value="">Aucune source</option>}
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.version})
              </option>
            ))}
          </select>
        </label>
        <input
          type="file"
          accept=".jsonl,.csv,.parquet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={submit}
          disabled={!file || !sourceId || loading}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Import…" : "Importer"}
        </button>
      </div>

      {error && <pre className="rounded bg-red-50 p-3 text-red-700">{error}</pre>}

      {report && (
        <div
          className={
            report.is_duplicate_run
              ? "rounded border border-amber-200 bg-amber-50 p-4"
              : "rounded border bg-white p-4"
          }
        >
          <h2 className="font-semibold">
            {report.is_duplicate_run
              ? "Fichier déjà importé — aucun doublon créé"
              : "Bilan de l'import"}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div>
              <dt className="text-slate-500">Statut</dt>
              <dd className="font-medium">{report.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lignes lues</dt>
              <dd className="font-medium">{report.rows_read}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sessions</dt>
              <dd className="font-medium">{report.sessions_imported}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Appels modèle</dt>
              <dd className="font-medium">{report.model_calls_imported}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Appels outils</dt>
              <dd className="font-medium">{report.tool_calls_imported}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Doublons</dt>
              <dd className="font-medium">{report.duplicates}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Empreinte</dt>
              <dd className="font-mono text-xs">{report.file_hash}</dd>
            </div>
          </dl>
          {!report.is_duplicate_run && (
            <p className="mt-3 text-sm">
              <Link to="/dashboard" className="text-blue-700 underline">
                Voir le dashboard
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
