import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  Sparkles,
  Wand2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Bot,
  RefreshCw,
  ArrowRight,
  Database,
  MessageSquare,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Stepper } from "@/components/stepper";
import { ChartCard } from "@/components/chart-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  api,
  type SourceOut,
  type ImportRunOut,
  type AnalysisOut,
  type ApplyMappingOut,
  type ImportReportOut,
} from "@/api";
import { useApi } from "@/hooks/useApi";
import {
  cn,
  formatNumber,
  relativeTime,
} from "@/lib/utils";

type Step = "upload" | "analyze" | "map" | "validate" | "import";
type SourceType = "jsonl" | "csv" | "parquet";
type Outcome =
  | null
  | "success"
  | "warnings"
  | "incomplete"
  | "non-comparable"
  | "duplicate"
  | "error";

interface MappingEntry {
  sourceField: string;
  targetField: string | null;
  confidence: number;
  note?: string;
}

const TARGET_FIELDS = [
  "session.external_session_id",
  "session.agent",
  "session.model",
  "session.started_at",
  "session.ended_at",
  "model_call.round_index",
  "model_call.model",
  "model_call.prompt_tokens",
  "model_call.completion_tokens",
  "model_call.cache_creation_tokens",
  "model_call.latency_ms",
  "model_call.is_error",
  "model_call.occurred_at",
  "tool_call.tools_path",
  "tool_call.tool_name",
  "tool_call.input_chars",
  "tool_call.result_chars",
  "tool_call.wall_latency_ms",
  "tool_call.internal_latency_ms",
  "tool_call.is_error",
  "tool_call.occurred_at",
];

const TARGET_SECTIONS: Record<string, string> = {
  external_session_id: "session",
  agent: "session",
  model: "session",
  started_at: "session",
  ended_at: "session",
  round_index: "model_call",
  prompt_tokens: "model_call",
  completion_tokens: "model_call",
  cache_creation_tokens: "model_call",
  latency_ms: "model_call",
  is_error: "model_call",
  occurred_at: "model_call",
  tools_path: "tool_call",
  tool_name: "tool_call",
  input_chars: "tool_call",
  result_chars: "tool_call",
  wall_latency_ms: "tool_call",
  internal_latency_ms: "tool_call",
};

function qualifyTarget(target: string): string {
  if (target.includes(".")) return target;
  const section = TARGET_SECTIONS[target];
  return section ? `${section}.${target}` : "";
}

function sampleValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value);
  return serialized.length > 80 ? `${serialized.slice(0, 77)}...` : serialized;
}

function previewField(
  row: Record<string, unknown>,
  section: string,
  field: string,
): string {
  const value = row[section];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  return sampleValue((value as Record<string, unknown>)[field]);
}

function previewTool(row: Record<string, unknown>): string {
  const tools = row.tool_calls;
  if (!Array.isArray(tools) || tools.length === 0) return "—";
  const firstTool = tools[0];
  if (!firstTool || typeof firstTool !== "object") return "—";
  return sampleValue((firstTool as Record<string, unknown>).tool_name);
}

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "upload", label: "Upload", description: "Drop a file or connect an API" },
  { id: "analyze", label: "Analyze", description: "The AI inspects structure" },
  { id: "map", label: "Map fields", description: "Confirm field mapping" },
  { id: "validate", label: "Validate", description: "Preview normalized rows" },
  { id: "import", label: "Import", description: "Persist & deduplicate" },
];

const SOURCE_TYPES: {
  id: SourceType;
  label: string;
  desc: string;
  icon: typeof FileText;
}[] = [
  { id: "jsonl", label: "JSONL", desc: "One session per line", icon: FileText },
  { id: "csv", label: "CSV", desc: "Header + rows", icon: FileText },
  { id: "parquet", label: "Parquet", desc: "Columnar trace export", icon: FileText },
];

function Message({
  role,
  children,
}: {
  role: "agent" | "user";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-3 text-xs",
        role === "agent" ? "bg-muted/30" : "bg-transparent",
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          role === "agent"
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {role === "agent" ? (
          <Bot className="h-3.5 w-3.5" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 space-y-1.5 text-foreground/90">{children}</div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const tone =
    value >= 0.8
      ? "bg-success"
      : value >= 0.5
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function ImportsPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<Step>("upload");
  const [completed, setCompleted] = React.useState<Step[]>([]);
  const [sourceType, setSourceType] = React.useState<SourceType>("jsonl");
  const [sourceId, setSourceId] = React.useState<string>("");
  const [sourceOptions, setSourceOptions] = React.useState<SourceOut[]>([]);
  const [newSourceName, setNewSourceName] = React.useState("");
  const [creatingSource, setCreatingSource] = React.useState(false);
  const [sourceError, setSourceError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [file, setFile] = React.useState<File | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome>(null);
  const [analysis, setAnalysis] = React.useState<AnalysisOut | null>(null);
  const [mappingEntries, setMappingEntries] = React.useState<MappingEntry[]>([]);
  const [applyResult, setApplyResult] = React.useState<ApplyMappingOut | null>(
    null,
  );
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [importReport, setImportReport] =
    React.useState<ImportReportOut | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  const { data: sources } = useApi<SourceOut[]>(() => api.fetchSources(), []);
  const { data: imports } = useApi<ImportRunOut[]>(() => api.fetchImports(20), []);

  React.useEffect(() => {
    if (sources) setSourceOptions(sources);
  }, [sources]);

  React.useEffect(() => {
    if (!sourceId && sourceOptions.length > 0) setSourceId(sourceOptions[0].id);
  }, [sourceId, sourceOptions]);

  const createSource = async () => {
    const name = newSourceName.trim();
    if (!name) return;
    setCreatingSource(true);
    setSourceError(null);
    try {
      const source = await api.createSource({
        name,
        version: "v0.1",
        method: "uploaded file",
      });
      setSourceOptions((current) => [...current, source]);
      setSourceId(source.id);
      setNewSourceName("");
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingSource(false);
    }
  };

  const displayRowCount = analysis?.row_count ?? 0;
  const displayFieldCount = analysis?.fields.length ?? 0;

  const go = (next: Step) => {
    if (!completed.includes(step)) setCompleted((c) => [...c, step]);
    setStep(next);
  };

  const reset = () => {
    setStep("upload");
    setCompleted([]);
    setFileName("");
    setFile(null);
    setOutcome(null);
    setAnalysis(null);
    setMappingEntries([]);
    setApplyResult(null);
    setApplyError(null);
    setAnalysisError(null);
    setImportReport(null);
    setImportError(null);
  };

  const buildMapping = (): Record<string, Record<string, string>> => {
    const mapping: Record<string, Record<string, string>> = {
      session: {},
      model_call: {},
      tool_call: {},
    };
    for (const entry of mappingEntries) {
      if (!entry.targetField) continue;
      const [section, target] = entry.targetField.split(".");
      if (section in mapping && target) mapping[section][target] = entry.sourceField;
    }
    return mapping;
  };

  const startAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    setMappingEntries([]);
    go("analyze");
    try {
      const result = await api.analyzeMapping(file);
      setAnalysis(result);
      const proposals = new Map(
        result.proposal.fields.map((field) => [
          String(field.source_field),
          field,
        ]),
      );
      setMappingEntries(
        result.fields.map((sourceField) => {
          const proposal = proposals.get(sourceField) as
            | Record<string, unknown>
            | undefined;
          const rawTarget = String(proposal?.target_field ?? "");
          return {
            sourceField,
            targetField: rawTarget ? qualifyTarget(rawTarget) : null,
            confidence: Number(proposal?.confidence ?? 0),
            note: String(proposal?.explanation ?? "") || undefined,
          };
        }),
      );
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmMapping = () => {
    setApplyResult(null);
    setApplyError(null);
    go("validate");
    void startValidate();
  };

  const startValidate = async () => {
    if (!file) {
      setApplyError("No file selected. Drop a file to validate.");
      return;
    }
    if (!sourceId) {
      setApplyError("Select a destination source before validating.");
      return;
    }
    setValidating(true);
    setApplyError(null);
    try {
      const result = await api.applyMapping(
        file,
        JSON.stringify(buildMapping()),
        sourceId,
      );
      setApplyResult(result);
      if (!result.is_valid) setApplyError(result.errors.join(" "));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setValidating(false);
    }
  };

  const startImport = async () => {
    if (!file) {
      setImportError("No file selected. Drop a file to import.");
      setOutcome("error");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const report = await api.uploadImport(
        file,
        sourceId,
        JSON.stringify(buildMapping()),
      );
      setImportReport(report);
      if (report.status === "ok" && !report.is_duplicate_run) {
        setOutcome("success");
      } else if (report.status === "duplicate") {
        setOutcome("duplicate");
      } else if (report.status === "rejected") {
        setOutcome("error");
      } else {
        setOutcome("warnings");
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
      setOutcome("error");
    } finally {
      setImporting(false);
    }
  };

  const rowsReadValue = importReport?.rows_read ?? 0;
  const sessionsValue =
    importReport?.sessions_imported ?? 0;
  const duplicatesValue = importReport?.duplicates ?? 0;
  const rejectionsValue = importReport
    ? Math.max(
        0,
        importReport.rows_read -
          importReport.sessions_imported -
          importReport.duplicates,
      )
    : 0;

  const outcomeMap: Record<
    Exclude<Outcome, null>,
    {
      icon: typeof CheckCircle2;
      title: string;
      tone: "success" | "warning" | "error" | "info";
      body: React.ReactNode;
    }
  > = {
    success: {
      icon: CheckCircle2,
      title: "Import successful",
      tone: "success",
      body: (
        <>
          {rowsReadValue.toLocaleString()} rows imported into{" "}
          <span className="font-medium text-foreground">
            {sourceOptions.find(
              (s) => s.id === (importReport?.source_id ?? sourceId),
            )?.name}
          </span>
          . No duplicates, no rejections.
        </>
      ),
    },
    warnings: {
      icon: AlertTriangle,
      title: "Imported with warnings",
      tone: "warning",
      body: (
        <>
          The import completed with warnings. Review the mapping and the
          rejected rows before comparing this source with others.
        </>
      ),
    },
    incomplete: {
      icon: AlertTriangle,
      title: "Data incomplete",
      tone: "warning",
      body: (
        <>
          Several required fields were missing on a fraction of rows. They were
          rejected and stored for later re-ingestion.
        </>
      ),
    },
    "non-comparable": {
      icon: AlertTriangle,
      title: "Source is not comparable",
      tone: "warning",
      body: (
        <>
          This source was imported but its agent & tool names are not
          canonicalized. Cross-source comparisons will exclude it.
        </>
      ),
    },
    duplicate: {
      icon: AlertTriangle,
      title: "Duplicate run",
      tone: "warning",
      body: (
        <>
          This file was already imported (same sha256). No new rows were
          written.
        </>
      ),
    },
    error: {
      icon: XCircle,
      title: "Import failed",
      tone: "error",
      body: <>{importError ?? "A required field was missing on every row."}</>,
    },
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Imports"
        description="Import agent traces with the AI assistant — or browse past imports."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="text-xs"
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Restart
        </Button>
      </PageHeader>

      <div className="mb-5 rounded-xl border border-border/80 bg-card/40 p-4">
        <Stepper
          steps={STEPS}
          current={step}
          completed={completed}
          onStepClick={(id) => setStep(id as Step)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {step === "upload" && (
            <ChartCard
              title="1 · Upload"
              description="Choose a source type and drop a file or connect an API."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {SOURCE_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSourceType(t.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                        sourceType === t.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/80 bg-muted/20 hover:border-border hover:bg-muted/40",
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">
                        {t.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Separator className="my-4" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Destination source
                  </label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select a source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {sourceOptions.find((s) => s.id === sourceId)?.license ??
                      "—"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={newSourceName}
                      onChange={(event) => setNewSourceName(event.target.value)}
                      placeholder="New source name"
                      className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void createSource()}
                      disabled={!newSourceName.trim() || creatingSource}
                    >
                      {creatingSource ? "Creating..." : "Create source"}
                    </Button>
                  </div>
                  {sourceError && (
                    <p className="text-[11px] text-destructive">{sourceError}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    File
                  </label>
                  <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                    <UploadCloud className="h-3.5 w-3.5" />
                    {fileName || `Drop a .${sourceType} file`}
                    <input
                      type="file"
                      className="hidden"
                      accept={`.${sourceType}`}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFile(f);
                        setFileName(f?.name ?? "");
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={startAnalyze}
                  disabled={!fileName || analyzing}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Analyze
                </Button>
              </div>
            </ChartCard>
          )}

          {step === "analyze" && (
            <ChartCard
              title="2 · Analyze"
              description="The AI inspects the structure and proposes a field mapping."
              action={
                <Badge variant="info" className="text-[10px]">
                  <Sparkles className="mr-1 h-3 w-3" /> AI
                </Badge>
              }
            >
              {analyzing ? (
                <div className="space-y-3">
                  <Message role="agent">
                    <p>Analyzing the file structure…</p>
                    <p className="text-muted-foreground">
                      Reading field types and sampling values from the uploaded file.
                    </p>
                  </Message>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded bg-muted/40"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysisError && (
                    <Alert tone="error" title="Analysis failed">
                      {analysisError}
                    </Alert>
                  )}
                  <Message role="agent">
                    <p>
                      Found{" "}
                      <span className="font-medium text-foreground">
                        {displayRowCount.toLocaleString()} rows
                      </span>{" "}
                      across{" "}
                      <span className="font-medium text-foreground">
                        {displayFieldCount} fields
                      </span>
                      .
                    </p>
                  </Message>
                  <div className="overflow-hidden rounded-lg border border-border/80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Field</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Sample</th>
                          <th className="px-3 py-2 font-medium">Nullable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis?.fields.map((field) => {
                          const profile = analysis.profiles.find(
                            (item) => item.name === field,
                          );
                          return (
                            <tr key={field} className="border-t border-border/50">
                              <td className="px-3 py-2 font-mono text-foreground">
                                {field}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {String(profile?.inferred_type ?? "unknown")}
                              </td>
                              <td className="px-3 py-2 font-mono text-muted-foreground">
                                {sampleValue(analysis.sample_rows[0]?.[field])}
                              </td>
                              <td className="px-3 py-2">
                                {Number(profile?.non_null_ratio ?? 0) < 1 ? (
                                  <Badge variant="warning" className="text-[10px]">
                                    yes
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">
                                    no
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => go("map")}>
                      Propose mapping <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </ChartCard>
          )}

          {step === "map" && (
            <ChartCard
              title="3 · Map fields"
              description="Review the AI's proposed mapping. Ambiguities are flagged."
              action={
                <Badge variant="info" className="text-[10px]">
                  <Wand2 className="mr-1 h-3 w-3" /> AI proposal
                </Badge>
              }
            >
              <Message role="agent">
                <p>
                  {analysis?.proposal.explanation ||
                    "Review the proposed correspondences before continuing."}
                </p>
              </Message>
              {(analysis?.proposal.ambiguities.length ?? 0) > 0 && (
                <Alert
                  tone="warning"
                  title={`${analysis?.proposal.ambiguities.length ?? 0} ambiguities to review`}
                  className="mt-3"
                >
                  <ul className="ml-3 list-disc space-y-0.5">
                    {analysis?.proposal.ambiguities.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              <div className="mt-3 overflow-hidden rounded-lg border border-border/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Source field</th>
                      <th className="px-3 py-2 font-medium">→ Target</th>
                      <th className="px-3 py-2 font-medium">Confidence</th>
                      <th className="px-3 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingEntries.map((m) => (
                      <tr
                        key={m.sourceField}
                        className="border-t border-border/50"
                      >
                        <td className="px-3 py-2 font-mono text-foreground">
                          {m.sourceField}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={m.targetField ?? ""}
                            onChange={(event) => {
                              const targetField = event.target.value || null;
                              setMappingEntries((entries) =>
                                entries.map((entry) =>
                                  entry.sourceField === m.sourceField
                                    ? { ...entry, targetField }
                                    : entry,
                                ),
                              );
                            }}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-[11px] text-foreground"
                          >
                            <option value="">unmapped</option>
                            {TARGET_FIELDS.map((target) => (
                              <option key={target} value={target}>
                                {target}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <ConfidenceBar value={m.confidence} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {m.note ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("analyze")}>
                  Back
                </Button>
                <Button size="sm" onClick={confirmMapping}>
                  Confirm mapping
                </Button>
              </div>
            </ChartCard>
          )}

          {step === "validate" && (
            <ChartCard
              title="4 · Validate"
              description="Preview the normalized rows before committing to the database."
            >
              {validating ? (
                <div className="space-y-2">
                  <div className="h-8 animate-pulse rounded bg-muted/40" />
                  <div className="h-8 animate-pulse rounded bg-muted/40" />
                  <div className="h-8 animate-pulse rounded bg-muted/40" />
                </div>
              ) : (
                <>
                  {applyError && (
                    <Alert tone="error" title="Validation failed" className="mb-3">
                      {applyError}
                    </Alert>
                  )}
                  <Alert
                    tone={applyResult?.is_valid ? "success" : "error"}
                    title={applyResult?.is_valid ? "Mapping is valid" : "Mapping is invalid"}
                  >
                    {applyResult?.is_valid
                      ? `${applyResult.preview?.length ?? 0} preview rows ready.`
                      : "Correct the mapping before continuing."}
                  </Alert>
                  <Tabs defaultValue="preview" className="mt-3">
                    <TabsList className="h-8">
                      <TabsTrigger value="preview" className="text-[11px]">
                        Preview ({applyResult?.preview?.length ?? 5})
                      </TabsTrigger>
                      <TabsTrigger value="mapping" className="text-[11px]">
                        Applied mapping
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview">
                      <div className="overflow-x-auto rounded-lg border border-border/80">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 text-muted-foreground">
                            <tr>
                              <th className="px-2 py-2">session.id</th>
                              <th className="px-2 py-2">agent</th>
                              <th className="px-2 py-2">model</th>
                              <th className="px-2 py-2">tokens</th>
                              <th className="px-2 py-2">tool</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(applyResult?.preview ?? []).map((row, i) => (
                              <tr
                                key={i}
                                className="border-t border-border/50"
                              >
                                <td className="px-2 py-2 font-mono text-foreground">
                                  {previewField(row, "session", "external_session_id")}
                                </td>
                                <td className="px-2 py-2">
                                  {previewField(row, "session", "agent")}
                                </td>
                                <td className="px-2 py-2 font-mono text-muted-foreground">
                                  {previewField(row, "session", "model")}
                                </td>
                                <td className="px-2 py-2 font-mono tabular-nums">
                                  {previewField(row, "model_calls", "prompt_tokens")}
                                </td>
                                <td className="px-2 py-2">{previewTool(row)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                    <TabsContent value="mapping">
                      <pre className="overflow-x-auto rounded-lg border border-border/80 bg-muted/20 p-3 font-mono text-[11px] text-muted-foreground">
                        {JSON.stringify(buildMapping(), null, 2)}
                      </pre>
                    </TabsContent>
                  </Tabs>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("map")}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => go("import")}
                      disabled={!applyResult?.is_valid}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Proceed to
                      import
                    </Button>
                  </div>
                </>
              )}
            </ChartCard>
          )}

          {step === "import" && (
            <ChartCard
              title="5 · Import"
              description={
                outcome
                  ? "Import finished — review the report below."
                  : "Running the idempotent import pipeline (sha256 + dedupe)."
              }
            >
              {importing ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Hashing file · parsing rows · normalizing · deduplicating ·
                    persisting…
                  </div>
                  <div className="space-y-2">
                    {[80, 60, 40, 20].map((w, i) => (
                      <div
                        key={i}
                        className="h-6 animate-pulse rounded bg-muted/40"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </div>
              ) : outcome ? (
                <div className="space-y-4">
                  <Alert
                    tone={outcomeMap[outcome].tone}
                    title={outcomeMap[outcome].title}
                  >
                    <div className="text-foreground/90">
                      {outcomeMap[outcome].body}
                    </div>
                  </Alert>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Rows read" value={rowsReadValue} />
                    <Stat label="Sessions" value={sessionsValue} />
                    <Stat label="Duplicates" value={duplicatesValue} />
                    <Stat label="Rejections" value={rejectionsValue} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={reset}>
                      Import another
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate("/sessions")}
                    >
                      View sessions <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Ready to import {displayRowCount.toLocaleString()}{" "}
                    rows into{" "}
                    {sourceOptions.find((s) => s.id === sourceId)?.name ??
                      "the source"}
                    .
                  </p>
                  <Button size="sm" onClick={startImport}>
                    <Database className="mr-1 h-3.5 w-3.5" /> Run import
                  </Button>
                </div>
              )}
            </ChartCard>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <ChartCard
            title="Assistant"
            description="Conversational guidance through the import"
            badge="AI"
          >
            <div className="space-y-3">
              <Message role="agent">
                <p>
                  Hi — I'll help you import a new source. Drop a file and I'll
                  inspect its structure, propose a mapping, flag ambiguities,
                  and preview before anything is written.
                </p>
              </Message>
              <Message role="user">
                <p>
                  Importing{" "}
                  <span className="font-medium text-foreground">
                    {sourceType.toUpperCase()}
                  </span>{" "}
                  into{" "}
                  <span className="font-medium text-foreground">
                    {sourceOptions.find((s) => s.id === sourceId)?.name}
                  </span>
                  .
                </p>
              </Message>
              {completed.length > 0 && (
                <Message role="agent">
                  <p>
                    Step <span className="font-medium">{step}</span> in progress.
                    {outcome && (
                      <>
                        {" "}
                        Outcome:{" "}
                        <span className="font-medium">{outcome}</span>.
                      </>
                    )}
                  </p>
                </Message>
              )}
            </div>
          </ChartCard>

          <ChartCard
            title="Recent imports"
            description={`${imports?.length ?? 0} runs`}
          >
            <div className="flex flex-col gap-2">
              {(imports ?? []).slice(0, 6).map((imp) => {
                const src = sourceOptions.find(
                  (s) => s.id === imp.source_id,
                );
                return (
                  <div
                    key={imp.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-foreground">
                        {imp.filename}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {src?.name ?? imp.source_id} ·{" "}
                        {relativeTime(imp.created_at)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        imp.status === "ok"
                          ? "success"
                          : imp.status === "duplicate"
                            ? "secondary"
                            : imp.status === "warning"
                              ? "warning"
                              : "destructive"
                      }
                      className="shrink-0 text-[10px]"
                    >
                      {imp.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {formatNumber(value)}
      </div>
    </div>
  );
}
