/** Typed API client for the AgentScope FastAPI backend.
 *
 * Mirrors the Pydantic schemas in agentscope/api/schemas.py.
 * In dev, Vite proxies /api → http://localhost:8000 (prefix stripped).
 */

// --- Shared helpers ---

export const API_BASE = (
  import.meta.env.VITE_API_URL ?? "/api"
).replace(/\/$/, "");

export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

export async function readApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "detail" in parsed &&
      typeof (parsed as { detail: unknown }).detail === "string"
    ) {
      return (parsed as { detail: string }).detail;
    }
  } catch {
    /* not JSON */
  }
  return text || response.statusText;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json() as Promise<T>;
}

// --- Types (mirror backend Pydantic schemas) ---

export interface SourceOut {
  id: string;
  name: string;
  version: string;
  retrieved_at: string;
  method: string;
  license: string | null;
}

export interface SessionOut {
  id: string;
  source_id: string;
  external_session_id: string;
  agent: string | null;
  model: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  total_tokens: number | null;
  tool_calls: number;
  errors: number;
  status: string;
  quality: string;
}

export interface ModelCallOut {
  id: string;
  session_id: string;
  round_index: number;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_creation_tokens: number | null;
  latency_ms: number | null;
  is_error: boolean;
  occurred_at: string | null;
  raw_payload: Record<string, unknown>;
}

export interface ToolCallOut {
  id: string;
  session_id: string;
  model_call_id: string | null;
  tool_name: string;
  input_chars: number | null;
  result_chars: number | null;
  wall_latency_ms: number | null;
  internal_latency_ms: number | null;
  is_error: boolean;
  occurred_at: string | null;
}

export interface SessionDetail {
  session: Record<string, unknown>;
  model_calls: ModelCallOut[];
  tool_calls: ToolCallOut[];
}

export interface IndicatorDefOut {
  id: string;
  name: string;
  calc: string;
  unit: string;
  scope: string;
  missing: string;
}

export interface DashboardOut {
  indicators: {
    tokens_by_model: {
      model: string | null;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      sessions_counted: number;
    }[];
    sessions_by_agent: { agent: string; count: number }[];
    tool_distribution: { tool_name: string; count: number; share: number }[];
    error_rate: { total: number; with_error: number; rate: number | null };
    avg_duration: { total: number; with_duration: number; avg_ms: number | null };
    cache_rate: { total: number; with_cache: number; rate: number | null };
  };
  definitions: Record<string, IndicatorDefOut>;
}

export interface AgentOut {
  name: string;
  sessions: number;
  total_tokens: number | null;
  tool_calls: number;
  errors: number;
  avg_duration_ms: number | null;
  cache_rate: number | null;
  error_rate: number | null;
  last_active_iso: string | null;
}

export interface ToolOut {
  name: string;
  calls: number;
  sessions: number;
  errors: number;
  error_rate: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  avg_input_chars: number | null;
  avg_result_chars: number | null;
}

export interface ModelOut {
  name: string;
  sessions: number;
  requests: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_tokens: number | null;
  total_tokens: number | null;
  avg_latency_ms: number | null;
  error_rate: number | null;
  cache_rate: number | null;
}

export interface ImportRunOut {
  id: string;
  source_id: string;
  filename: string;
  file_hash: string;
  status: string;
  rows_read: number;
  sessions_imported: number;
  model_calls_imported: number;
  tool_calls_imported: number;
  duplicates: number;
  created_at: string;
}

export interface RejectionOut {
  id: string;
  import_run_id: string;
  line_number: number;
  reason: string;
  excerpt: string;
}

export interface DataQualityOut {
  total_sessions: number;
  with_tokens: number;
  with_duration: number;
  with_cache: number;
  with_errors: number;
  tokens_coverage: number | null;
  duration_coverage: number | null;
  cache_coverage: number | null;
  error_coverage: number | null;
  sources: {
    id: string;
    name: string;
    version: string;
    license: string | null;
    method: string;
  }[];
  imports: ImportRunOut[];
  rejections: RejectionOut[];
}

export interface SettingsOut {
  app_env: string;
  app_host: string;
  app_port: number;
  cors_origins: string;
  ia_provider: string;
  ia_model: string;
  ia_model_alt: string;
  openrouter_base_url: string;
  database_url: string;
  mask_env: boolean;
}

export interface ActivityBucketOut {
  bucket: string;
  sessions: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_tokens: number;
  total_tokens: number;
  tool_calls: number;
  errors: number;
}

export interface ImportReportOut {
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

export interface FieldProfileOut {
  name: string;
  inferred_type: string;
  non_null_ratio: number;
  distinct_values: number;
  examples: unknown[];
}

export interface ProposalFieldOut {
  source_field: string;
  target_field: string;
  confidence: number;
  explanation?: string;
  ambiguity?: string | null;
}

export interface AnalysisOut {
  sample_rows: Record<string, unknown>[];
  fields: string[];
  row_count: number;
  profiles: FieldProfileOut[];
  proposal: {
    fields: ProposalFieldOut[];
    source_name: string;
    explanation: string;
    ambiguities: string[];
  };
}

export interface SourceIn {
  name: string;
  version: string;
  method: string;
  license?: string | null;
}

export interface MappingOut {
  id: string;
  source_id: string;
  version: number;
  mapping: Record<string, unknown>;
  created_by: string;
  is_active: boolean;
}

export interface MappingIn {
  source_id: string;
  mapping: {
    session?: Record<string, string>;
    model_call?: Record<string, string>;
    tool_call?: Record<string, string>;
  };
  created_by?: string;
}

export interface ApplyMappingOut {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  preview: Record<string, unknown>[] | null;
}

// --- API functions ---

export interface ApiFilters {
  source_id?: string;
  agent?: string;
  model?: string;
}

function filtersToQuery(f: ApiFilters): string {
  const params = new URLSearchParams();
  if (f.source_id) params.set("source_id", f.source_id);
  if (f.agent) params.set("agent", f.agent);
  if (f.model) params.set("model", f.model);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  // Sources
  fetchSources: () => apiJson<SourceOut[]>("/sources"),
  createSource: (payload: SourceIn) =>
    apiJson<SourceOut>("/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  saveMapping: (payload: MappingIn) =>
    apiJson<MappingOut>("/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }),

  // Sessions
  fetchSessions: (filters: ApiFilters & { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters.source_id) params.set("source_id", filters.source_id);
    if (filters.agent) params.set("agent", filters.agent);
    if (filters.model) params.set("model", filters.model);
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return apiJson<SessionOut[]>(`/sessions${qs ? `?${qs}` : ""}`);
  },

  fetchSession: (id: string) => apiJson<SessionDetail>(`/sessions/${id}`),

  // Dashboard
  fetchDashboard: (filters: ApiFilters) =>
    apiJson<DashboardOut>(`/dashboard${filtersToQuery(filters)}`),

  // Agents
  fetchAgents: (filters: ApiFilters) =>
    apiJson<AgentOut[]>(`/agents${filtersToQuery(filters)}`),

  // Tools
  fetchTools: (filters: ApiFilters) =>
    apiJson<ToolOut[]>(`/tools${filtersToQuery(filters)}`),

  // Models
  fetchModels: (filters: ApiFilters) =>
    apiJson<ModelOut[]>(`/models${filtersToQuery(filters)}`),

  // Imports
  fetchImports: (limit?: number) =>
    apiJson<ImportRunOut[]>(`/imports${limit ? `?limit=${limit}` : ""}`),

  fetchRejections: (importId: string, limit?: number) =>
    apiJson<RejectionOut[]>(
      `/imports/${importId}/rejections${limit ? `?limit=${limit}` : ""}`,
    ),

  // Data quality
  fetchDataQuality: (filters: ApiFilters) =>
    apiJson<DataQualityOut>(`/data-quality${filtersToQuery(filters)}`),

  // Settings
  fetchSettings: () => apiJson<SettingsOut>("/settings"),

  // Activity
  fetchActivity: (filters: ApiFilters) =>
    apiJson<ActivityBucketOut[]>(`/activity${filtersToQuery(filters)}`),

  // Import upload (multipart)
  uploadImport: (
    file: File,
    sourceId: string,
    mappingJson: string,
  ): Promise<ImportReportOut> => {
    const form = new FormData();
    form.append("file", file);
    form.append("source_id", sourceId);
    form.append("mapping_json", mappingJson);
    return fetch(apiUrl("/imports/upload"), {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error(await readApiError(r));
      return r.json() as Promise<ImportReportOut>;
    });
  },

  // Mapping analyze (multipart)
  analyzeMapping: (
    file: File,
    sampleSize?: number,
  ): Promise<AnalysisOut> => {
    const form = new FormData();
    form.append("file", file);
    if (sampleSize) form.append("sample_size", String(sampleSize));
    return fetch(apiUrl("/mappings/analyze"), {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error(await readApiError(r));
      return r.json() as Promise<AnalysisOut>;
    });
  },

  // Mapping apply (multipart)
  applyMapping: (
    file: File,
    mappingJson: string,
    sourceId: string,
    previewRows?: number,
  ): Promise<ApplyMappingOut> => {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping_json", mappingJson);
    form.append("source_id", sourceId);
    if (previewRows) form.append("preview_rows", String(previewRows));
    return fetch(apiUrl("/mappings/apply"), {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error(await readApiError(r));
      return r.json() as Promise<ApplyMappingOut>;
    });
  },
};
