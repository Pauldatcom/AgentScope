import { formatNumber } from "@/lib/utils";

export type ImportStep = "upload" | "analyze" | "map" | "validate" | "import";
export type SourceType = "json" | "jsonl" | "csv" | "parquet";
export type ImportOutcome = null | "success" | "warnings" | "duplicate" | "error";

export interface PreviewSession {
  session?: {
    external_session_id?: string;
    agent?: string | null;
    model?: string | null;
  };
  model_calls?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    model?: string | null;
  }[];
  tool_calls?: { tool_name?: string }[];
}

export const IMPORT_STEPS: {
  id: ImportStep;
  label: string;
  description: string;
}[] = [
  { id: "upload", label: "Upload", description: "Drop a file and pick a source" },
  { id: "analyze", label: "Analyze", description: "Inspect structure" },
  { id: "map", label: "Map fields", description: "Confirm field mapping" },
  { id: "validate", label: "Validate", description: "Preview normalized rows" },
  { id: "import", label: "Import", description: "Persist and deduplicate" },
];

export const SOURCE_TYPES: {
  id: SourceType;
  label: string;
  desc: string;
  accept: string;
}[] = [
  { id: "jsonl", label: "JSONL", desc: "One record per line", accept: ".jsonl,.json" },
  { id: "json", label: "JSON", desc: "Array or object", accept: ".json,.jsonl" },
  { id: "csv", label: "CSV", desc: "Header + rows", accept: ".csv" },
  { id: "parquet", label: "Parquet", desc: "Columnar table", accept: ".parquet" },
];

export function sampleText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const raw = JSON.stringify(value);
    return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  }
  const text = String(value);
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

export function tokenLabel(calls: PreviewSession["model_calls"]): string {
  let any = false;
  let sum = 0;
  for (const call of calls ?? []) {
    if (call.prompt_tokens != null) {
      any = true;
      sum += Number(call.prompt_tokens);
    }
    if (call.completion_tokens != null) {
      any = true;
      sum += Number(call.completion_tokens);
    }
  }
  return any ? formatNumber(sum) : "—";
}
