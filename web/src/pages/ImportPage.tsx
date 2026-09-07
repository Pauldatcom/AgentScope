import { useState } from "react";

const API = (import.meta as any).env?.VITE_API_URL ?? "/api";

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setError(null);
    setReport(null);
    const form = new FormData();
    form.append("file", file);
    form.append("source_id", "00000000-0000-0000-0000-000000000000");
    form.append("mapping_json", "{}");
    try {
      const r = await fetch(`${API}/imports/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(await r.text());
      setReport(await r.json());
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importer un fichier</h1>
      <input
        type="file"
        accept=".jsonl,.csv,.parquet"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={submit}
        disabled={!file}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Importer
      </button>
      {error && <pre className="rounded bg-red-50 p-3 text-red-700">{error}</pre>}
      {report && (
        <pre className="rounded bg-slate-100 p-3 text-xs">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}
