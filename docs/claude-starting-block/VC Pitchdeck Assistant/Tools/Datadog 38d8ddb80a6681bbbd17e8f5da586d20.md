# Datadog

Alternatives Names: DD; Datadog APM; Datadog Monitoring
Resource Link: https://docs.datadoghq.com
Category: Infrastructure Observability
Programming Language: Python / Go / Ruby / Java / TypeScript (agents)
Description: Full-stack monitoring SaaS: infrastructure metrics, APM distributed tracing, log management, and alerting in a single platform. Industry standard for production B2B SaaS. Expensive but comprehensive with strong compliance reporting capabilities.
Role in VC Assistant Infrastructure: Monitors all infrastructure: EKS node health, RDS performance, Redis queue depth, S3 costs per tenant, and API error rates. Provides the audit log trail and uptime evidence required for SOC 2 Type II. Alerts on SLA breaches. Cost allocation dashboards per tenant.
Potential Alternatives (with main comparison): Grafana + Prometheus: open-source stack at a fraction of the cost — recommended if budget is constrained. New Relic: competitive all-in-one alternative, often cheaper. Dynatrace: stronger AI-powered anomaly detection but more expensive. AWS CloudWatch: native and cheap but poor UX and limited cross-service correlation. Elastic (ELK): strong log search but requires significant ops effort to maintain.
Deployment Notes & File Structure: Recommended structure:
infra/
  datadog/
    helm-values.yaml      # Datadog agent Helm config
    monitors/
      api_latency.tf      # Terraform-managed DD monitors
      error_rate.tf
    dashboards/
      tenant_overview.json
      llm_costs.json
app/
  observability/
    dd_metrics.py         # custom metric helpers
Short File/Config Template: # helm-values.yaml (Datadog agent)
datadog:
  apiKey: DD_API_KEY
  clusterName: vc-assistant-prod
  logs:
    enabled: true
    containerCollectAll: true
  apm:
    enabled: true
Stack & Framework Integration: Datadog Agent deployed as a DaemonSet on EKS via Helm chart. Auto-discovers pods and services. APM traces from FastAPI via ddtrace auto-instrumentation. Logs aggregated from all containers. Custom metrics via statsd or dogstatsd client. Tags align with tenant_id for per-tenant dashboards and cost allocation.

# Stack & Framework Integration

Datadog Agent deployed as a DaemonSet on EKS via Helm chart. Auto-discovers pods and services. APM traces from FastAPI via ddtrace auto-instrumentation. Logs aggregated from all containers. Custom metrics via statsd or dogstatsd client. Tags align with tenant_id for per-tenant dashboards and cost allocation.

# Alternative Tools

Grafana + Prometheus: open-source stack at a fraction of the cost — recommended if budget is constrained. New Relic: competitive all-in-one alternative, often cheaper. Dynatrace: stronger AI-powered anomaly detection but more expensive. AWS CloudWatch: native and cheap but poor UX and limited cross-service correlation. Elastic (ELK): strong log search but requires significant ops effort to maintain.

# Config Template

```jsx
Recommended structure:
infra/
  datadog/
    helm-values.yaml      # Datadog agent Helm config
    monitors/
      api_latency.tf      # Terraform-managed DD monitors
      error_rate.tf
    dashboards/
      tenant_overview.json
      llm_costs.json
app/
  observability/
    dd_metrics.py         # custom metric helpers
```

# Code Example

```jsx
# helm-values.yaml (Datadog agent)
datadog:
  apiKey: DD_API_KEY
  clusterName: vc-assistant-prod
  logs:
    enabled: true
    containerCollectAll: true
  apm:
    enabled: true
```