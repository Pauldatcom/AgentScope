# Indicators

Each indicator documents its calculation, unit, scope and how missing values
are treated. A missing value is NEVER turned into a zero.

## tokens_by_model
- **Calc**: `SUM(prompt_tokens + completion_tokens) GROUP BY model`
- **Unit**: tokens
- **Scope**: `model_call` rows, filtered by the active dashboard filters.
- **Missing**: rows with `NULL` token counts are excluded from sums; they are
  counted as a row but contribute 0 to the total. Sessions where no model call
  has a non-null token count do not appear in the per-model bucket.

## sessions_by_agent
- **Calc**: `COUNT(*) GROUP BY agent`
- **Unit**: sessions
- **Scope**: `session` rows.
- **Missing**: sessions with `agent IS NULL` are grouped under `unknown`.

## tool_distribution
- **Calc**: `COUNT(*) GROUP BY tool_name; share = count / total`
- **Unit**: count + percent
- **Scope**: `tool_call` rows.
- **Missing**: sessions without tool calls contribute 0 to the total but do
  not appear as a tool name.

## error_rate
- **Calc**: `COUNT(sessions with any is_error) / COUNT(sessions)`
- **Unit**: percent
- **Scope**: `session` rows.
- **Missing**: sessions where the error status is unknown are excluded from
  both numerator and denominator — never counted as 0%.
