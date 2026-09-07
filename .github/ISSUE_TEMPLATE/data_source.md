---
name: New data source
about: Propose adding support for a new agent trace format
title: "[source] "
labels: data-source
assignees: ""
---

## Source name

Name of the dataset or tool (e.g. "SWE-chat", "Trace Commons").

## Source location

URL or reference where the data can be obtained.

## Data format

Describe the file format (JSONL, CSV, Parquet, ...) and the structure
of a single row. Paste a small anonymized sample if possible.

```json
{
  "example_field": "..."
}
```

## Proposed mapping

Which source fields map to the AgentScope model? See
[`docs/mappings.md`](../../docs/mappings.md) for the schema.

| Source field | Target field | Notes |
|---|---|---|
| ... | `session.external_session_id` | ... |
| ... | `model_call.prompt_tokens` | ... |

## License

Under what license is the data distributed? Can it be redistributed?
