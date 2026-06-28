# Statsig

Alternatives Names: Statsig Feature Gates; Statsig Experiments
Resource Link: https://docs.statsig.com
Category: Feature Flag / Experimentation Platform
Programming Language: Python / TypeScript / Go (multi-language SDK)
Description: Modern feature flag and product experimentation platform. Combines feature gates, A/B experiments, and product analytics in one tool. More affordable than LaunchDarkly at startup scale with a generous free tier and strong built-in metrics.
Role in VC Assistant Infrastructure: Same role as LaunchDarkly but preferred at early startup stage: per-tenant feature gates for model rollouts, A/B experiments on screening output quality, and product metric tracking. Built-in experiment analysis removes need for a separate analytics tool early on.
Potential Alternatives (with main comparison): LaunchDarkly: more mature enterprise features, better compliance documentation for large clients — migrate when enterprise sales requires it. Unleash: self-hosted option for data-sensitive environments. GrowthBook: stronger statistical experimentation framework but weaker feature flag UX. Split.io: similar positioning to Statsig, slightly more expensive. Optimizely: enterprise experimentation but overkill for infra-level flag use cases.
Deployment Notes & File Structure: Statsig is SaaS — no deployment. Recommended code structure:
app/
  feature_flags/
    statsig_client.py     # singleton init
    gates.py              # gate name constants
    experiments.py        # experiment config helpers
    middleware.py         # FastAPI middleware for user context injection
  config/
    statsig.yaml          # server secret per environment
Short File/Config Template: # statsig_client.py
import statsig
from statsig import StatsigUser
statsig.initialize("server-secret-key")
user = StatsigUser(user_id=tenant_id, custom={"plan": "enterprise"})
if statsig.check_gate(user, "new_scoring_model"):
    score = score_v2(deck)
Stack & Framework Integration: SDKs for Python backend and TypeScript frontend. Server-side evaluation recommended for LLM feature gates (never expose model routing logic to client). Integrates with Datadog for metric import. Experiment results viewable in Statsig console without additional BI tooling.

# Stack & Framework Integration

SDKs for Python backend and TypeScript frontend. Server-side evaluation recommended for LLM feature gates (never expose model routing logic to client). Integrates with Datadog for metric import. Experiment results viewable in Statsig console without additional BI tooling.

# Alternative Tools

LaunchDarkly: more mature enterprise features, better compliance documentation for large clients — migrate when enterprise sales requires it. Unleash: self-hosted option for data-sensitive environments. GrowthBook: stronger statistical experimentation framework but weaker feature flag UX. [Split.io](http://split.io/): similar positioning to Statsig, slightly more expensive. Optimizely: enterprise experimentation but overkill for infra-level flag use cases.

# Config Template

```jsx
Statsig is SaaS — no deployment. Recommended code structure:
app/
  feature_flags/
    statsig_client.py     # singleton init
    gates.py              # gate name constants
    experiments.py        # experiment config helpers
    middleware.py         # FastAPI middleware for user context injection
  config/
    statsig.yaml          # server secret per environment
```

# Code Example

```jsx
# statsig_client.py
import statsig
from statsig import StatsigUser
statsig.initialize("server-secret-key")
user = StatsigUser(user_id=tenant_id, custom={"plan": "enterprise"})
if statsig.check_gate(user, "new_scoring_model"):
    score = score_v2(deck)
```