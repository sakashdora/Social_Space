# AWS READINESS REPORT

## Findings
Deploying VEIL to Amazon Web Services (AWS) requires high availability, secure credentials, cluster process management, and proper environment variables. The readiness audit identified several infrastructure gaps:
1.  **Process Management**: The API lacked a multi-instance daemon process manager configuration (like PM2) to run Express in cluster mode across multiple AWS ECS/EC2 CPU cores.
2.  **Health Verification**: Load balancers (AWS ALB) require a specific HTTP status path (like `/healthz`) to verify database and instance health.
3.  **Supabase Connection Pooling**: High numbers of active node instances in AWS would quickly saturate PostgreSQL direct connection limits without connection poolers.

## Risk Level
*   Lack of PM2 configuration: **MEDIUM** (limits vertical scalability)
*   Lack of Health Verification: **HIGH** (blocks ALB auto-scaling and target registration)
*   Connection Limits: **HIGH** (causes database downtime under spikes)

## Affected Files
*   `backend/ecosystem.config.cjs` (PM2 configuration)
*   `backend/app.js` (Health probe route)
*   `backend/.env` (Database pooler urls)

## Code Changes

### PM2 Process Manager
Created `ecosystem.config.cjs` in the backend root to deploy in cluster mode using `max` instances, enabling multi-threading support and centralized error/output logging:
```javascript
module.exports = {
  apps: [
    {
      name: "veil-backend",
      script: "./app.js",
      instances: "max",
      exec_mode: "cluster",
      combine_logs: true,
      error_file: "./logs/err.log",
      out_file: "./logs/out.log"
    }
  ]
};
```

### Connection URL Optimizations
Swapped direct connection links for PgBouncer pooler endpoints in production environment setups to manage concurrent connection limits.

## Verification Result
*   PM2 configuration file is created and validates successfully against Node.js commonjs modules.
*   Integration tests successfully target `/healthz` and verify healthy API-to-database state.

## Remaining Issues
*   Production variables (`JWT_SECRET`, `ENCRYPTION_KEY`, `RECOVERY_CODE_SECRET`) must be supplied via AWS Secrets Manager instead of a local `.env` file.

## Recommendation
*   Deploy the backend using AWS ECS (Elastic Container Service) with AWS Fargate.
*   Configure the Application Load Balancer (ALB) health check path to `/healthz` with a healthy threshold of 2 and interval of 30 seconds.
*   Store production variables in AWS Parameter Store or AWS Secrets Manager.
