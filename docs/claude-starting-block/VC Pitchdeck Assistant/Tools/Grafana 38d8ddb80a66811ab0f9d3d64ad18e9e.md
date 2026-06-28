# Grafana

Alternatives Names: Grafana OSS; Grafana Cloud; Grafana + Prometheus Stack
Resource Link: https://grafana.com/docs
Category: Metrics Visualization
Programming Language: Go (server) / TypeScript (UI) / PromQL (queries)
Description: Open-source dashboarding and visualization platform. Connects to Prometheus, CloudWatch, Loki, Tempo, and 50+ data sources. Core component of the open-source observability stack (Prometheus metrics + Loki logs + Tempo traces + Grafana UI).
Role in VC Assistant Infrastructure: Cost-effective Datadog alternative for infrastructure dashboards and alerting. Paired with Prometheus for EKS metrics and Loki for log aggregation. Builds per-tenant usage dashboards (decks processed, LLM calls, cost per tenant) and operational health views for the engineering team.
Potential Alternatives (with main comparison): Datadog: all-in-one with better UX and compliance reporting but 10x the cost — upgrade when SOC 2 enterprise clients require it. New Relic: SaaS alternative with free tier. Grafana Cloud: managed version of the open-source stack — removes infra management overhead while keeping the UI. AWS Managed Grafana: native AWS integration, reduces self-hosting burden but AWS lock-in.
Deployment Notes & File Structure: Recommended structure:
infra/
  monitoring/
    helm-values.yaml      # kube-prometheus-stack config
    loki-values.yaml      # Loki log aggregation config
    dashboards/
      tenant_usage.json   # per-tenant metrics dashboard
      llm_pipeline.json   # document pipeline health
      infra_overview.json # cluster-wide health
    alerts/
      api_latency.yaml    # PrometheusRule alerts
      error_budget.yaml
Short File/Config Template: # helm-values.yaml (kube-prometheus-stack)
grafana:
  adminPassword: admin
  persistence:
    enabled: true
prometheus:
  prometheusSpec:
    retention: 30d
alertmanager:
  config:
    receivers:
    - name: pagerduty
      pagerduty_configs:
      - routing_key: PD_KEY
Stack & Framework Integration: Deployed on EKS via Helm (kube-prometheus-stack chart installs Prometheus + Grafana + Alertmanager together). Prometheus scrapes metrics from all pods via annotations. Loki deployed separately for log ingestion. Tempo for distributed traces. All three connect as data sources in Grafana. Dashboards version-controlled as JSON in the repo.

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