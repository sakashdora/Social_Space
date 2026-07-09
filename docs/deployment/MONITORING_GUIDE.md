# SYSTEM MONITORING & TELEMETRY GUIDE

This document guides the monitoring, logging, and incident-alerting configurations for VEIL in production.

## Logging Strategy

### 1. Application Logs
All standard server logs (`stdout`/`stderr` Morgan and console streams) are redirected to **Amazon CloudWatch Logs** via the `awslogs` log driver configured in the ECS task definition.
*   **Morgan Log Format**: Morgan uses the standard Apache `combined` format in production (automatically configured in `app.js` using `NODE_ENV === 'production'`) for easy parsing.
*   **Retention Policy**: 30 days retention to keep log costs low.

### 2. Audit & Security Event Logs
Timeline security logs (sign-ins, MFA setup, passkey failures, account deletion requests) are persisted in the database `SecurityEvent` table. These logs are indexed on `[userId, createdAt]` for fast query retrievals.

---

## CloudWatch System Metrics & Alerts
The following CloudWatch metrics must be monitored:

| Metric Name | Threshold | Action Taken |
| :--- | :--- | :--- |
| **Fargate CPU Utilization** | `> 80%` for 5 mins | Autoscale (Add container task) |
| **Fargate Memory Utilization** | `> 85%` for 5 mins | Autoscale (Add container task) |
| **ALB 5XX Errors** | `> 10` per minute | Dispatch SMS / PagerDuty Alert |
| **ALB Healthy Host Count** | `< 1` healthy host | Dispatch Critical Alarm |
| **RDS DB CPU Utilization** | `> 80%` for 5 mins | Dispatch Database Load Alert |

---

## Health Checks & Liveness Probes
Our Application Load Balancer targets the health endpoint `/healthz` on port 3000 to determine if Fargate tasks are active and database connection pings are successful.

### ALB Health Check Options:
*   **Path**: `/healthz`
*   **Protocol**: HTTP
*   **Port**: traffic-port (3000)
*   **Interval**: 30 seconds
*   **Timeout**: 5 seconds
*   **Healthy Threshold**: 2 consecutive checks
*   **Unhealthy Threshold**: 3 consecutive checks

---

## Error Tracking & APM
To track code exceptions and memory leaks in production:
*   Integrate **Sentry** (or AWS X-Ray) for client-side and server-side crash reports.
*   Monitor performance bottlenecks on slow queries exceeding 100ms.
