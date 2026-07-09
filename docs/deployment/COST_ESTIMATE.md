# AWS MONTHLY COST ESTIMATION

This document maps the monthly AWS infrastructure billing estimates for running VEIL in a small, scalable production environment.

## Cost Assumptions
*   **Active Users**: ~5,000 monthly active users.
*   **Compute Instances**: 2 ECS Fargate tasks active for high availability (HA).
*   **Media uploads**: ~50 GB S3 storage, 150 GB data egress.
*   **Database**: PostgreSQL hosted on Supabase (using the standard **$25/month Pro Plan** which covers PITR backups, 8 GB DB size, and connection poolers).

---

## AWS Services Bill Breakdown

| AWS Service | Config Details | Estimated Monthly Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **AWS ECS on Fargate** | 2 Tasks: 0.5 vCPU + 1 GB RAM each | **$18.40** | Serves backend API compute in private subnets. |
| **Application Load Balancer**| 1 ALB, 0.5 LCU average traffic | **$22.26** | Load-balancing routes and SSL termination. |
| **Amazon S3** | Standard Storage: 50 GB | **$1.15** | Holds static frontend files. |
| **Amazon CloudFront** | Data Transfer: 150 GB egress | **$12.75** | Global edge caching for frontend and media. |
| **NAT Gateways** | 1 NAT Gateway, 730 hours + 10 GB data | **$33.30** | Connects private compute tasks to external APIs. |
| **Route 53 & ACM** | 1 Hosted Zone + Certificate renewals | **$0.50** | DNS hosting ($0.50), ACM SSL cert is free. |
| **AWS Secrets Manager** | 1 Secret, API requests | **$0.45** | Stores production database & encryption keys. |
| **CloudWatch Monitoring** | Standard logs ingestion, 3 alarms | **$7.50** | Metrics, alarms, and container error logs. |
| **Total Estimated AWS Bill**| | **$96.36 / month** | |

---

## Cost-Reduction Recommending Guidelines

### 1. Consolidate NAT Gateways
In a small startup environment, having a NAT Gateway in each AZ adds $32/month per gateway.
*   **Tactic**: Deploy **1 NAT Gateway** shared across both private subnets. This satisfies HA compute targets while halving networking costs.

### 2. S3 Glacier Transition Rules
*   **Tactic**: Configure S3 lifecycle options to transition system logs to S3 Glacier Deep Archive after 14 days, lowering storage fees by 90%.

### 3. Compute Scaling rules
*   **Tactic**: Enable Fargate auto-scaling to scale down compute to 1 task during low-traffic night hours (e.g. 2:00 AM - 6:00 AM), saving 15% on compute bills.
