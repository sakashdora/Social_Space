# CI/CD DEPLOYMENT PIPELINE GUIDE

This document guides the automated integration and deployment workflow for VEIL using GitHub Actions and AWS.

## Pipeline Architecture Diagram

```
[Developer Push]
       │
       ▼
 ┌───────────┐
 │   Build   ├─► Linting & Formatting Checks
 └─────┬─────┘
       ▼
 ┌───────────┐
 │   Test    ├─► Jest Integration Suite (node --experimental-vm-modules)
 └─────┬─────┘
       ▼
 ┌───────────┐
 │  Release  ├─► Docker Image Compile & Push to Amazon ECR
 └─────┬─────┘
       ▼
 ┌───────────┐
 │  Deploy   ├──► ECS Fargate Service (Rolling Deploy)
 └───────────┘  └──► S3 Bucket + CloudFront Invalidation (Frontend)
```

---

## Workflow Configurations

### 1. Triggers
*   **Continuous Integration (CI)**: Runs on any pull request targeting `main`. Runs linter, formatter, typecheck, and Jest integration tests.
*   **Continuous Deployment (CD)**: Runs on push/merge to `main`. Builds assets, updates ECR images, invalidates CloudFront cache, and deploys containers.

### 2. Integration Stage (GitHub Actions)
Runs linting, typescript checking, and testing to prevent broken code from merging:
```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci --prefix backend && npm ci --prefix frontend
      - run: npm run lint --prefix frontend
      - run: npm run typecheck --prefix frontend
      - run: npm test --prefix backend
```

### 3. Build & Deployment Stage
Pushes assets directly to production targets:
*   **Frontend**: 
    1. Compiles production assets (`npm run build`).
    2. Uploads the output files to S3 (`aws s3 sync dist/ s3://veil-frontend-bucket`).
    3. Invalidates the CloudFront cache (`aws cloudfront create-invalidation`).
*   **Backend**:
    1. Builds the Docker container: `docker build -t veil-backend .`
    2. Logs into Amazon ECR and pushes the image: `docker push <account>.dkr.ecr.<region>.amazonaws.com/veil-backend:latest`
    3. Registers a new task definition and updates ECS: `aws ecs update-service --cluster veil-cluster --service veil-service --force-new-deployment`

### 4. Zero-Downtime Deployment
ECS uses a **Rolling Update** deployment strategy:
*   **Minimum Healthy Percent**: `100%` (e.g. if we run 2 tasks, 2 new tasks spin up before old tasks are terminated).
*   **Maximum Percent**: `200%` (allows temporary scaling to double capacity during deployment).

### 5. Automated Rollback Process
*   If new containers fail ALB health checks (`/healthz` responding with anything other than 200 OK within the validation threshold), ECS automatically halts deployment, keeps the old tasks active, and rolls back the task definition.
