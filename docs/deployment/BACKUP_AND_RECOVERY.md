# DATABASE BACKUP & DISASTER RECOVERY PLAN

This document guides the automated backup schedule, retention policies, and disaster recovery procedures for VEIL.

## Disaster Recovery Objectives
*   **Recovery Point Objective (RPO)**: **24 hours** (maximum data loss window).
*   **Recovery Time Objective (RTO)**: **2 hours** (maximum downtime window to restore service).

---

## Backup Schedules

### 1. Database Backups
Since the database runs on Supabase (PostgreSQL), backups are managed automatically:
*   **Schedule**: Automated daily physical backups.
*   **Point-in-Time Recovery (PITR)**: Enable PITR (recommends 7-day retention) in Supabase/AWS RDS to restore the database to any millisecond within the backup window.
*   **Off-site Backups**:CI/CD scripts should export a daily database schema and encrypt it using AWS KMS, storing it in an isolated Amazon S3 bucket with Glacier lifecycle rules.

### 2. Media Storage Backups (Supabase Buckets)
User-uploaded media (avatars, images, optimized videos) are stored in the `veil-media` bucket:
*   **S3 Replication**: If migrating to S3, enable Cross-Region Replication (CRR) to sync upload objects to a secondary region.
*   **Versioning**: Enable S3 Bucket Versioning to protect against accidental deletes or malicious overwrites.

### 3. Application Secrets & Configs
*   AWS Secrets Manager values are backed up automatically across multiple Availability Zones.
*   The raw secrets can be exported as encrypted JSON files using the AWS CLI and stored in a secure offline vault.

---

## Recovery & Rollback Procedures

### Compute Rollback (ECS)
If a faulty deployment bypasses local tests and is pushed to ECS:
1.  **Immediate Fix**: Roll back the task definition to the last active stable image revision.
    ```bash
    aws ecs update-service --cluster veil-cluster --service veil-service --task-definition veil-task:revision_number --force-new-deployment
    ```
2.  **Container Scaling**: ECS Fargate will spin down the faulty containers and boot up stable instances under the ALB target group.

### Database Restorations
In the event of database corruption:
1.  Temporarily change the ALB route rules to display a "Maintenance Mode" page to prevent writes.
2.  Initiate PITR restoration via the Supabase Dashboard or AWS RDS console to a timestamp prior to the corruption.
3.  Deploy migrations via `npx prisma db push` if schema updates were part of the rollback.
4.  Re-enable normal traffic.
