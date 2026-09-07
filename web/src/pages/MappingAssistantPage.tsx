import { useState } from "react";

const API = "/api";

interface ProposalField {
  source_field: string;
  target_field: string;
  confidence: number;
  explanation: string;
  ambiguity?: string | null;
}

interface Proposal {
  fields: ProposalField[];
  source_name: string | null;
  explanation: string;
  ambiguities: string[];
}

interface AnalysisResponse {
  sample_rows: Record<string, unknown>[];
  fields: string[];
  row_count: number;
  profiles: Record<string, unknown>[];
  proposal: Proposal;
}

export function MappingAssistantPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [mapping, setMapping] = useState<string>("");
  const [preview, setPreview] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("sample_size", "5");
    try {
      const r = await fetch(`${API}/mappings/analyze`, {
        method: "POST",
        body: form,
      });
      if (!r.ok) throw new Error(await r.text());
      const data: AnalysisResponse = await r.json();
      setAnalysis(data);
      const mappingObj: Record<string, Record<string, string>> = {
        session: {},
        model_call: {},
        tool_call: {},
      };
      for (const f of data.proposal.fields) {
        if (f.target_field.startsWith("external_session_id") || f.target_field === "agent" || f.target_field === "model") {
          mappingObj.session[f.target_field] = f.source_field;
        } else if (f.target_field.startsWith("tool") || f.target_field === "tools_path") {
          mappingObj.tool_call[f.target_field] = f.source_field;
        } else {
          mappingObj.model_call[f.target_field] = f.source_field;
        }
      }
      setMapping(JSON.stringify(mappingObj, null, 2));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function applyPreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("mapping_json", mapping);
    form.append("source_id", "00000000-0000-0000-0000-000000000001");
    form.append("preview_rows", "5");
    try {
      const r = await fetch(`${API}/mappings/apply`, {
        method: "POST",
        body: form,
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (!data.is_valid) {
        setError("Mapping invalide:\n" + data.errors.join("\n"));
        setPreview(null);
      } else {
        setPreview(data.preview);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Assistant IA d'import</h1>
      <p className="text-slate-600">
        Déposez un fichier inconnu. L'IA propose un mapping, vous le corrigez
        puis prévisualisez le résultat avant de valider.
      </p>

      <div className="flex gap-4">
        <input
          type="file"
          accept=".jsonl,.csv,.parquet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          onClick={analyze}
          disabled={!file || loading}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Analyser
        </button>
      </div>

      {error && (
        <pre className="rounded bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="rounded border bg-white p-4">
            <h2 className="font-semibold">Profil du fichier</h2>
            <p className="text-sm text-slate-600">
              {analysis.row_count} lignes, champs: {analysis.fields.join(", ")}
            </p>
          </div>

          <div className="rounded border bg-white p-4">
            <h2 className="font-semibold">Proposition de l'IA</h2>
            <p className="text-sm text-slate-600 mb-2">{analysis.proposal.explanation}</p>
            {analysis.proposal.ambiguities.length > 0 && (
              <div className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-700">
                <strong>Ambiguïtés:</strong>
                <ul className="list-disc pl-5">
                  {analysis.proposal.ambiguities.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 text-left">Champ source</th>
                  <th className="py-1 text-left">Champ cible</th>
                  <th className="py-1 text-left">Confiance</th>
                  <th className="py-1 text-left">Explication</th>
                </tr>
              </thead>
              <tbody>
                {analysis.proposal.fields.map((f, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1">{f.source_field}</td>
                    <td className="py-1">{f.target_field}</td>
                    <td className="py-1">{(f.confidence * 100).toFixed(0)}%</td>
                    <td className="py-1 text-slate-600">{f.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border bg-white p-4">
            <h2 className="font-semibold">Mapping (éditable)</h2>
            <textarea
              value={mapping}
              onChange={(e) => setMapping(e.target.value)}
              rows={12}
              className="mt-2 w-full rounded border p-2 font-mono text-xs"
            />
            <button
              onClick={applyPreview}
              disabled={loading}
              className="mt-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Prévisualiser
            </button>
          </div>

          {preview && (
            <div className="rounded border bg-white p-4">
              <h2 className="font-semibold">Prévisualisation ({preview.length} sessions)</h2>
              <pre className="mt-2 overflow-auto rounded bg-slate-100 p-2 text-xs">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
