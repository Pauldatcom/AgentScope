/** Convert a mapping-assistant proposal into the engine's nested mapping. */

interface EngineMapping {
  session: Record<string, string>;
  model_call: Record<string, string>;
  tool_call: Record<string, string>;
}

export interface MappingRow {
  sourceField: string;
  targetField: string | null;
  confidence: number;
  note?: string;
}

interface ProposalField {
  source_field: string;
  target_field: string;
  confidence: number;
  explanation?: string;
  ambiguity?: string | null;
}

const SESSION_TARGETS = [
  "external_session_id",
  "agent",
  "model",
  "started_at",
  "ended_at",
] as const;

const MODEL_CALL_TARGETS = [
  "round_index",
  "model",
  "prompt_tokens",
  "completion_tokens",
  "cache_creation_tokens",
  "latency_ms",
  "is_error",
  "occurred_at",
] as const;

const TOOL_CALL_TARGETS = [
  "tools_path",
  "tool_name",
  "input_chars",
  "result_chars",
  "wall_latency_ms",
  "internal_latency_ms",
  "is_error",
  "occurred_at",
] as const;

export const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: "__none__", label: "unmapped" },
  ...SESSION_TARGETS.map((t) => ({
    value: `session.${t}`,
    label: `session.${t}`,
  })),
  ...MODEL_CALL_TARGETS.map((t) => ({
    value: `model_call.${t}`,
    label: `model_call.${t}`,
  })),
  ...TOOL_CALL_TARGETS.map((t) => ({
    value: `tool_call.${t}`,
    label: `tool_call.${t}`,
  })),
];

function emptyEngineMapping(): EngineMapping {
  return { session: {}, model_call: {}, tool_call: {} };
}

function qualifyTarget(target: string): string | null {
  if (!target) return null;
  if (target.includes(".")) return target;
  if ((SESSION_TARGETS as readonly string[]).includes(target) && target !== "model") {
    return `session.${target}`;
  }
  if ((TOOL_CALL_TARGETS as readonly string[]).includes(target)) {
    return `tool_call.${target}`;
  }
  if ((MODEL_CALL_TARGETS as readonly string[]).includes(target) || target === "model") {
    return `model_call.${target}`;
  }
  return null;
}

export function engineMappingFromRows(rows: MappingRow[]): EngineMapping {
  const mapping = emptyEngineMapping();
  for (const row of rows) {
    if (!row.targetField) continue;
    const dot = row.targetField.indexOf(".");
    if (dot <= 0) continue;
    const section = row.targetField.slice(0, dot);
    const field = row.targetField.slice(dot + 1);
    if (section === "session" || section === "model_call" || section === "tool_call") {
      mapping[section][field] = row.sourceField;
    }
    if (section === "model_call" && field === "model" && !mapping.session.model) {
      mapping.session.model = row.sourceField;
    }
  }
  return mapping;
}

export function rowsFromProposal(
  fields: string[],
  proposal: ProposalField[],
): MappingRow[] {
  const bySource = new Map(proposal.map((f) => [f.source_field, f]));
  return fields.map((name) => {
    const p = bySource.get(name);
    return {
      sourceField: name,
      targetField: p ? qualifyTarget(p.target_field) : null,
      confidence: p?.confidence ?? 0,
      note: p?.ambiguity || p?.explanation || undefined,
    };
  });
}
