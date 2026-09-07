# Observations

Three observations drawn from the TraceLab v0.0.1 sample (1000 lines, 28
sessions, 1118 tool calls). To reproduce: download the sample with
`bash scripts/fetch_sample.sh`, then import via `POST /imports/upload` with
`source_id=00000000-0000-0000-0000-000000000001` and `mapping_json={}` (the
active mapping is used automatically).

## 1 — Claude Opus 4-6 dominates token consumption

**Filters**: `source=tracelab`, `model=claude-opus-4-6`

| Model | Rounds | Prompt tokens | Completion tokens | Total |
|---|---:|---:|---:|---:|
| claude-opus-4-6 | 359 (35.9%) | 38,098,498 | 135,251 | 38,233,749 |
| claude-sonnet-4-6 | 243 (24.3%) | 26,891,431 | 163,324 | 27,054,755 |
| claude-opus-4-7 | 144 (14.4%) | 16,756,467 | 87,792 | 16,844,259 |
| claude-sonnet-4-5 | 102 (10.2%) | 7,292,268 | 26,969 | 7,319,237 |
| claude-opus-4-8 | 59 (5.9%) | 3,995,447 | 41,884 | 4,037,331 |
| claude-haiku-4-5 | 93 (9.3%) | 3,648,393 | 17,092 | 3,665,485 |

Claude Opus 4-6 accounts for **35.9%** of rounds but **38.2M tokens** —
**37.8%** of the total (101M). The prompt-to-completion ratio is extremely
skewed: 282:1 on average, indicating heavy prompt-cache reuse.

## 2 — Bash is the most-used tool (55.5%) and the most error-prone

**Filters**: `source=tracelab`, `tool_call.tool_name=Bash`

| Tool | Calls | Share | Errors | Error rate |
|---|---:|---:|---:|---:|
| Bash | 620 | 55.5% | 88 | 14.2% |
| Read | 250 | 22.4% | 17 | 6.8% |
| Edit | 102 | 9.1% | 3 | 2.9% |
| Grep | 51 | 4.6% | 0 | 0% |
| Write | 29 | 2.6% | 0 | 0% |

Bash accounts for over half of all tool calls and concentrates **80.7%** of
errors (88 out of 109). Read is the second most error-prone (6.8%). Writing
tools (Edit, Write, Grep) have near-zero error rates.

## 3 — Overall tool error rate is 9.7%

**Filters**: `source=tracelab` (all sessions)

Out of 1118 tool calls, 109 returned an error (9.7%). These errors are
concentrated in Bash (88) and Read (17), which together account for 96.3%
of all errors. Sessions without any error are rare; most sessions encounter
at least one tool failure during their execution.

---

**Method**: these figures are computed by the indicator engine
(`agentscope.domain.indicators`) from imported data, not by the AI. Missing
values (`NULL`) are excluded from sums, never replaced by zero. See
`docs/indicators.md` for exact definitions.
