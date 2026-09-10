import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  Sparkles,
  Wand2,
  ShieldCheck,
  FileText,
  RefreshCw,
  ArrowRight,
  Database,
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
  engineMappingFromRows,
  rowsFromProposal,
  TARGET_OPTIONS,
  type MappingRow,
} from "@/mapping";
import { cn, relativeTime } from "@/lib/utils";
import {
  IMPORT_STEPS,
  SOURCE_TYPES,
  sampleText,
  tokenLabel,
  type ImportOutcome,
  type ImportStep,
  type PreviewSession,
  type SourceType,
} from "./imports";
import { ConfidenceBar, Message, Stat } from "./imports-ui";

export function ImportsPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<ImportStep>("upload");
  const [completed, setCompleted] = React.useState<ImportStep[]>([]);
  const [sourceType, setSourceType] = React.useState<SourceType>("jsonl");
  const [sourceId, setSourceId] = React.useState<string>("");
  const [fileName, setFileName] = React.useState<string>("");
  const [file, setFile] = React.useState<File | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [creatingSource, setCreatingSource] = React.useState(false);
  const [showNewSource, setShowNewSource] = React.useState(false);
  const [newSource, setNewSource] = React.useState({
    name: "",
    version: "",
    method: "",
    license: "",
  });
  const [outcome, setOutcome] = React.useState<ImportOutcome>(null);
  const [analysis, setAnalysis] = React.useState<AnalysisOut | null>(null);
  const [mappingRows, setMappingRows] = React.useState<MappingRow[]>([]);
  const [applyResult, setApplyResult] = React.useState<ApplyMappingOut | null>(
    null,
  );
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [sourceError, setSourceError] = React.useState<string | null>(null);
  const [importReport, setImportReport] =
    React.useState<ImportReportOut | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [saveWarning, setSaveWarning] = React.useState<string | null>(null);

  const { data: sources, refetch: refetchSources } = useApi<SourceOut[]>(
    () => api.fetchSources(),
    [],
  );
  const { data: imports, refetch: refetchImports } = useApi<ImportRunOut[]>(
    () => api.fetchImports(20),
    [],
  );

  React.useEffect(() => {
    if (!sourceId && sources && sources.length > 0) {
      setSourceId(sources[0].id);
    }
  }, [sources, sourceId]);

  const engineMapping = React.useMemo(
    () => engineMappingFromRows(mappingRows),
    [mappingRows],
  );
  const mappingJson = JSON.stringify(engineMapping, null, 2);
  const selectedSource = (sources ?? []).find((s) => s.id === sourceId);
  const accept =
    SOURCE_TYPES.find((t) => t.id === sourceType)?.accept ?? ".jsonl,.json,.csv";
  const sessionKey =
    mappingRows.find((r) => r.targetField === "session.external_session_id")
      ?.sourceField ?? analysis?.fields[0];

  const go = (next: ImportStep) => {
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
    setMappingRows([]);
    setApplyResult(null);
    setAnalyzeError(null);
    setApplyError(null);
    setSourceError(null);
    setImportReport(null);
    setImportError(null);
    setSaveWarning(null);
  };

  const createSource = async () => {
    if (!newSource.name.trim() || !newSource.version.trim() || !newSource.method.trim()) {
      setSourceError("Name, version and retrieval method are required.");
      return;
    }
    setCreatingSource(true);
    setSourceError(null);
    try {
      const created = await api.createSource({
        name: newSource.name.trim(),
        version: newSource.version.trim(),
        method: newSource.method.trim(),
        license: newSource.license.trim() || null,
      });
      setSourceId(created.id);
      setShowNewSource(false);
      setNewSource({ name: "", version: "", method: "", license: "" });
      await refetchSources();
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingSource(false);
    }
  };

  const startAnalyze = async () => {
    if (!file) {
      setAnalyzeError("Choose a file first.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setMappingRows([]);
    setApplyResult(null);
    go("analyze");
    try {
      const result = await api.analyzeMapping(file);
      setAnalysis(result);
      setMappingRows(rowsFromProposal(result.fields, result.proposal.fields));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const previewMapping = async () => {
    if (!file) {
      setApplyError("No file selected.");
      return;
    }
    if (!sourceId) {
      setApplyError("Select or create a destination source first.");
      return;
    }
    if (!engineMapping.session.external_session_id) {
      setApplyError("Map a source field to session.external_session_id.");
      return;
    }
    setValidating(true);
    setApplyError(null);
    setSaveWarning(null);
    try {
      const result = await api.applyMapping(
        file,
        JSON.stringify(engineMapping),
        sourceId,
      );
      setApplyResult(result);
      if (!result.is_valid) {
        setApplyError(result.errors.join(" ") || "Mapping is invalid.");
        return;
      }
      try {
        await api.saveMapping({
          source_id: sourceId,
          mapping: engineMapping,
          created_by: "ui",
        });
      } catch (err) {
        setSaveWarning(
          err instanceof Error
            ? `Mapping preview is valid, but saving it failed: ${err.message}`
            : "Mapping preview is valid, but saving it failed.",
        );
      }
    } catch (err) {
      setApplyResult(null);
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setValidating(false);
    }
  };

  const confirmMapping = () => {
    go("validate");
    void previewMapping();
  };

  const startImport = async () => {
    if (!file) {
      setImportError("No file selected.");
      setOutcome("error");
      return;
    }
    if (!sourceId) {
      setImportError("Select or create a destination source first.");
      setOutcome("error");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const report = await api.uploadImport(
        file,
        sourceId,
        JSON.stringify(engineMapping),
      );
      setImportReport(report);
      await refetchImports();
      if (report.is_duplicate_run || report.status === "duplicate") {
        setOutcome("duplicate");
      } else if (report.status === "rejected") {
        setOutcome("error");
        setImportError("The file was rejected. Inspect rejections on Data quality.");
      } else if (report.status === "ok") {
        setOutcome("success");
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

  const previewSessions = (applyResult?.preview ?? []) as PreviewSession[];
  const profilesByName = new Map(
    (analysis?.profiles ?? []).map((p) => [p.name, p]),
  );

  const outcomeMap: Record<
    Exclude<ImportOutcome, null>,
    {
      title: string;
      tone: "success" | "warning" | "error" | "info";
      body: React.ReactNode;
    }
  > = {
    success: {
      title: "Import successful",
      tone: "success",
      body: (
        <>
          {importReport?.rows_read.toLocaleString()} rows read into{" "}
          <span className="font-medium text-foreground">
            {selectedSource?.name ?? "the selected source"}
          </span>
          . Sessions, model calls and tool calls below come from the import
          report — missing values stay missing.
        </>
      ),
    },
    warnings: {
      title: "Imported with warnings",
      tone: "warning",
      body: (
        <>
          Import finished with status{" "}
          <span className="font-mono">{importReport?.status}</span>. Review the
          counts before comparing this source to others.
        </>
      ),
    },
    duplicate: {
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
      title: "Import failed",
      tone: "error",
      body: <>{importError ?? "The import did not complete."}</>,
    },
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Imports"
        description="Import agent traces with a proposed mapping — or browse past imports."
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
          steps={IMPORT_STEPS}
          current={step}
          completed={completed}
          onStepClick={(id) => setStep(id as ImportStep)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {step === "upload" && (
            <ChartCard
              title="1 · Upload"
              description="Choose a source type, create or pick a destination, then drop a file."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SOURCE_TYPES.map((t) => (
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
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">
                      {t.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Destination source
                  </label>
                  <Select
                    value={sourceId || undefined}
                    onValueChange={setSourceId}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select a source" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sources ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedSource
                      ? `${selectedSource.method}${selectedSource.license ? ` · ${selectedSource.license}` : ""}`
                      : "Create a source for a new dataset (do not reuse TraceLab for SWE-chat)."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[11px]"
                    onClick={() => setShowNewSource((open) => !open)}
                  >
                    {showNewSource ? "Cancel" : "New source"}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    File
                  </label>
                  <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                    <UploadCloud className="h-3.5 w-3.5" />
                    {fileName || `Drop a ${sourceType.toUpperCase()} file`}
                    <input
                      type="file"
                      className="hidden"
                      accept={accept}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFile(f);
                        setFileName(f?.name ?? "");
                        setAnalyzeError(null);
                      }}
                    />
                  </label>
                </div>
              </div>
              {showNewSource && (
                <div className="mt-3 grid gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 sm:grid-cols-2">
                  <input
                    value={newSource.name}
                    onChange={(e) =>
                      setNewSource((s) => ({ ...s, name: e.target.value }))
                    }
                    placeholder="Name (e.g. swe-chat)"
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={newSource.version}
                    onChange={(e) =>
                      setNewSource((s) => ({ ...s, version: e.target.value }))
                    }
                    placeholder="Version (e.g. hf-2026-09-10)"
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={newSource.method}
                    onChange={(e) =>
                      setNewSource((s) => ({ ...s, method: e.target.value }))
                    }
                    placeholder="Retrieval method"
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
                  />
                  <input
                    value={newSource.license}
                    onChange={(e) =>
                      setNewSource((s) => ({ ...s, license: e.target.value }))
                    }
                    placeholder="License (optional)"
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <Button
                      size="sm"
                      onClick={() => void createSource()}
                      disabled={creatingSource}
                    >
                      {creatingSource ? "Creating…" : "Create source"}
                    </Button>
                  </div>
                </div>
              )}
              {sourceError && (
                <Alert tone="error" title="Could not create source" className="mt-3">
                  {sourceError}
                </Alert>
              )}
              {analyzeError && step === "upload" && (
                <Alert tone="error" title="Cannot analyze" className="mt-3">
                  {analyzeError}
                </Alert>
              )}
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void startAnalyze()}
                  disabled={!file || analyzing}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Analyze
                </Button>
              </div>
            </ChartCard>
          )}

          {step === "analyze" && (
            <ChartCard
              title="2 · Analyze"
              description="The assistant profiles columns and samples values. Nothing is written yet."
              action={
                <Badge variant="info" className="text-[10px]">
                  <Sparkles className="mr-1 h-3 w-3" /> Proposal
                </Badge>
              }
            >
              {analyzing ? (
                <div className="space-y-3">
                  <Message role="agent">
                    <p>Reading the file and profiling fields…</p>
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
              ) : analyzeError ? (
                <div className="space-y-3">
                  <Alert tone="error" title="Analysis failed">
                    {analyzeError}
                  </Alert>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                      Back
                    </Button>
                  </div>
                </div>
              ) : analysis ? (
                <div className="space-y-3">
                  <Message role="agent">
                    <p>
                      Found{" "}
                      <span className="font-medium text-foreground">
                        {analysis.row_count.toLocaleString()} rows
                      </span>{" "}
                      across{" "}
                      <span className="font-medium text-foreground">
                        {analysis.fields.length} fields
                      </span>
                      {sessionKey ? (
                        <>
                          . Likely session key:{" "}
                          <code className="rounded bg-muted px-1 font-mono text-foreground">
                            {sessionKey}
                          </code>
                          .
                        </>
                      ) : (
                        "."
                      )}
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
                        {analysis.fields.map((name) => {
                          const profile = profilesByName.get(name);
                          const nullable =
                            profile !== undefined && profile.non_null_ratio < 1;
                          return (
                            <tr key={name} className="border-t border-border/50">
                              <td className="px-3 py-2 font-mono text-foreground">
                                {name}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {profile?.inferred_type ?? "—"}
                              </td>
                              <td className="px-3 py-2 font-mono text-muted-foreground">
                                {sampleText(profile?.examples[0])}
                              </td>
                              <td className="px-3 py-2">
                                {nullable ? (
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
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                      Back
                    </Button>
                    <Button size="sm" onClick={() => go("map")}>
                      Propose mapping <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert tone="warning" title="No analysis yet">
                  Upload a file and run Analyze.
                </Alert>
              )}
            </ChartCard>
          )}

          {step === "map" && (
            <ChartCard
              title="3 · Map fields"
              description="Review the proposed mapping. Edit targets before anything is stored."
              action={
                <Badge variant="info" className="text-[10px]">
                  <Wand2 className="mr-1 h-3 w-3" /> Proposal
                </Badge>
              }
            >
              {!analysis ? (
                <Alert tone="warning" title="No analysis yet">
                  Analyze a file before mapping fields.
                </Alert>
              ) : (
                <>
                  <Message role="agent">
                    <p>{analysis.proposal.explanation}</p>
                  </Message>
                  {analysis.proposal.ambiguities.length > 0 && (
                    <Alert
                      tone="warning"
                      title={`${analysis.proposal.ambiguities.length} note${analysis.proposal.ambiguities.length > 1 ? "s" : ""} to review`}
                      className="mt-3"
                    >
                      <ul className="ml-3 list-disc space-y-0.5">
                        {analysis.proposal.ambiguities.map((a, i) => (
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
                        {mappingRows.map((m) => (
                          <tr
                            key={m.sourceField}
                            className="border-t border-border/50"
                          >
                            <td className="px-3 py-2 font-mono text-foreground">
                              {m.sourceField}
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                value={m.targetField ?? "__none__"}
                                onValueChange={(value) =>
                                  setMappingRows((rows) =>
                                    rows.map((row) =>
                                      row.sourceField === m.sourceField
                                        ? {
                                            ...row,
                                            targetField:
                                              value === "__none__" ? null : value,
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 min-w-[11rem] text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TARGET_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-border/80 bg-muted/20 p-3 font-mono text-[11px] text-muted-foreground">
                    {mappingJson}
                  </pre>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("analyze")}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmMapping}
                      disabled={!engineMapping.session.external_session_id}
                    >
                      Confirm mapping
                    </Button>
                  </div>
                </>
              )}
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
                  {saveWarning && (
                    <Alert tone="warning" title="Mapping not saved" className="mb-3">
                      {saveWarning}
                    </Alert>
                  )}
                  {applyResult?.is_valid ? (
                    <Alert tone="success" title="Mapping is valid">
                      Required session id is present.{" "}
                      {previewSessions.length} preview session
                      {previewSessions.length === 1 ? "" : "s"} from the file.
                    </Alert>
                  ) : !applyError ? (
                    <Alert tone="info" title="Preview not run">
                      Confirm the mapping to preview normalized rows.
                    </Alert>
                  ) : null}
                  {applyResult?.warnings && applyResult.warnings.length > 0 && (
                    <Alert tone="warning" title="Warnings" className="mt-3">
                      <ul className="ml-3 list-disc space-y-0.5">
                        {applyResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                  <Tabs defaultValue="preview" className="mt-3">
                    <TabsList className="h-8">
                      <TabsTrigger value="preview" className="text-[11px]">
                        Preview ({previewSessions.length})
                      </TabsTrigger>
                      <TabsTrigger value="mapping" className="text-[11px]">
                        Applied mapping
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview">
                      {previewSessions.length === 0 ? (
                        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                          No preview rows yet.
                        </p>
                      ) : (
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
                              {previewSessions.map((row, i) => (
                                <tr
                                  key={row.session?.external_session_id ?? i}
                                  className="border-t border-border/50"
                                >
                                  <td className="px-2 py-2 font-mono text-foreground">
                                    {row.session?.external_session_id ?? "—"}
                                  </td>
                                  <td className="px-2 py-2">
                                    {row.session?.agent ?? "—"}
                                  </td>
                                  <td className="px-2 py-2 font-mono text-muted-foreground">
                                    {row.session?.model ??
                                      row.model_calls?.[0]?.model ??
                                      "—"}
                                  </td>
                                  <td className="px-2 py-2 font-mono tabular-nums">
                                    {tokenLabel(row.model_calls)}
                                  </td>
                                  <td className="px-2 py-2">
                                    {row.tool_calls?.[0]?.tool_name ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="mapping">
                      <pre className="overflow-x-auto rounded-lg border border-border/80 bg-muted/20 p-3 font-mono text-[11px] text-muted-foreground">
                        {mappingJson}
                      </pre>
                    </TabsContent>
                  </Tabs>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("map")}>
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void previewMapping()}
                    >
                      Re-run preview
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
                    <Stat label="Rows read" value={importReport?.rows_read} />
                    <Stat
                      label="Sessions"
                      value={importReport?.sessions_imported}
                    />
                    <Stat
                      label="Model calls"
                      value={importReport?.model_calls_imported}
                    />
                    <Stat
                      label="Tool calls"
                      value={importReport?.tool_calls_imported}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Duplicates" value={importReport?.duplicates} />
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
                    Ready to import{" "}
                    {analysis
                      ? `${analysis.row_count.toLocaleString()} rows from ${fileName}`
                      : fileName || "the selected file"}{" "}
                    into {selectedSource?.name ?? "the selected source"}.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => void startImport()}
                    disabled={!file || !sourceId || !applyResult?.is_valid}
                  >
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
            description="Guidance through the import"
            badge="AI"
          >
            <div className="space-y-3">
              <Message role="agent">
                <p>
                  Drop a file. I propose a mapping, you edit it, then the
                  engine validates and imports. I do not write to the database.
                </p>
              </Message>
              <Message role="user">
                <p>
                  Importing{" "}
                  <span className="font-medium text-foreground">
                    {sourceType.toUpperCase()}
                  </span>
                  {fileName ? (
                    <>
                      {" "}
                      (<span className="font-mono">{fileName}</span>)
                    </>
                  ) : null}{" "}
                  into{" "}
                  <span className="font-medium text-foreground">
                    {selectedSource?.name ?? "a new source"}
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
                const src = (sources ?? []).find(
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
