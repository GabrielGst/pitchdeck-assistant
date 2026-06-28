# Sans titre

# Stack & Framework Integration

Deployed on EKS via Helm (kube-prometheus-stack chart installs Prometheus + Grafana + Alertmanager together). Prometheus scrapes metrics from all pods via annotations. Loki deployed separately for log ingestion. Tempo for distributed traces. All three connect as data sources in Grafana. Dashboards version-controlled as JSON in the repo.

# Alternative Tools

Datadog: all-in-one with better UX and compliance reporting but 10x the cost — upgrade when SOC 2 enterprise clients require it. New Relic: SaaS alternative with free tier. Grafana Cloud: managed version of the open-source stack — removes infra management overhead while keeping the UI. AWS Managed Grafana: native AWS integration, reduces self-hosting burden but AWS lock-in.

# Config Template

```jsx
**Recommended structure:
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
      error_budget.yaml**
```

# Code Example

```jsx
# helm-values.yaml (kube-prometheus-stack)
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
```