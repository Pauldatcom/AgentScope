# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `v0.1.x` | yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public
issue. Instead, email the maintainers at
[security@agentscope.dev](mailto:security@agentscope.dev) (or open a
private security advisory via GitHub's "Report a vulnerability" button).

We will acknowledge receipt within 48 hours and provide a timeline for a
fix. Please include:

- A description of the vulnerability
- Steps to reproduce
- The potential impact

## Disclosure

We follow coordinated disclosure: we will publish a fix and a
GitHub Security Advisory once the fix is available, crediting the
reporter unless they prefer to remain anonymous.

## Scope

- Vulnerabilities in the application code (API, domain logic, adapters)
- Leaking of API keys or secrets
- Injection via the import pipeline

## Out of scope

- Vulnerabilities in dependencies (report to the upstream project)
- Attacks requiring physical access to the server
- Social engineering
