# Observations chiffrées

Trois observations tirées de l'échantillon TraceLab v0.0.1 (1000 lignes,
28 sessions, 1118 appels d'outils). Pour reproduire : télécharger l'échantillon
avec `bash scripts/fetch_sample.sh`, puis importer via
`POST /imports/upload` avec `source_id=00000000-0000-0000-0000-000000000001`
et `mapping_json={}` (le mapping actif est utilisé automatiquement).

## Observation 1 — Claude Opus 4-6 domine la consommation de tokens

**Filtres** : `source=tracelab`, `model=claude-opus-4-6`

| Modèle | Rounds | Prompt tokens | Completion tokens | Total |
|---|---:|---:|---:|---:|
| claude-opus-4-6 | 359 (35,9%) | 38 098 498 | 135 251 | 38 233 749 |
| claude-sonnet-4-6 | 243 (24,3%) | 26 891 431 | 163 324 | 27 054 755 |
| claude-opus-4-7 | 144 (14,4%) | 16 756 467 | 87 792 | 16 844 259 |
| claude-sonnet-4-5 | 102 (10,2%) | 7 292 268 | 26 969 | 7 319 237 |
| claude-opus-4-8 | 59 (5,9%) | 3 995 447 | 41 884 | 4 037 331 |
| claude-haiku-4-5 | 93 (9,3%) | 3 648 393 | 17 092 | 3 665 485 |

Claude Opus 4-6 représente **35,9%** des rounds mais **38,2M tokens** soit
**37,8%** du total (101M). Le ratio prompt/completion est extrêmement
déséquilibré : 282:1 en moyenne — les sessions réutilisent massivement le
cache de prompt (prefix tokens).

## Observation 2 — Bash est l'outil le plus utilisé (55,5%) et le plus error-prone

**Filtres** : `source=tracelab`, `tool_call.tool_name=Bash`

| Outil | Appels | Part | Erreurs | Taux d'erreur |
|---|---:|---:|---:|---:|
| Bash | 620 | 55,5% | 88 | 14,2% |
| Read | 250 | 22,4% | 17 | 6,8% |
| Edit | 102 | 9,1% | 3 | 2,9% |
| Grep | 51 | 4,6% | 0 | 0% |
| Write | 29 | 2,6% | 0 | 0% |

Bash représente plus de la moitié des appels d'outils et concentre
**80,7%** des erreurs (88 sur 109). Read est le second plus error-prone
(6,8%). Les outils d'écriture (Edit, Write, Grep) ont un taux d'erreur
quasi-nul.

## Observation 3 — Le taux d'erreur global des outils est de 9,7%

**Filtres** : `source=tracelab` (toutes sessions)

Sur 1118 appels d'outils, 109 ont retourné une erreur (9,7%). Ces erreurs
sont concentrées sur Bash (88) et Read (17), soit 96,3% du total. Les
sessions sans erreur aucune sont rares ; la majorité des sessions
rencontrent au moins un échec d'outil pendant leur déroulement.

---

**Méthode** : ces chiffres sont calculés par le moteur d'indicateurs
(`agentscope.domain.indicators`) à partir des données importées, pas par
l'IA. Les valeurs manquantes (`NULL`) sont exclues des sommes, jamais
remplacées par zéro. Voir `docs/indicators.md` pour les définitions exactes.
