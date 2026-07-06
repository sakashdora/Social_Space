# Technology Stack - Veil Shine

## 1. Introduction

This document outlines the technology stack selected for the Veil Shine backend, providing justifications for each choice. The primary considerations for this selection include robust anonymity, scalability, security, developer productivity, and cost-effectiveness, particularly leveraging free-tier services for development and initial deployment.

## 2. Core Backend Technologies

### 2.1. Runtime Environment: Node.js with TypeScript
*   **Choice**: Node.js 20.x with TypeScript.
*   **Justification**:
    *   **Performance**: Node.js is highly performant for I/O-bound operations, which are common in API services (e.g., database queries, external API calls).
    *   **Unified Language**: Allows for a single language (JavaScript/TypeScript) across frontend and backend development, reducing context switching and improving developer efficiency.
    *   **Rich Ecosystem**: npm boasts a vast ecosystem of libraries and tools, accelerating development.
    *   **TypeScript**: Provides static typing, enhancing code quality, maintainability, and catching errors early in the development cycle. It improves the developer experience for larger codebases.

### 2.2. Web Framework: Express.js
*   **Choice**: Express.js.
*   **Justification**:
    *   **Minimalist & Flexible**: Express.js is a fast, unopinionated, and minimalist web framework for Node.js, providing the core functionalities needed for building robust APIs without imposing excessive structure.
    *   **Widespread Adoption**: Its popularity ensures a large community, extensive documentation, and numerous middleware options for various concerns like routing, authentication, and error handling.
    *   **Performance**: Lightweight nature contributes to good performance, especially when combined with Node.js.

### 2.3. Data Validation: Zod
*   **Choice**: Zod.
*   **Justification**:
    *   **TypeScript-First**: Zod is a TypeScript-first schema declaration and validation library, offering excellent type inference and ensuring runtime validation matches compile-time types.
    *   **Developer Experience**: Provides a concise and readable way to define schemas for API requests, responses, and database models, significantly reducing boilerplate code for validation.
    *   **Robustness**: Helps prevent common API errors by ensuring data integrity at the application boundaries.

## 3. Data Persistence & Caching

### 3.1. Relational Database: PostgreSQL via Supabase
*   **Choice**: PostgreSQL, hosted on Supabase.
*   **Justification**:
    *   **Robustness & Reliability**: PostgreSQL is a powerful, open-source object-relational database system known for its reliability, feature richness, and strong support for complex queries and data integrity.
    *   **JSONB Support**: Excellent support for JSONB data types, allowing flexible storage of AI-generated labels and sentiment analysis results.
    *   **Supabase Free Tier**: Supabase offers a generous free tier that includes a hosted PostgreSQL database, authentication services, and storage, making it ideal for development and initial deployment without incurring costs.

### 3.2. Object-Relational Mapper (ORM): Prisma
*   **Choice**: Prisma.
*   **Justification**:
    *   **Type Safety**: Prisma is a modern ORM that provides type-safe database access, generating a client that is fully type-aware, which aligns perfectly with our TypeScript backend.
    *   **Developer Productivity**: Simplifies database interactions, migrations, and schema management, reducing the amount of boilerplate SQL code.
    *   **Readability**: Prisma's declarative schema and fluent API make database operations intuitive and easy to understand.

### 3.3. In-Memory Data Store / Cache: Redis via Upstash
*   **Choice**: Redis, hosted on Upstash.
*   **Justification**:
    *   **Speed**: Redis is an extremely fast in-memory data store, suitable for caching frequently accessed data (e.g., feed content, trending topics), session management, and rate limiting.
    *   **Versatility**: Supports various data structures (strings, hashes, lists, sets, sorted sets), making it flexible for different caching and real-time use cases.
    *   **Upstash Free Tier**: Upstash provides a serverless Redis offering with a free tier that is sufficient for development and initial production loads, offering low-latency access globally.

### 3.4. Object Storage: Cloudflare R2
*   **Choice**: Cloudflare R2.
*   **Justification**:
    *   **Cost-Effective**: R2 offers competitive pricing with no egress fees, making it highly economical for storing AI-generated media (images, audio) and other static assets.
    *   **S3-Compatible API**: Provides an S3-compatible API, allowing easy integration with existing libraries and tools.
    *   **Global Reach**: Leverages Cloudflare's global network for low-latency access to stored objects.
    *   **Free Tier**: Includes a free tier with 10 GB of storage and 1 million read/1 million write operations per month, ideal for development and early-stage projects.

## 4. AI Integration

### 4.1. Large Language Models (LLMs): Groq, Together AI, Ollama
*   **Choice**: A combination of Groq API, Together AI, and local Ollama instances.
*   **Justification**:
    *   **Performance & Cost**: Groq offers extremely fast inference speeds for open-source models like Llama 3 and Mixtral, often with a free tier or very low cost, suitable for real-time AI moderation and sentiment analysis.
    *   **Flexibility**: Together AI provides access to a wide range of open-source models with a free credit for new users, offering flexibility for different AI tasks.
    *   **Local Development**: Ollama allows running open-source LLMs locally, providing a completely free and private environment for development, testing, and fine-tuning without external API dependencies.
    *   **Anonymity**: Using these services for AI processing ensures that user content is processed without linking to PII, and allows for architectural separation of AI concerns.

## 5. Asynchronous Processing & Messaging

### 5.1. Message Queue: BullMQ
*   **Choice**: BullMQ.
*   **Justification**:
    *   **Reliability**: Built on Redis, BullMQ provides a robust and reliable job queue for Node.js, ensuring that background tasks (e.g., AI processing, notifications) are processed even if the application restarts.
    *   **Scalability**: Allows for easy scaling of background workers independently of the main API services.
    *   **Features**: Supports delayed jobs, recurring jobs, job priorities, and concurrency control, which are essential for managing AI tasks and notifications efficiently.
    *   **Integration with Upstash**: Seamlessly integrates with Upstash Redis, leveraging its free tier.

## 6. DevOps & Monitoring

### 6.1. Containerization: Docker & Docker Compose
*   **Choice**: Docker and Docker Compose.
*   **Justification**:
    *   **Portability**: Containers ensure that the application runs consistently across different environments (development, staging, production).
    *   **Isolation**: Isolates application dependencies, preventing conflicts and simplifying environment setup.
    *   **Reproducibility**: Docker Compose allows defining and running multi-container Docker applications, making local development environments easy to set up and reproduce.

### 6.2. CI/CD: GitHub Actions
*   **Choice**: GitHub Actions.
*   **Justification**:
    *   **Integration**: Native integration with GitHub repositories, simplifying the setup of continuous integration and continuous deployment pipelines.
    *   **Automation**: Automates testing, building, and deployment processes, improving release velocity and code quality.
    *   **Free Tier**: Offers a generous free tier for public repositories, making it a cost-effective solution for open-source or early-stage projects.

### 6.3. Error Monitoring: Sentry
*   **Choice**: Sentry.
*   **Justification**:
    *   **Real-time Error Tracking**: Provides real-time error monitoring and reporting, allowing developers to quickly identify, diagnose, and fix issues in production.
    *   **Contextual Information**: Captures detailed stack traces, user context (anonymous), and environment information, aiding in debugging.
    *   **Free Tier**: Sentry offers a free developer plan that is sufficient for tracking errors in a growing application.

## 7. Communication & Collaboration

### 7.1. Email Service: Resend
*   **Choice**: Resend.
*   **Justification**:
    *   **Developer-Friendly API**: Offers a modern, developer-friendly API for sending transactional emails.
    *   **Deliverability**: Focuses on high email deliverability rates.
    *   **Free Tier**: Provides a free tier for sending up to 3,000 emails per month, suitable for account recovery links and administrative notifications.

## 8. Summary of Free-Tier Services for Development

| Service         | Free Tier Offering                                                              |
|-----------------|---------------------------------------------------------------------------------|
| **Supabase**    | Hosted PostgreSQL (500 MB DB, 1 GB file storage), Auth, Realtime, Edge Functions. |
| **Upstash**     | Serverless Redis (10,000 commands/day, 256 MB data limit).                      |
| **Cloudflare R2** | 10 GB storage, 1 million read/1 million write operations per month, no egress fees. |
| **Groq API**    | Free tier for fast inference with open-source LLMs (check current limits).      |
| **Together AI** | Initial free credit for accessing various open-source LLMs.                     |
| **Ollama**      | Run open-source LLMs locally, completely free.                                  |
| **Resend**      | 3,000 emails per month.                                                         |
| **Sentry**      | 5,000 errors per month.                                                         |
| **GitHub Actions** | Free for public repositories.                                                   |

## 9. References

*   [Node.js Official Website](https://nodejs.org/)
*   [TypeScript Official Website](https://www.typescriptlang.org/)
*   [Express.js Official Website](https://expressjs.com/)
*   [Zod GitHub Repository](https://github.com/colinhacks/zod)
*   [PostgreSQL Official Website](https://www.postgresql.org/)
*   [Supabase Official Website](https://supabase.com/)
*   [Prisma Official Website](https://www.prisma.io/)
*   [Redis Official Website](https://redis.io/)
*   [Upstash Official Website](https://upstash.com/)
*   [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
*   [Groq Cloud](https://groq.com/cloud)
*   [Together AI](https://www.together.ai/)
*   [Ollama GitHub Repository](https://github.com/ollama/ollama)
*   [BullMQ Official Website](https://bullmq.io/)
*   [Docker Official Website](https://www.docker.com/)
*   [GitHub Actions Documentation](https://docs.github.com/en/actions)
*   [Sentry Official Website](https://sentry.io/)
*   [Resend Official Website](https://resend.com/)
