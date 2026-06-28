# LaunchDarkly

Alternatives Names: LD; LaunchDarkly Feature Flags
Resource Link: https://docs.launchdarkly.com
Category: Feature Flag Platform
Programming Language: Python / TypeScript / Go (multi-language SDK)
Description: Enterprise feature flag and experimentation platform. Enables toggling features per user, tenant, or rollout percentage without code deployments. Supports A/B testing, kill switches, and gradual rollouts with real-time flag evaluation.
Role in VC Assistant Infrastructure: Controls which tenants receive new features: new memo generation model versions, updated screening UI, experimental scoring algorithms. Enables safe rollout of a new fine-tuned adapter to one VC client before broad release. Kill switch for LLM features during incidents.
Potential Alternatives (with main comparison): Statsig: cheaper at startup scale with stronger built-in product analytics — better first choice for early stage. Unleash: open-source self-hostable alternative, good for data-sensitive clients. Flagsmith: another open-source option with decent SaaS tier. GrowthBook: open-source, experiment-focused. ConfigCat: simpler and cheaper, fewer enterprise features. Split.io: similar to LaunchDarkly, slightly cheaper.
Deployment Notes & File Structure: LaunchDarkly is SaaS — no deployment. Recommended code structure:
app/
  feature_flags/
    ld_client.py          # singleton SDK init
    flag_keys.py          # constants for all flag names
    contexts.py           # tenant context builders
    decorators.py         # @feature_flag() decorator for routes
  config/
    launchdarkly.yaml     # SDK key per environment
Short File/Config Template: # ld_client.py
import ldclient
from ldclient.config import Config
ldclient.set_config(Config("sdk-key"))
ld = ldclient.get()
context = ldclient.Context.builder(tenant_id).kind("tenant").build()
use_v2 = ld.variation("use-v2-memo-model", context, False)
Stack & Framework Integration: SDKs available for Python (FastAPI backend), TypeScript (Next.js frontend), and Go. Evaluated server-side at request time using tenant context object. Flag state cached locally in SDK for low-latency evaluation. Integrates with Datadog and Statsig for metric correlation on flag changes.

# Stack & Framework Integration

SDKs available for Python (FastAPI backend), TypeScript (Next.js frontend), and Go. Evaluated server-side at request time using tenant context object. Flag state cached locally in SDK for low-latency evaluation. Integrates with Datadog and Statsig for metric correlation on flag changes.

# Alternative Tools

Statsig: cheaper at startup scale with stronger built-in product analytics — better first choice for early stage. Unleash: open-source self-hostable alternative, good for data-sensitive clients. Flagsmith: another open-source option with decent SaaS tier. GrowthBook: open-source, experiment-focused. ConfigCat: simpler and cheaper, fewer enterprise features. [Split.io](http://split.io/): similar to LaunchDarkly, slightly cheaper.

# Config Template

```jsx
LaunchDarkly is SaaS — no deployment. Recommended code structure:
app/
  feature_flags/
    ld_client.py          # singleton SDK init
    flag_keys.py          # constants for all flag names
    contexts.py           # tenant context builders
    decorators.py         # @feature_flag() decorator for routes
  config/
    launchdarkly.yaml     # SDK key per environment
```

# Code Example

```jsx
# ld_client.py
import ldclient
from ldclient.config import Config
ldclient.set_config(Config("sdk-key"))
ld = ldclient.get()
context = ldclient.Context.builder(tenant_id).kind("tenant").build()
use_v2 = ld.variation("use-v2-memo-model", context, False)
```