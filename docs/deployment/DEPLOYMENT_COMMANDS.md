# PRODUCTION DEPLOYMENT & OPERATION COMMAND SHEET

This reference sheet lists the exact commands needed to operate, monitor, deploy, and roll back VEIL's containerized infrastructure on AWS.

## 1. Local Compilation & Container Build

### Build the Docker Container
```bash
docker build -t veil-backend:latest ./backend
```

### Run and Test the Container locally
```bash
docker run -d -p 3000:3000 --env-file ./backend/.env veil-backend:latest
```

---

## 2. ECR Registry Management

### Authenticate local Docker Client with AWS ECR
```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.ap-northeast-1.amazonaws.com
```

### Tag and Push Backend image to ECR
```bash
docker tag veil-backend:latest <aws_account_id>.dkr.ecr.ap-northeast-1.amazonaws.com/veil-backend:latest
docker push <aws_account_id>.dkr.ecr.ap-northeast-1.amazonaws.com/veil-backend:latest
```

---

## 3. ECS Fargate Container Deployment & Operations

### Force Deploy Container Update to ECS Service
```bash
aws ecs update-service --cluster veil-cluster --service veil-service --force-new-deployment --region ap-northeast-1
```

### Get Current Status of ECS Tasks
```bash
aws ecs list-tasks --cluster veil-cluster --service-name veil-service --region ap-northeast-1
```

### Describe Specific Task details
```bash
aws ecs describe-tasks --cluster veil-cluster --tasks <task_arn> --region ap-northeast-1
```

---

## 4. Rollbacks & Emergency Procedures

### Revert Service to a Specific Stable Task Definition Revision
```bash
aws ecs update-service --cluster veil-cluster --service veil-service --task-definition veil-task:45 --region ap-northeast-1
```

### Stop a Malfunctioning Task (ECS will automatically replace it)
```bash
aws ecs stop-task --cluster veil-cluster --task <task_arn> --region ap-northeast-1
```

---

## 5. Telemetry & Log Tailing

### Tail Fargate Server Logs using CloudWatch logs
```bash
aws logs tail /ecs/veil-backend --follow --format short --region ap-northeast-1
```

### Filter Server Errors in Logs
```bash
aws logs tail /ecs/veil-backend --filter-pattern "ERROR" --region ap-northeast-1
```

---

## 6. Frontend Static Assets Handoff

### Build the Frontend Static Assets
```bash
npm run build --prefix frontend
```

### Upload Static Assets to S3 Bucket
```bash
aws s3 sync frontend/dist/ s3://veil-frontend-bucket/ --delete --region ap-northeast-1
```

### Invalidate CloudFront Distribution Cache
```bash
aws cloudfront create-invalidation --distribution-id <distribution_id> --paths "/*" --region ap-northeast-1
```
