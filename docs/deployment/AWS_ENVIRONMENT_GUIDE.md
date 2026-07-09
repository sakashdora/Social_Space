# AWS ENVIRONMENT VARIABLES GUIDE

This document guides the classification, lifecycle, and storage locations of VEIL's environment variables in the AWS production deployment.

## Variable Classification & Storage Map

| Variable | Class | Required? | Description | AWS Storage Target |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Public | Optional | Listening port for Express (default: 3000). | Parameter Store / Task Definition |
| `NODE_ENV` | Public | Required | Set to `production` to activate security features. | Parameter Store / Task Definition |
| `DATABASE_URL` | Secret | Required | PgBouncer pooler connection string. | Secrets Manager |
| `DIRECT_URL` | Secret | Required | Direct PostgreSQL URL for migrations. | Secrets Manager |
| `AI_API_KEY` | Secret | Required | API key for Google Gemini Studio moderation. | Secrets Manager |
| `AI_API_URL` | Server-only | Optional | API URL endpoint for AI Studio. | Parameter Store |
| `AI_MODEL` | Server-only | Optional | AI model designation (e.g. `gemini-2.5-flash`). | Parameter Store |
| `GROK_API_KEY` | Secret | Optional | API key for Grok/x.AI draft article suggestions. | Secrets Manager |
| `JWT_SECRET` | Secret | Required | Key for signing JWT session tokens. | Secrets Manager |
| `ENCRYPTION_KEY` | Secret | Required | 64-character hex key for AES-GCM at-rest logs. | Secrets Manager |
| `RECOVERY_CODE_SECRET`| Secret | Required | Key for HMAC backup recovery codes. | Secrets Manager |
| `WEBAUTHN_RP_NAME` | Public | Required | WebAuthn relying party label (e.g. "Social Space").| Parameter Store |
| `WEBAUTHN_RP_ID` | Public | Required | Domain name without protocol (e.g. `veil.social`). | Parameter Store |
| `WEBAUTHN_ORIGIN` | Public | Required | Full client URL (e.g. `https://veil.social`). | Parameter Store |
| `FRONTEND_ORIGIN` | Public | Required | Allowed CORS origin (e.g. `https://veil.social`).| Parameter Store |
| `TOTP_ISSUER` | Public | Required | QR code issuer string (e.g. "Social Space"). | Parameter Store |
| `UPSTASH_REDIS_REST_URL`| Secret| Required | URL for challenge store and rate limit registry. | Secrets Manager |
| `UPSTASH_REDIS_REST_TOKEN`| Secret| Required | Token credentials for Upstash Redis. | Secrets Manager |

---

## Storage Architecture Descriptions

### 1. AWS Secrets Manager (Secret Variables)
All cryptographic keys, database credentials, and external API keys must be stored in AWS Secrets Manager. 
*   **Why**: Protects parameters using AWS Key Management Service (KMS) envelope encryption.
*   **Access**: Injected into the ECS Fargate container environment variables dynamically at boot time using IAM policies, avoiding hardcoding variables in images or code.

### 2. AWS Systems Manager Parameter Store (Public/Server-only Variables)
Non-sensitive variables (such as CORS origins, model names, and WebAuthn identifiers) should be saved as `String` parameters in AWS Parameter Store.
*   **Why**: Low-latency, cost-effective centralized configuration management.

### 3. Task Definition (Runtime Variables)
Infrastructure variables (like `PORT` or `NODE_ENV`) should be set directly in the ECS Task Definition schema.
