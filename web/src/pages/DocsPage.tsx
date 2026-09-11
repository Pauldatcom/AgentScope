import { PageHeader } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { api, type IndicatorDefOut } from "@/api";
import { useApi } from "@/hooks/useApi";

const TARGET_SCHEMA: {
  group: string;
  fields: { name: string; type: string; desc: string }[];
}[] = [
  {
    group: "Session",
    fields: [
      { name: "external_session_id", type: "str", desc: "Unique id of the session within the source" },
      { name: "agent", type: "str|null", desc: "Agent name (claude, codex, ...)" },
      { name: "model", type: "str|null", desc: "Model name (gpt-4o, claude-3-5-sonnet, ...)" },
      { name: "started_at", type: "datetime|null", desc: "Session start — derived from first model_call if not mapped" },
      { name: "ended_at", type: "datetime|null", desc: "Session end — derived from last model_call if not mapped" },
    ],
  },
  {
    group: "Model call",
    fields: [
      { name: "round_index", type: "int", desc: "Round number within session" },
      { name: "model", type: "str|null", desc: "Model used for this round" },
      { name: "prompt_tokens", type: "int|null", desc: "Input tokens consumed" },
      { name: "completion_tokens", type: "int|null", desc: "Output tokens generated" },
      { name: "cache_creation_tokens", type: "int|null", desc: "Cache creation tokens (Claude only)" },
      { name: "latency_ms", type: "int|null", desc: "LLM response latency" },
      { name: "is_error", type: "bool", desc: "Whether the call failed" },
      { name: "occurred_at", type: "datetime|null", desc: "When the call happened — supports ISO strings and epoch ms/s" },
    ],
  },
  {
    group: "Tool call",
    fields: [
      { name: "tools_path", type: "str", desc: "Dotted path to the tools array within the row (nested traces)" },
      { name: "tool_name", type: "str", desc: "Tool invoked (Bash, Read, Edit, ...)" },
      { name: "input_chars", type: "int|null", desc: "Input size in characters" },
      { name: "result_chars", type: "int|null", desc: "Result size in characters" },
      { name: "wall_latency_ms", type: "int|null", desc: "Wall-clock latency" },
      { name: "internal_latency_ms", type: "int|null", desc: "Internal latency" },
      { name: "is_error", type: "bool", desc: "Whether the tool call failed" },
      { name: "occurred_at", type: "datetime|null", desc: "When the tool call happened" },
    ],
  },
];

const DATA_MODEL: {
  table: string;
  key: string;
  desc: string;
  relations: string;
}[] = [
  { table: "source", key: "id", desc: "Dataset provenance (TraceLab, SWE-chat, ...)", relations: "1→N import_run, session, mapping" },
  { table: "import_run", key: "file_hash (unique)", desc: "One file upload attempt — idempotent", relations: "1→N session, rejection" },
  { table: "session", key: "(source_id, external_session_id)", desc: "One coding-agent session", relations: "1→N model_call, tool_call" },
  { table: "model_call", key: "id", desc: "One LLM round within a session", relations: "N→1 session; 1→N tool_call" },
  { table: "tool_call", key: "id", desc: "One tool invocation within a session", relations: "N→1 session, model_call" },
  { table: "mapping", key: "(source_id, version)", desc: "Reusable field-to-field correspondence", relations: "N→1 source" },
  { table: "rejection", key: "id", desc: "One rejected row with reason + excerpt", relations: "N→1 import_run" },
];

const SOURCES: {
  name: string;
  origin: string;
  license: string;
  mapping: string;
  notes: string;
}[] = [
  {
    name: "TraceLab",
    origin: "github.com/uw-syfi/TraceLab v0.0.1",
    license: "CC-BY-4.0",
    mapping: "Nested tools array, one row per LLM round",
    notes: "Seeded at API startup. 357k rounds, 432k tool records.",
  },
  {
    name: "SWE-chat",
    origin: "huggingface.co/datasets/SALT-NLP/SWE-chat",
    license: "ODC-By (gated)",
    mapping: "Flat tool_name column, one row per conversation turn",
    notes: "Gated dataset — accept terms, then hf download --repo-type dataset.",
  },
  {
    name: "Trace Commons",
    origin: "huggingface.co/datasets/trace-commons/agent-traces",
    license: "Varies",
    mapping: "AI proposes, user edits — no hand-coded connector",
    notes: "Stress test for unknown structures.",
  },
];

function IndicatorsTab() {
  const { data, loading, error } = useApi(
    () => api.fetchDashboard({}),
    [],
  );

  if (loading) return <p className="text-sm text-muted-foreground">Loading indicator definitions…</p>;
  if (error) return <Alert tone="error" title="Could not load definitions">{error}</Alert>;

  const defs = data?.definitions;
  if (!defs) return <p className="text-sm text-muted-foreground">No definitions returned.</p>;

  const entries = Object.entries(defs) as [string, IndicatorDefOut][];

  return (
    <div className="space-y-3">
      <Alert tone="info" title="How indicators are computed">
        Indicators are computed by deterministic Python functions over the
        normalized entities — never by the AI. Missing values are kept as
        NULL, never silently turned into zero.
      </Alert>
      <div className="overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Formula</th>
              <th className="px-3 py-2 text-left font-medium">Unit</th>
              <th className="px-3 py-2 text-left font-medium">Scope</th>
              <th className="px-3 py-2 text-left font-medium">Missing values</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([id, d]) => (
              <tr key={id} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-primary">{id}</td>
                <td className="px-3 py-2 text-foreground">{d.name}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{d.calc}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.unit}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.scope}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MappingSchemaTab() {
  return (
    <div className="space-y-4">
      <Alert tone="info" title="AI proposes, the engine applies">
        The AI assistant profiles the file and proposes a field-to-field
        mapping. The deterministic engine applies it. The AI never writes to
        the database. Mappings are per-source, versioned, editable and
        reusable.
      </Alert>

      {TARGET_SCHEMA.map((group) => (
        <div key={group.group}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{group.group}</h3>
            <Badge variant="outline">{group.fields.length} fields</Badge>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Field</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {group.fields.map((f) => (
                  <tr key={f.name} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-primary">{f.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{f.type}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Timestamp formats</h3>
        <p className="text-xs text-muted-foreground">
          The normalizer accepts ISO 8601 strings (<code className="font-mono">2025-06-01T10:00:00Z</code>)
          and epoch integers (milliseconds if ≥ 10¹², seconds otherwise). Epoch
          timestamps are common in Parquet/Arrow datasets like SWE-chat.
        </p>
        <Alert tone="info" title="Session duration">
          If <code className="font-mono">started_at</code> / <code className="font-mono">ended_at</code>{" "}
          are not explicitly mapped, they are derived from the earliest and
          latest <code className="font-mono">model_call.occurred_at</code> in the session.
        </Alert>
      </div>
    </div>
  );
}

function DataModelTab() {
  return (
    <div className="space-y-3">
      <Alert tone="info" title="3NF relational schema">
        Every table has a single atomic key. Non-key attributes depend only on
        the key. <code className="font-mono">raw_payload</code> and{" "}
        <code className="font-mono">metadata</code> are JSONB escape hatches
        never used to compute indicators — they are projected into typed
        columns at normalization time.
      </Alert>
      <div className="overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-left font-medium">Key</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Relations</th>
            </tr>
          </thead>
          <tbody>
            {DATA_MODEL.map((t) => (
              <tr key={t.table} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-primary">{t.table}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{t.key}</td>
                <td className="px-3 py-2 text-foreground">{t.desc}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.relations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Alert tone="info" title="Idempotence">
        Re-importing the same file returns the existing ImportRun with{" "}
        <code className="font-mono">status="duplicate"</code> and inserts 0
        rows. The file SHA-256 hash guarantees this.
      </Alert>
    </div>
  );
}

function SourcesTab() {
  return (
    <div className="space-y-3">
      {SOURCES.map((s) => (
        <div key={s.name} className="rounded-lg border border-border/80 p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
            <Badge variant="outline">{s.license}</Badge>
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Origin</dt>
              <dd className="font-mono text-foreground">{s.origin}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Mapping</dt>
              <dd className="text-muted-foreground">{s.mapping}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Notes</dt>
              <dd className="text-muted-foreground">{s.notes}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

export function DocsPage() {
  return (
    <div>
      <PageHeader
        title="Documentation"
        description="Indicator definitions, mapping schema, data model and sources"
      />
      <Tabs defaultValue="indicators">
        <TabsList>
          <TabsTrigger value="indicators">Indicators</TabsTrigger>
          <TabsTrigger value="mapping">Mapping schema</TabsTrigger>
          <TabsTrigger value="data-model">Data model</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>
        <TabsContent value="indicators" className="mt-4">
          <IndicatorsTab />
        </TabsContent>
        <TabsContent value="mapping" className="mt-4">
          <MappingSchemaTab />
        </TabsContent>
        <TabsContent value="data-model" className="mt-4">
          <DataModelTab />
        </TabsContent>
        <TabsContent value="sources" className="mt-4">
          <SourcesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
