# Compte rendu — import avec deux modèles IA

Le brief exige de tester le parcours d'identification et d'import avec au
moins deux modèles distincts. Ce document décrit les configurations testées,
le déroulement et les résultats, sans publier de secrets.

## Configurations testées

### Configuration 1 — `z-ai/glm-5.2` via OpenRouter

```env
IA_PROVIDER=openrouter
IA_MODEL=z-ai/glm-5.2
OPENROUTER_API_KEY=...    # clé personnelle, jamais commitée
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

**Déroulement** :
1. Upload d'un fichier JSONL inconnu via `POST /mappings/analyze`.
2. L'adaptateur `OpenRouterAdapter` envoie le profil des champs + un
   échantillon (3 lignes, tronqué à 4000 caractères) à l'API OpenRouter.
3. Le modèle `z-ai/glm-5.2` retourne un JSON de proposition de mapping.
4. La proposition est validée par `Validator` (champs requis présents).
5. L'utilisateur édite le mapping dans l'UI, prévisualise, puis valide.
6. Le moteur déterministe `ApplyMappingUseCase` applique le mapping validé.
7. Les données sont importées dans la base.

**Résultat** : le parcours complet fonctionne. Le modèle propose des
correspondances cohérentes pour les champs TraceLab (`session_id` →
`external_session_id`, `provider` → `agent`, `input_tokens_total` →
`prompt_tokens`, etc.). Le mapping est enregistré et réutilisable.

### Configuration 2 — `openai/gpt-4o-mini` via OpenRouter

```env
IA_PROVIDER=openrouter
IA_MODEL=openai/gpt-4o-mini
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

**Déroulement** : identique à la configuration 1. Le modèle `gpt-4o-mini`
propose un mapping légèrement différent (par exemple il mappe `model` →
`model` au lieu de `provider` → `agent`), mais le parcours de validation,
prévisualisation et import fonctionne de la même façon.

**Résultat** : le parcours complet fonctionne. Les mappings déjà enregistrés
restent utilisables après le changement de modèle — seul le proposition
initiale diffère.

### Configuration 3 (CI) — `FakeAgent` sans réseau

```env
IA_PROVIDER=fake
IA_MODEL=fake-local
OPENROUTER_API_KEY=     # vide
```

**Déroulement** : `FakeAgent` retourne un mapping canonique pour un JSONL
TraceLab-like, sans aucun appel réseau ni clé API. Le parcours complet
(analyse → validation → import) est exercé par `tests/e2e` à chaque PR.

**Résultat** : 41 tests verts sans réseau. Le substitut garantit que la CI
fonctionne sur n'importe quel environnement.

## Procédure de changement de modèle

1. Éditer `.env` : changer la valeur de `IA_MODEL`.
2. Redémarrer l'API : `uv run uvicorn agentscope.api.main:app --reload`.
3. `main.py` reconstruit l'adaptateur depuis `Settings` — aucun changement
   de code nécessaire.
4. Les mappings déjà enregistrés restent utilisables ; seule la proposition
   initiale pour un nouveau fichier inconnu peut différer.

## Outils IA employés

- **OpenRouter** (`https://openrouter.ai`) — routeur d'API LLM, un seul
  adaptateur couvre tous les modèles disponibles.
- **FakeAgent** — substitut déterministe codé dans
  `agentscope/adapters/ia/fake/agent.py`, sans dépendance externe.

## Composants externes réutilisés

- **FastAPI** — framework web Python pour l'API.
- **SQLAlchemy + Alembic** — ORM et migrations PostgreSQL.
- **pandas + pyarrow** — lecture CSV et Parquet.
- **React + Vite + Recharts + Tailwind CSS** — frontend.
- **PostgreSQL 16** — stockage relationnel (via Docker Compose).
- **uv** — gestionnaire de dépendances Python.
