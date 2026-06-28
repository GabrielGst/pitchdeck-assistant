# Terraform

Alternatives Names: Terraform IaC; OpenTofu; tf
Resource Link: https://developer.hashicorp.com/terraform/docs
Category: Infrastructure as Code
Programming Language: HCL (HashiCorp Configuration Language)
Description: Declares cloud infrastructure in .tf config files. Enables reproducible, version-controlled infrastructure across AWS/GCP/Azure. Plan/apply workflow shows changes before applying. State file tracks real-world resource mapping.
Role in VC Assistant Infrastructure: Provisions all cloud infrastructure: EKS clusters, ECS services, RDS instances, per-tenant S3 buckets, KMS encryption keys, VPCs, IAM roles, and security groups. Ensures dev/staging/prod environments are identical and auditable — critical for SOC 2 evidence.
Potential Alternatives (with main comparison): Pulumi: same IaC concept but in real programming languages (Python/TypeScript) — better if your team prefers code over HCL. AWS CDK: AWS-native IaC in TypeScript/Python but locked to AWS. Ansible: configuration management, not IaC — different scope. AWS CloudFormation: native but verbose and AWS-only. OpenTofu: open-source Terraform fork, drop-in replacement if HashiCorp licensing is a concern.
Deployment Notes & File Structure: Recommended structure:
infra/
  terraform/
    environments/
      dev/main.tf
      staging/main.tf
      prod/main.tf
    modules/
      tenant/             # per-tenant S3 + KMS resources
        main.tf
        variables.tf
        outputs.tf
      eks_cluster/
      ecs_service/
    backend.tf            # S3 state backend config
    variables.tf
Short File/Config Template: # modules/tenant/main.tf
resource "aws_s3_bucket" "tenant_docs" {
  bucket = "vc-${var.tenant_id}-docs"
}
resource "aws_kms_key" "tenant_key" {
  description = "KMS for tenant ${var.tenant_id}"
}
Stack & Framework Integration: Runs in CI/CD (GitHub Actions) on PR merge to provision or update infrastructure. State stored in S3 + DynamoDB lock table. Modules shared across environments via Terraform registry or local modules. Integrates with AWS provider for EKS, ECS, RDS, S3, KMS, and IAM resources.

# Stack & Framework Integration

Runs in CI/CD (GitHub Actions) on PR merge to provision or update infrastructure. State stored in S3 + DynamoDB lock table. Modules shared across environments via Terraform registry or local modules. Integrates with AWS provider for EKS, ECS, RDS, S3, KMS, and IAM resources.

# Alternative Tools

Pulumi: same IaC concept but in real programming languages (Python/TypeScript) — better if your team prefers code over HCL. AWS CDK: AWS-native IaC in TypeScript/Python but locked to AWS. Ansible: configuration management, not IaC — different scope. AWS CloudFormation: native but verbose and AWS-only. OpenTofu: open-source Terraform fork, drop-in replacement if HashiCorp licensing is a concern.

# Config Template

```jsx
Recommended structure:
infra/
  terraform/
    environments/
      dev/main.tf
      staging/main.tf
      prod/main.tf
    modules/
      tenant/             # per-tenant S3 + KMS resources
        main.tf
        variables.tf
        outputs.tf
      eks_cluster/
      ecs_service/
    backend.tf            # S3 state backend config
    variables.tf
```

# Code Example

```jsx
# modules/tenant/main.tf
resource "aws_s3_bucket" "tenant_docs" {
  bucket = "vc-${var.tenant_id}-docs"
}
resource "aws_kms_key" "tenant_key" {
  description = "KMS for tenant ${var.tenant_id}"
}
```