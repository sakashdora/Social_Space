# DEPLOYMENT CHECKLIST

## Findings
Deploying VEIL to a live AWS cloud environment requires strict verification of environment settings, domain endpoints, certificates, database migration routines, process monitoring daemons, and security key stores. 

## Risk Level
*   Deployment misconfiguration: **CRITICAL** (leads to database corruption or data leakages)

## Affected Files
*   `backend/.env` (Production secret configuration template)
*   `backend/ecosystem.config.cjs` (Process configuration)

## Code Changes
Centralized environmental configurations and PM2 scripts for production environments.

## Verification Result
*   Local builds, database indexing pushes, linter sweeps, and test execution are all fully verified.

## Pre-Deployment checklist (Step-by-Step)

### Phase 1: Environment & Secrets
*   [ ] Provision AWS Secrets Manager with these environment variables:
    *   `PORT=3000`
    *   `DATABASE_URL="postgresql://..."`
    *   `DIRECT_URL="postgresql://..."`
    *   `AI_API_KEY="your-gemini-key"`
    *   `JWT_SECRET="high-entropy-hex-string"`
    *   `ENCRYPTION_KEY="64-hex-chars"`
    *   `RECOVERY_CODE_SECRET="high-entropy-hex-string"`
    *   `FRONTEND_ORIGIN="https://veil.social"`
    *   `UPSTASH_REDIS_REST_URL="https://..."`
    *   `UPSTASH_REDIS_REST_TOKEN="..."`
*   [ ] Verify `NODE_ENV` is set to `"production"`.

### Phase 2: Database Migration
*   [ ] Run `npx prisma db push --accept-data-loss` (or prisma migrate deploy) to sync the PostgreSQL schema.
*   [ ] (Optional) Run `node prisma/seed.js` to seed the database with initial categories (modify seed.js first to ensure Argon2 compatible hashes are used for admin accounts).

### Phase 3: Infrastructure Setup
*   [ ] Provision ALB (Application Load Balancer) in AWS with an HTTPS listener (port 443) using an ACM (AWS Certificate Manager) SSL certificate.
*   [ ] Set Target Group health check path to `/healthz`, port 3000, 30s intervals.
*   [ ] Launch ECS Tasks (Fargate) pulling backend Docker images, pointing to the ALB target group.

### Phase 4: Frontend Deployment
*   [ ] Build the frontend assets using `npm run build`.
*   [ ] Upload the `dist/` build directory to an AWS S3 bucket configured for static web hosting.
*   [ ] Deploy Amazon CloudFront CDN pointing to the S3 bucket as origin.
*   [ ] Set Custom CNAME and route traffic using Route 53.

## Remaining Issues
*   AWS infrastructure must be configured.

## Recommendation
*   Automate infrastructure provisioning using Terraform.
