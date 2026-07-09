# AWS PRODUCTION DEPLOYMENT CHECKLIST

This document lists the step-by-step actions required to deploy VEIL to AWS.

## 1. Account Prerequisites & IAM Setup
*   [ ] Create or verify access to an AWS production account.
*   [ ] Establish IAM roles following the Principle of Least Privilege:
    *   **ECS Task Execution Role**: Needs permissions to read secrets from AWS Secrets Manager and configuration strings from Systems Manager Parameter Store.
    *   **CI/CD Deployment Role**: Needs permissions to push Docker images to AWS ECR, update ECS task definitions, and upload static files to S3.
*   [ ] Configure AWS Budgets to alert on unexpected monthly costs.

## 2. Networking Topology (VPC)
*   [ ] Create a VPC with CIDR `10.0.0.0/16`.
*   [ ] Configure Subnets:
    *   **Public Subnets**: Two subnets in different Availability Zones (AZs) with Internet Gateways.
    *   **Private Subnets**: Two subnets in different AZs with NAT Gateways for private compute.
*   [ ] Set up Security Groups:
    *   **ALB Security Group**: Allows ingress on ports 80 and 443 from anywhere (`0.0.0.0/0`).
    *   **ECS Security Group**: Allows ingress on port 3000 strictly from the ALB Security Group.

## 3. DNS, SSL & Certificates
*   [ ] Register/migrate target domain (e.g. `veil.social`) in Route 53.
*   [ ] Request an SSL/TLS wildcard certificate in AWS Certificate Manager (ACM) for `veil.social` and `*.veil.social`.
*   [ ] Perform DNS validation to verify ACM ownership.

## 4. Parameter & Secrets Provisioning
*   [ ] Store secret variables in AWS Secrets Manager:
    *   `DATABASE_URL`, `DIRECT_URL`
    *   `JWT_SECRET`, `ENCRYPTION_KEY`, `RECOVERY_CODE_SECRET`
    *   `AI_API_KEY`, `GROK_API_KEY`
    *   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
*   [ ] Store non-secret parameters in Systems Manager Parameter Store:
    *   `NODE_ENV=production`, `PORT=3000`
    *   `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`
    *   `FRONTEND_ORIGIN`, `TOTP_ISSUER`

## 5. Storage (S3 & Supabase)
*   [ ] Create an Amazon S3 bucket for the static frontend assets. Enable static web hosting.
*   [ ] Provision a Supabase PostgreSQL instance and configure connection pooler URLs.
*   [ ] Create a Supabase storage bucket `veil-media` with standard access permissions.

## 6. GitHub Actions CI/CD Integration
*   [ ] Add AWS credentials to GitHub repository Secrets.
*   [ ] Configure the GitHub Actions workflow file to build, compile, push backend images to ECR, and upload frontend static files to S3.

## 7. Compute & Load Balancer Deployment
*   [ ] Provision Amazon ECR (Elastic Container Registry) repository.
*   [ ] Set up an Application Load Balancer (ALB) pointing to ECS target groups on port 3000.
*   [ ] Register Route 53 Alias records mapping DNS endpoints to the CloudFront distribution and the ALB.
*   [ ] Configure ECS Task Definition and launch Fargate service with minimum 1 task (recommend 2 for HA).

## 8. Health Verification & Monitoring
*   [ ] Verify the ALB target group health checks point to path `/healthz` on port 3000.
*   [ ] Configure CloudWatch alarms for ECS task failures, high database CPU usage, and memory bounds.
