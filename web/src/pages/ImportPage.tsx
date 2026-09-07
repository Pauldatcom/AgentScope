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

function Spinner() {
  return (
    <div className="flex items-center justify-center py-4">
      <svg className="h-6 w-6 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
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
      <h1 className="text-2xl font-bold">Import a file</h1>
      <p className="text-slate-600">
        Choose a known source, then upload a JSONL, CSV, or Parquet file.
        An empty mapping reuses the source's active mapping.
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
            {sources.length === 0 && <option value="">No source available</option>}
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
          {loading ? "Importing…" : "Import"}
        </button>
      </div>

      {loading && <Spinner />}

      {error && <pre className="rounded bg-red-50 p-3 text-red-700">{error}</pre>}

      {report && (
        <div
          className={
            report.is_duplicate_run
              ? "rounded-lg border border-amber-200 bg-amber-50 p-4"
              : "rounded-lg border bg-white p-4 shadow-sm"
          }
        >
          <h2 className="font-semibold">
            {report.is_duplicate_run
              ? "File already imported — no duplicates created"
              : "Import report"}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{report.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Rows read</dt>
              <dd className="font-medium">{report.rows_read}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sessions</dt>
              <dd className="font-medium">{report.sessions_imported}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Model calls</dt>
              <dd className="font-medium">{report.model_calls_imported}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tool calls</dt>
              <dd className="font-medium">{report.tool_calls_imported}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Duplicates</dt>
              <dd className="font-medium">{report.duplicates}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">File hash</dt>
              <dd className="font-mono text-xs">{report.file_hash}</dd>
            </div>
          </dl>
          {!report.is_duplicate_run && (
            <p className="mt-3 text-sm">
              <Link to="/dashboard" className="text-blue-700 underline">
                View dashboard
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
