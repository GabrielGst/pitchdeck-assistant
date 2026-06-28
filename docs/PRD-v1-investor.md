# PRD: VC Pitchdeck Assistant — Investor Product (v1)

## Problem Statement

VC analysts and partners receive 50–100 pitch decks per week. Screening each deck manually — reading it, assessing the team, market, traction, and financials, identifying risks, and drafting due diligence questions — consumes hours of analyst time per deal. Most decks are passed on within minutes, but the ones that deserve attention often get the same shallow treatment as the ones that don't. There is no structured, repeatable process: every analyst evaluates differently, institutional knowledge about what makes a deal fundable stays in people's heads, and the outcome of each deal (funded, passed) is never systematically connected back to the signals that were present in the original deck.

The result: slower screening, inconsistent quality, and a missed opportunity to build a proprietary signal dataset that compounds in value over time.

## Solution

A multi-tenant web platform where VC firms upload pitch decks and receive, within 60–90 seconds, a structured AI-generated analysis: a scorecard across universal investment dimensions, a prioritized list of due diligence questions and risk flags, and a narrative investment memo. The analysis is grounded in the firm's own investment thesis documents and, over time, in their historical deal flow.

Analysts edit and annotate the output inline. Deals are managed through a shared Kanban pipeline where stage transitions and outcomes are tracked. Every edit, annotation, and outcome label is silently stored as a training signal — building the proprietary dataset that will power per-firm fine-tuned models and a cross-deal scoring model in future versions.

The platform is multi-tenant from day one: each VC firm's data, vector embeddings, and configurations are fully isolated.

## User Stories

### Onboarding & Authentication

1. As an Admin, I want to log in via SSO/SAML using my firm's identity provider, so that I don't need to manage separate credentials.
2. As an Admin, I want to log in via email and password as a fallback, so that I can access the platform if SSO is unavailable.
3. As an Admin, I want to invite team members by email and assign them a role (Analyst, Associate, Partner), so that I can control who has access to the firm's deal data.
4. As an Admin, I want to upload my firm's investment thesis and focus documents, so that all subsequent deck analyses are grounded in our specific criteria.
5. As an Admin, I want to define custom scorecard dimensions on top of the universal base dimensions, so that the scoring reflects our firm's evaluation framework.
6. As an Admin, I want to customize the deal pipeline stage names, so that the Kanban board matches our internal terminology.

### Deck Ingestion

7. As an Analyst, I want to upload a pitch deck as a PDF or PPTX file via the web interface, so that I can trigger an AI analysis without leaving the platform.
8. As an Analyst, I want to see the deck appear immediately in the Inbox column of the pipeline Kanban, so that I know the upload was successful.
9. As an Analyst, I want to see a live progress indicator while the deck is being processed, so that I know what stage the analysis is at (extracting, retrieving context, generating).
10. As an Analyst, I want the scorecard and due diligence questions to appear first while the memo streams in after, so that I can start reading useful output while the longer content is still generating.

### Analysis Output

11. As an Analyst, I want to see a scorecard with ratings across universal dimensions (Team, Market Size, Traction, Business Model, Competition, Financials, Overall), so that I can quickly assess deal quality at a glance.
12. As an Analyst, I want to see my firm's custom scorecard dimensions alongside the universal ones, so that the analysis reflects our specific investment thesis.
13. As an Analyst, I want to see a prioritized list of due diligence questions and risk flags extracted from the deck, so that I know exactly what to investigate in a first call with the founder.
14. As an Analyst, I want to read a narrative investment memo generated from the deck content, so that I have a draft document to share with partners or refine into a final memo.
15. As an Analyst, I want the analysis to reference relevant context from our past deals and thesis documents, so that the output is calibrated to our firm's perspective rather than generic VC advice.
16. As an Analyst, I want to see which parts of the analysis were grounded in our thesis documents versus the deck itself, so that I can assess the quality of the retrieval.

### Inline Editing & Annotation

17. As an Analyst, I want to highlight any text in the generated memo and add a comment, so that I can flag inaccuracies or add context without leaving the analysis view.
18. As an Analyst, I want to directly edit the text of the generated memo inline, so that I can correct, expand, or rewrite sections as part of my normal workflow.
19. As an Analyst, I want to adjust the scorecard ratings manually, so that I can correct scores I disagree with and provide ground-truth labels for future model training.
20. As an Analyst, I want to edit or add due diligence questions from the generated list, so that I can tailor the DD checklist to the specifics of this deal.
21. As an Analyst, I want my edits to be saved automatically, so that I never lose work if I navigate away.
22. As a Partner, I want to see the edit history on a memo, so that I understand what the AI generated versus what my team changed.

### Passive Engagement Tracking

23. As a platform operator, I want to track which sections of the analysis an investor reads, expands, or copies, so that I can infer which outputs are most valuable without requiring explicit feedback.
24. As a platform operator, I want to know when an investor copies the generated memo to their clipboard, so that I can infer the memo was useful enough to export.
25. As a platform operator, I want to track time spent on each analysis section, so that I can build engagement signal into future model evaluation.

### Deal Pipeline (Kanban)

26. As an Analyst, I want to see all deals as cards in a shared Kanban board with six columns: Inbox, Screening, Due Diligence, Partner Review, Invested, and Passed, so that I have a single view of the firm's entire deal pipeline.
27. As an Analyst, I want to move a deal card between Inbox, Screening, and Due Diligence columns by dragging it, so that I can update pipeline status as my review progresses.
28. As an Associate, I want to move deal cards into Partner Review, so that I can flag deals ready for senior evaluation.
29. As a Partner, I want to be the only role that can move a deal to the Invested or Passed terminal states, so that final investment decisions are controlled and auditable.
30. As an Admin, I want to rename pipeline stages or add custom stages, so that the Kanban board matches our firm's exact process.
31. As any team member, I want to see the timestamp of every stage transition on a deal card, so that I can understand how long a deal has been at each stage.
32. As any team member, I want to filter the Kanban board by analyst, sector, stage, or date, so that I can find specific deals quickly.
33. As any team member, I want to click a deal card to open the full analysis view, so that I can review the scorecard, memo, and DD questions without losing pipeline context.
34. As any team member, I want to search across all deals by company name or keyword, so that I can find a specific deck I reviewed previously.

### Deal Outcome Labeling

35. As a Partner, I want to mark a deal as Invested or Passed with a single action from the deal card or analysis view, so that outcomes are captured without extra steps.
36. As a Partner, I want to optionally add a short note when passing on a deal, so that the reason for passing is recorded for future reference and training data.
37. As an Admin, I want to see a summary of deal outcomes over time (pass rate, conversion rate by stage), so that I can evaluate our screening process.

### Firm & Tenant Administration

38. As an Admin, I want to manage user roles and remove team members, so that I can maintain access control as my team changes.
39. As an Admin, I want to see per-analyst activity metrics (decks reviewed, edits made, deals moved), so that I can understand team usage patterns.
40. As an Admin, I want my firm's data to be fully isolated from other firms on the platform, so that our deal flow and analysis history cannot be accessed by any other tenant.

---

## Implementation Decisions

### Architecture Overview

The system follows a two-tier async architecture:

- **Tier 1 (processing):** Celery workers handle document extraction, chunking, embedding, and vector retrieval. These are slow, CPU/IO-bound tasks that run in the background after upload.
- **Tier 2 (streaming):** A FastAPI SSE endpoint takes over once retrieval is complete, streaming LLM output tokens directly to the browser. Redis pub/sub connects the two tiers.

This separation ensures async resilience for the slow pipeline while delivering the live streaming UX for the visible generation phase.

### Multi-Tenancy Model

Every data entity is scoped to a `tenant_id` from day one. Each tenant has:
- An isolated set of rows in every PostgreSQL table (tenant_id as a first-class column on all models)
- A dedicated pgvector namespace (collection per tenant) for deal embeddings
- A dedicated pgvector namespace for thesis/corpus B documents
- Role-based access control resolved at the API middleware layer before any data access

Tenant provisioning in v1 is manual (admin script). The schema is designed to support automated provisioning later without migration.

### Roles & Permissions

Four roles per tenant: **Analyst**, **Associate**, **Partner**, **Admin**.

Permission gates enforced server-side:
- Analyst: upload decks, view and edit analysis, move cards within Inbox/Screening/Due Diligence
- Associate: above + move cards to Partner Review, assign deals
- Partner: above + move cards to terminal states (Invested/Passed), approve deal outcomes
- Admin: above + user management, tenant configuration, thesis document management, stage customization

Terminal state transitions (Invested/Passed) are enforced as hard server-side checks, not just UI gates, to protect training label integrity.

### Authentication

Clerk handles auth. SSO/SAML is the primary integration for enterprise tenants. Email/password is the secondary fallback. Tenant context is resolved from the authenticated user's `tenant_id` claim on every request.

### Document Ingestion Pipeline

1. File uploaded via multipart POST to the API
2. File stored in tenant-scoped object storage (S3-compatible, OVH Object Storage)
3. Celery task dispatched: `process_deck.delay(deck_id, tenant_id)`
4. Worker extracts text: `pdfplumber` for PDF, `python-pptx` for PPTX
5. Text chunked by slide/section with metadata (page number, section type)
6. Chunks embedded via the configured embedding model and written to pgvector under the tenant's deal namespace
7. Worker publishes `EXTRACTION_COMPLETE` event to Redis channel keyed by `deck_id`
8. FastAPI SSE endpoint (subscribed to this channel) begins the LLM streaming phase

Supported formats: PDF and PPTX only in v1.

### RAG Strategy

Two corpora per tenant:

- **Corpus A (deal history):** Every processed deck is embedded and indexed. Retrieval returns semantically similar past deals as context for new analysis. Empty on day one; compounds in value as deals accumulate.
- **Corpus B (thesis documents):** The firm's investment thesis, focus areas, and evaluation criteria. Uploaded by Admin. Retrieved on every analysis to ground the output in firm-specific criteria.

Vector store: pgvector (PostgreSQL extension). One collection per tenant per corpus type. Similarity search only in v1; BM25 hybrid search added when corpus volume justifies it (design target: 500+ documents per tenant). No reranker at MVP.

Retrieval is performed in the Celery worker phase. Retrieved chunks are passed as context to the LLM streaming phase.

### LLM Stack

LiteLLM is the abstraction layer over all LLM providers. The active model is set via a single config value:

```python
# Prototype
LLM_MODEL = "mistral/mistral-small"

# Production (one-line swap)
LLM_MODEL = "anthropic/claude-sonnet-4-6"
```

No LangChain. LiteLLM is called directly from the `AnalysisService`. Prompts are versioned and managed in Langfuse.

**Generation order (streaming phase):**
1. Scorecard (structured JSON, streamed as a single block) — fast, appears first
2. Due diligence questions + risk flags (structured list) — appears second
3. Narrative investment memo (free-form prose, streamed token by token) — longest, appears last

All three outputs are generated in a single LLM call sequence within one SSE connection, keeping the API surface simple.

### Scorecard Schema

Universal base dimensions (present for all tenants):
- Team (1–5)
- Market Size (1–5)
- Traction (1–5)
- Business Model (1–5)
- Competition (1–5)
- Financials (1–5)
- Overall (1–5)

Each tenant can define additional custom dimensions stored in their tenant configuration. Custom dimensions are injected into the scoring prompt at generation time. All dimension ratings (universal and custom) are stored in the `analysis_scorecard` table with the `dimension_key` and `value`, making the schema forward-compatible with new dimensions without migration.

### Data Collection Pipeline

Every interaction that produces training signal is stored silently from day one:

- **Inline edits:** Every save to the memo or DD questions stores a diff: `(original_text, edited_text, user_id, timestamp, deck_id)`. This is the supervised fine-tuning pair corpus. No separate "submit feedback" action required — the edit itself is the signal.
- **Scorecard adjustments:** Manual score overrides stored as `(dimension_key, ai_score, human_score, user_id, deck_id)`.
- **Deal outcomes:** Terminal state transitions (Invested/Passed) stored with `(deck_id, outcome, partner_id, timestamp, optional_note)`. These are the ground-truth labels for the future scoring model.
- **Passive engagement:** Component-level interaction events (section viewed, time on section, memo copied) stored as `engagement_events`.

No fine-tuning pipeline runs in v1. The data is collected and stored; consumption is v2.

### Deal Pipeline State Machine

Stages: `INBOX → SCREENING → DUE_DILIGENCE → PARTNER_REVIEW → INVESTED | PASSED`

Terminal states: `INVESTED`, `PASSED`.

Every transition stored as a `pipeline_transition` record: `(deal_id, from_stage, to_stage, actor_id, timestamp)`. Dwell time per stage is derived from these records and becomes a feature in the future scoring model.

Per-tenant custom stages can be inserted between `PARTNER_REVIEW` and the terminal states. The universal stages are non-configurable.

### Observability

Langfuse is self-hosted (Docker Compose in dev, Kubernetes in prod) and integrated from day one. Every LLM call is wrapped with `@observe()`. Traces are tagged with `tenant_id`, `deck_id`, and prompt version. This enables:
- Per-tenant cost attribution
- Prompt version regression detection
- Quality debugging on poor analysis outputs

Standard infrastructure observability (CPU, memory, queue depth, API latency) via Prometheus + Grafana on the K8s cluster.

### Deployment

- **Dev:** Docker Compose on OVH VPS. Services: FastAPI, Next.js, PostgreSQL + pgvector, Redis, Celery worker, Langfuse.
- **Prod:** Existing Kubernetes cluster. Namespace isolation: `pitchdeck-dev`, `pitchdeck-staging`, `pitchdeck-prod`. Dedicated PostgreSQL and Redis instances per environment (not shared with other apps on the cluster).
- **EU data residency:** OVH infrastructure satisfies EU data residency requirements for GDPR compliance from day one.

### Frontend

Next.js app with:
- Clerk for auth (SSO/SAML + email/password)
- Kanban board with drag-and-drop (dnd-kit)
- Rich text inline editor for memo (Tiptap)
- SSE client for streaming analysis output
- Tailwind CSS + shadcn/ui component library

---

## Testing Decisions

### What makes a good test here

Tests should verify observable behavior through the system's external interfaces — what data comes back from an API call, what state changes in the database — not which internal functions were called. A test that knows about `AnalysisService._build_prompt()` is a liability; a test that asserts the analysis endpoint returns a scorecard with the expected dimensions is an asset.

### Testing seams

**Primary seam: HTTP API layer.** The majority of tests exercise FastAPI endpoints directly. External dependencies (LLM provider, object storage, vector store) are mocked at the service boundary — a `MockLLMProvider` that returns deterministic fixture outputs, a `MockStorageClient`, a `MockVectorStore`. Celery tasks are executed synchronously in tests via `task_always_eager=True`. This gives full workflow coverage (upload → extract → retrieve → generate → edit → transition stage) in a single fast test suite with no real I/O.

**Secondary seam: `DocumentParser.parse(file) → ExtractedDeck`.** The parser is a pure function with file I/O. It is tested directly with a set of fixture files covering: simple PDF, image-heavy PDF, PPTX with text in shapes, PPTX with tables, malformed/empty files. These tests run independently of the rest of the system.

**Tertiary seam: `AnalysisService.generate(deck_text, context) → AnalysisResult`.** The analysis service is tested with a mock LLM client that returns fixed responses. Tests assert that the output structure (scorecard keys, DD question format, memo presence) is correct regardless of LLM content, and that tenant custom dimensions are injected and returned correctly.

### What is not tested at the unit level

- Celery task internals (covered by the API seam with eager execution)
- pgvector query internals (covered by integration tests with a real PostgreSQL + pgvector instance in CI)
- SSE streaming frame format (covered by a single end-to-end smoke test)
- Langfuse trace emission (not tested; it is observability infrastructure, not application logic)

---

## Out of Scope

- **Founder persona:** deck creation and refinement workflow is v2. The data model includes a `user_type: founder` field and a `Deck` entity with a `created_by_founder` flag, but no founder-facing UI or workflow is built in v1.
- **Email and Slack ingestion:** web upload only in v1.
- **BM25 / hybrid retrieval:** pgvector only; BM25 (ParadeDB) is added when per-tenant corpus exceeds ~500 documents.
- **Reranker:** deferred; no cross-encoder model at MVP.
- **Fine-tuning pipeline execution:** data is collected; training jobs are v2.
- **XGBoost deal scoring model:** requires labeled outcome data to accumulate; v2+.
- **Self-serve tenant onboarding:** tenant provisioning is manual (admin script) in v1.
- **Cross-tenant anonymized corpus (Corpus C):** requires data governance agreements with multiple clients; v2+.
- **Market data corpus (Corpus D):** requires external data licensing; v3+.
- **Mobile application:** web only.
- **Billing and subscription management:** out of scope for v1.
- **Token-level streaming for scorecard:** scorecard is returned as a complete JSON block; only the memo streams token by token.

---

## Further Notes

- **Fine-tuning data pipeline design constraint:** the `analysis_edits` and `pipeline_transitions` tables must be designed with the fine-tuning consumer in mind from day one. Specifically: every edit must store the exact `original_text` at the time of generation (not derived from the current state), and every outcome label must be immutable once set by a Partner. Schema migrations that break these invariants should be flagged as requiring data pipeline review.
- **Mistral free tier rate limits:** at 50–100 decks/week per tenant, the Mistral free tier will likely hit rate limits with more than 2–3 pilot tenants active simultaneously. Monitor via Langfuse and switch to a paid tier or Claude before onboarding the third client.
- **pgvector cold corpus:** for the first ~50 deals in a tenant's history, Corpus A retrieval will return noisy results due to low corpus volume. The prompt should be designed to gracefully degrade when retrieved context is sparse rather than hallucinating relevance. Consider a minimum similarity threshold below which retrieved chunks are excluded from context.
- **SSO/SAML complexity:** Clerk handles SAML at the protocol level, but each enterprise tenant will require a SAML configuration step (metadata exchange with their IdP). Build a documented onboarding runbook for this step; it cannot be fully automated without a self-serve portal.
- **EU data residency audit trail:** maintain a record of where each tenant's data is stored (OVH region) for GDPR Article 30 compliance. This is an Admin-visible setting, not just an infrastructure fact.
