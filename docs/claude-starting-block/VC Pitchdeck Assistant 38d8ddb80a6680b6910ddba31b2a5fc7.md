# VC Pitchdeck Assistant

# Mindsets: MVP vs Prod

Prod mindset: Build only where it creates moat. Buy everything that's commodity infrastructure.

MVP mindset: build wherever you can. Always find the free (most accurate and conventional) open source alternative. Prefer OVH and EU based alternatives, tools and services (OVH and others)

# Full Architecture

```jsx
┌─────────────────────────────────────────────────────┐
│                   CLIENT LAYER                       │
│  Web App (Next.js)  │  API (partners/integrations)  │
│  Mobile (optional)  │  Slack / Email ingestion       │
└────────────────────────────┬────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────┐
│                   API GATEWAY                        │
│  Auth (Auth0 / Clerk)  │  Rate limiting              │
│  Tenant resolution     │  Audit logging              │
└────────────────────────────┬────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────┐
│              ORCHESTRATION LAYER (FastAPI)            │
│  Request routing per tenant                          │
│  Model selection logic (which LLM, which fine-tune)  │
│  Streaming response handler                          │
│  Async task queue (Celery + Redis)                   │
└──────┬──────────────┬───────────────┬───────────────┘
       │              │               │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────────┐
│  DOCUMENT   │ │ RETRIEVAL  │ │   MODEL LAYER       │
│  PIPELINE   │ │  LAYER     │ │                     │
│             │ │            │ │ Frontier LLM API    │
│ LlamaParse  │ │ pgvector   │ │ (Claude / GPT-4o)   │
│ Unstructured│ │ per tenant │ │                     │
│ Table/chart │ │ namespace  │ │ Fine-tuned models   │
│ extraction  │ │            │ │ (per tenant LoRA    │
│ OCR layer   │ │ BM25 index │ │ artifacts, S3)      │
│             │ │ + reranker │ │                     │
│ S3 per      │ │            │ │ Scoring model       │
│ tenant      │ │ Hybrid     │ │ (XGBoost ensemble)  │
└──────┬──────┘ │ retrieval  │ └─────────────────────┘
       │        └────────────┘
┌──────▼──────────────────────────────────────────────┐
│                  DATA LAYER                          │
│  PostgreSQL (metadata, users, tenants, audit logs)  │
│  S3 (raw decks, processed docs, model artifacts)    │
│  Redis (cache, queue, session)                      │
│  Vector stores (one namespace / index per tenant)   │
└─────────────────────────────────────────────────────┘
```

# The Proprietary Model Layer — Your Actual Moat

At startup scale, your competitive advantage is **not the LLM** (anyone can call the same API). It's:

1. **Per-tenant fine-tuned memo generation** — each VC firm gets a model that writes like their analysts. This is deeply sticky; switching costs are high once it's calibrated to a firm's voice and thesis.
2. **Cross-tenant (anonymized) outcome signals** — if you have 20 VC clients, you're accumulating the largest labeled dataset of deal outcomes in private markets. A deal scoring model trained on this (with strict anonymization and client consent) is a genuine defensible asset. No one else has it.
3. **Sector and stage classifiers** — trained on your document corpus, these will outperform generic models on VC-specific signals (what "seed-stage SaaS with $200k ARR" actually implies vs. how a general model interprets it).

Implementation path:

- Fine-tuning: LoRA/QLoRA via Hugging Face PEFT, base model Mistral 7B or LLaMA 3 8B
- Training infra: Modal or AWS SageMaker for training jobs (triggered when a client has enough new labeled data)
- Serving: vLLM for efficient inference, deployed per tier on Modal (cold-start acceptable for fine-tuned models used less frequently)

# LLM Strategy at Scale

You now need a **model routing layer**, not a single model choice:

**Tier 1 — Frontier model (Claude / GPT-4o):** complex reasoning tasks, full memo generation, nuanced Q&A. High cost, high quality. Reserve for high-value interactions.

**Tier 2 — Mid-size hosted model (Claude Haiku, GPT-4o mini):** classification, summarization, structured extraction, quick screening passes. 10x cheaper, acceptable quality for routine tasks.

**Tier 3 — Your fine-tuned models:** memo generation mimicking client firm voice, deal scoring. Self-hosted on Modal or RunPod (GPU on-demand, not reserved — cheaper at variable load). These become your moat.

Route intelligently: a first-pass screening doesn't need Tier 1. A final investment memo does.

# Compliance and Data Governance — Non-Negotiable at This Stage

VC clients handle material non-public information. This isn't optional:

- **Encryption at rest and in transit** everywhere, tenant-specific KMS keys (AWS/OVH KMS)
- **Audit logs** on every document access and every LLM call — who queried what, when, with what output. Immutable, queryable.
- **Data residency controls** — EU clients will need EU-region deployments (GDPR). Some US institutional clients will require US-only.
- **SOC 2 Type II** as a near-term goal — this is a buying criterion for institutional VC clients, not a nice-to-have
- **Model inference logging controls** — clients will ask whether their deal data trains your shared models. The answer must be clearly no (or clearly yes with explicit consent). Design the data pipeline to enforce this technically, not just contractually.

# Deployment and Infrastructure

**Cloud:** OVH Cloud as primary. Avoid over-committing to a single cloud early — abstract behind Terraform.

**Containerization:** Kubernetes (EKS) for the API and orchestration layer. Start with ECS, migrate path is clear.

**CI/CD:** GitHub Actions (ghcr.io runners) → staging → production, with per-tenant feature flags (LaunchDarkly or Statsig). You need to be able to roll out features to one client without touching others.

**Observability:** LLM-specific observability matters here — standard APM misses what you need. Use LangSmith or Langfuse for tracing LLM calls, prompt versions, latency, and output quality. Pair with Datadog or Grafana for infra metrics.

# What to Build vs. Buy

| Capability | Prod | MVP |
| --- | --- | --- |
| Document parsing | Buy (LlamaParse) | Build |
| Vector store | Buy (Pinecone or pgvector) | Build |
| Auth / SSO | Buy (Clerk or Auth0) | Build |
| LLM inference (frontier) | Buy (API) | Build |
| Fine-tuning pipeline | Build | Build |
| Deal scoring model | Build | Build |
| Memo generation voice | Build | Build |
| Observability | Buy (Langfuse + Datadog) | Build |
| Feature flags | Buy | Build |

[Tools](VC%20Pitchdeck%20Assistant/Tools%2038d8ddb80a6680bdb7f2ea27cdc29411.csv)