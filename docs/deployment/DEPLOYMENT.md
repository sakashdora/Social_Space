# Deployment Guide - Veil Shine

## 1. Introduction

This document provides a comprehensive guide for deploying the Veil Shine backend application. It covers both local development setup using Docker Compose and production deployment considerations, including CI/CD pipelines and environment variable management. The goal is to ensure a consistent, reproducible, and scalable deployment process across different environments.

## 2. Local Development Deployment (Docker Compose)

For local development, Veil Shine leverages Docker Compose to orchestrate the application services, including the Node.js backend, PostgreSQL database, and Redis cache. This setup ensures that developers can quickly get a consistent environment running without worrying about local dependency conflicts.

### 2.1. Prerequisites
*   Docker Desktop (or Docker Engine and Docker Compose) installed on your local machine.
*   Node.js (LTS recommended) and npm/yarn for running scripts outside Docker (e.g., Prisma migrations).

### 2.2. Setup Steps

1.  **Clone the Repository**:
    ```bash
    git clone <repository_url>
    cd veil-shine-backend
    ```

2.  **Environment Variables**: Create a `.env` file in the root of the `backend/` directory based on `.env.example`. Populate it with necessary local development credentials and configurations. Refer to the `.env.example` for required variables.

3.  **Build and Start Services**:
    Navigate to the `backend/` directory and run:
    ```bash
    docker-compose up --build -d
    ```
    This command will:
    *   Build the Docker images for the backend service.
    *   Start the PostgreSQL database container.
    *   Start the Redis cache container.
    *   Start the Node.js backend application container.
    *   The `-d` flag runs the containers in detached mode.

4.  **Database Migrations**: Once the database container is up, apply Prisma migrations. You might need to run these from your local machine if Prisma CLI is not installed in the Docker image for development.
    ```bash
    # Ensure Prisma CLI is installed globally or locally
    npm install -g prisma # if not already installed
    # Or if using local npm install: npx prisma migrate dev --name init
    npx prisma migrate dev --name init
    ```
    *Note: The `init` name is a placeholder; use a descriptive name for your migration.*

5.  **Seed Database (Optional)**: If you have seed data, run the seed script:
    ```bash
    npx prisma db seed
    ```

6.  **Accessing Services**:
    *   The backend API will typically be accessible at `http://localhost:3000` (or the port defined in your `docker-compose.yml`).
    *   PostgreSQL and Redis will be accessible from within the Docker network.

### 2.3. Useful Docker Compose Commands
*   **Stop services**: `docker-compose stop`
*   **Stop and remove containers, networks, and volumes**: `docker-compose down`
*   **View logs**: `docker-compose logs -f <service_name>` (e.g., `docker-compose logs -f backend`)
*   **Execute command in a service container**: `docker-compose exec <service_name> <command>` (e.g., `docker-compose exec backend bash`)

## 3. Production Deployment (Kubernetes Considerations)

For production environments, Veil Shine is designed to be deployed on a Kubernetes cluster for high availability, scalability, and automated management. This section outlines the key components and considerations for a Kubernetes deployment.

### 3.1. Prerequisites
*   A running Kubernetes cluster (e.g., GKE, EKS, AKS, or self-hosted).
*   `kubectl` configured to connect to your cluster.
*   Helm (recommended for package management).

### 3.2. Core Kubernetes Components

*   **Deployments**: For managing stateless backend services (Auth, Post, Comment, Reaction, Feed, AI, Moderation, Notification, Admin Services). Each service will have its own Deployment.
*   **StatefulSets**: For stateful services like PostgreSQL and Redis, if not using managed cloud services. However, it is highly recommended to use managed database and cache services (e.g., Supabase, Upstash) in production to offload operational overhead.
*   **Services**: To expose backend Deployments within the cluster and to external traffic (e.g., `ClusterIP` for internal, `LoadBalancer` or `NodePort` for external via Ingress).
*   **Ingress**: To manage external access to the API Gateway, providing features like SSL termination, load balancing, and URL routing.
*   **ConfigMaps**: For injecting non-sensitive configuration data (e.g., API URLs, feature flags) into pods.
*   **Secrets**: For securely injecting sensitive information (e.g., database credentials, API keys) into pods.
*   **Horizontal Pod Autoscaler (HPA)**: To automatically scale the number of pods for each service based on CPU utilization or custom metrics.
*   **Persistent Volumes (PV) / Persistent Volume Claims (PVC)**: For persistent storage, especially if running PostgreSQL or Redis within the cluster.

### 3.3. CI/CD Pipeline for Production

A typical CI/CD pipeline using GitHub Actions for Kubernetes deployment would involve:

1.  **Code Commit**: Developer pushes code to a Git repository (e.g., `main` branch).
2.  **Continuous Integration (CI)**:
    *   **Linting & Formatting**: Code quality checks.
    *   **Unit & Integration Tests**: Run automated tests.
    *   **Build Docker Image**: Build a Docker image for the backend service.
    *   **Tag & Push Image**: Tag the Docker image with a unique version (e.g., Git SHA or semantic version) and push it to a container registry (e.g., Docker Hub, Google Container Registry, AWS ECR).
3.  **Continuous Deployment (CD)**:
    *   **Update Kubernetes Manifests**: Update the image tag in the Kubernetes Deployment manifests (or Helm chart values).
    *   **Apply Manifests**: Use `kubectl apply -f` or `helm upgrade` to deploy the changes to the Kubernetes cluster.
    *   **Rollout Strategy**: Implement a safe rollout strategy (e.g., rolling update, blue/green, canary) to minimize downtime.
    *   **Post-Deployment Tests**: Run smoke tests or end-to-end tests against the deployed application.

### 3.4. Environment Variables Management

In production, environment variables are crucial for configuring the application without hardcoding sensitive information. They should be managed securely.

*   **Kubernetes Secrets**: For sensitive data like database passwords, API keys for external services (Groq, Together AI, Resend, Sentry), and JWT secrets. These should be encrypted at rest and accessed by pods as environment variables or mounted files.
*   **Kubernetes ConfigMaps**: For non-sensitive configuration values that might change between environments (e.g., `NODE_ENV`, service URLs, log levels).
*   **External Secret Management**: For highly sensitive or frequently rotated secrets, consider integrating with external secret management solutions like HashiCorp Vault, AWS Secrets Manager, or Google Secret Manager.

### 3.5. Monitoring and Logging

*   **Logging**: Centralized logging solution (e.g., ELK Stack, Grafana Loki) to aggregate logs from all services for easier debugging and auditing.
*   **Monitoring**: Prometheus for metrics collection and Grafana for dashboarding and alerting. Sentry for application error tracking.
*   **Tracing**: Distributed tracing (e.g., Jaeger, OpenTelemetry) to visualize request flows across microservices.

## 4. References

*   [Docker Compose Documentation](https://docs.docker.com/compose/)
*   [Kubernetes Documentation](https://kubernetes.io/docs/home/)
*   [Helm Documentation](https://helm.sh/docs/)
*   [GitHub Actions Documentation](https://docs.github.com/en/actions)
*   [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
*   [Supabase Deployment](https://supabase.com/docs/guides/platform/deployments)
*   [Upstash Deployment](https://upstash.com/docs/redis/howto/deploy)
