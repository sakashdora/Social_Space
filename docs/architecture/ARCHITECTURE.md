# System Architecture - Veil Shine

## 1. Introduction

This document outlines the high-level system architecture for Veil Shine, an AI-powered anonymous social platform. The architecture is designed to support robust anonymity, scalability, security, and maintainability, leveraging a microservices-oriented approach to decouple components and facilitate independent development and deployment. The frontend, already built, interacts with a set of backend services that handle core application logic, data persistence, AI processing, and moderation.

## 2. Architectural Principles

*   **Anonymity by Design**: Core principle ensuring that user identity is never linked to activity. This is enforced at every layer of the architecture.
*   **Scalability**: Components are designed to scale independently to handle varying loads, particularly for AI processing and real-time interactions.
*   **Security First**: All interactions are secured, data is encrypted, and access controls are strictly enforced.
*   **Resilience**: The system is designed to be fault-tolerant, with mechanisms for graceful degradation and rapid recovery.
*   **Observability**: Comprehensive logging, monitoring, and tracing are integrated to provide insights into system health and performance.
*   **Modularity**: Services are loosely coupled, allowing for easier development, testing, and deployment.

## 3. High-Level Component Diagram

```mermaid
graph TD
    subgraph User Interface
        A[Web Frontend (React SPA)]
    end

    subgraph Backend Services
        B[API Gateway] -- Authenticates & Routes --> C(Auth Service)
        C -- Issues Anonymous Tokens --> B
        B -- Routes Requests --> D(Post Service)
        B -- Routes Requests --> E(Comment Service)
        B -- Routes Requests --> F(Reaction Service)
        B -- Routes Requests --> G(Feed Service)
        B -- Routes Requests --> H(Moderation Service)
        B -- Routes Requests --> I(AI Service)
        B -- Routes Requests --> J(Notification Service)
        B -- Routes Requests --> K(Admin Service)
    end

    subgraph Data Stores
        D -- Reads/Writes --> L[PostgreSQL Database]
        E -- Reads/Writes --> L
        F -- Reads/Writes --> L
        G -- Reads/Writes --> L
        H -- Reads/Writes --> L
        I -- Reads/Writes --> L
        J -- Reads/Writes --> L
        K -- Reads/Writes --> L
        G -- Caches Data --> M[Redis Cache]
        H -- Stores Moderation Queues --> M
        I -- Caches AI Responses --> M
    end

    subgraph External Services
        I -- Calls --> N[External LLM Providers (Groq, Together AI)]
        H -- Calls --> N
        J -- Sends --> O[Email Service (Resend)]
        J -- Sends --> P[Push Notification Service]
        I -- Stores AI-generated Media --> Q[Object Storage (Cloudflare R2)]
    end

    subgraph Background Processing
        R[Queue (BullMQ)] -- Processes --> H
        R -- Processes --> I
        R -- Processes --> J
    end

    A -- Makes Requests --> B
    H -- Sends to Queue --> R
    I -- Sends to Queue --> R
    J -- Sends to Queue --> R
```

## 4. Component Descriptions

### 4.1. User Interface (Web Frontend)
*   **Description**: The client-side application, already developed as a React SPA, provides the user interface for interacting with Veil Shine. It communicates with the Backend Services primarily through the API Gateway.
*   **Technologies**: React, TypeScript.

### 4.2. Backend Services

#### 4.2.1. API Gateway
*   **Description**: The entry point for all client requests. It handles request routing, authentication, rate limiting, and potentially some cross-cutting concerns like logging and metrics collection. It forwards requests to the appropriate backend service.
*   **Technologies**: Express.js, Nginx (or similar).

#### 4.2.2. Auth Service
*   **Description**: Manages anonymous user registration, session management, and token issuance. It provides anonymous tokens (e.g., JWTs) to the API Gateway for subsequent request authorization. Crucially, it never stores PII.
*   **Technologies**: Express.js, Supabase Auth (for token management, not PII), PostgreSQL.

#### 4.2.3. Post Service
*   **Description**: Handles all operations related to anonymous posts, including creation, retrieval, updating, and deletion. It interacts with the PostgreSQL database for persistence.
*   **Technologies**: Express.js, Prisma ORM, PostgreSQL.

#### 4.2.4. Comment Service
*   **Description**: Manages anonymous comments and replies on posts. It ensures proper threading and association with posts.
*   **Technologies**: Express.js, Prisma ORM, PostgreSQL.

#### 4.2.5. Reaction Service
*   **Description**: Handles anonymous user reactions (e.g., upvotes, emojis) to posts and comments. It aggregates reaction counts and ensures anonymity.
*   **Technologies**: Express.js, Prisma ORM, PostgreSQL.

#### 4.2.6. Feed Service
*   **Description**: Responsible for generating personalized anonymous content feeds for users. It aggregates data from the Post, Comment, and Reaction services, potentially using Redis for caching and real-time updates.
*   **Technologies**: Express.js, Prisma ORM, PostgreSQL, Redis.

#### 4.2.7. Moderation Service
*   **Description**: Orchestrates content moderation. It receives content from Post/Comment services, sends it to the AI Service for analysis, manages moderation queues, and applies content policies. It also handles user reports.
*   **Technologies**: Express.js, BullMQ, Redis, PostgreSQL.

#### 4.2.8. AI Service
*   **Description**: Encapsulates all AI-related functionalities, including content analysis (sentiment, toxicity), content generation (images, audio), and smart suggestions. It interfaces with external LLM providers and object storage for media.
*   **Technologies**: Express.js, External LLM APIs (Groq, Together AI), Cloudflare R2, Redis.

#### 4.2.9. Notification Service
*   **Description**: Manages and sends anonymous notifications to users (e.g., new comments on their posts, trending topics). It can integrate with email services (Resend) or push notification services.
*   **Technologies**: Express.js, BullMQ, Resend, PostgreSQL.

#### 4.2.10. Admin Service
*   **Description**: Provides an interface for platform administrators to manage users (e.g., ban abusive users via Trust Tokens), review moderation queues, and configure system settings. Access to this service is highly restricted and audited.
*   **Technologies**: Express.js, PostgreSQL.

### 4.3. Data Stores

#### 4.3.1. PostgreSQL Database
*   **Description**: The primary relational database for persistent storage of all structured application data, including posts, comments, reactions, user metadata (anonymous), and moderation logs.
*   **Technologies**: PostgreSQL (managed via Supabase).

#### 4.3.2. Redis Cache
*   **Description**: Used for high-speed data caching (e.g., feed content, trending topics), session management, rate limiting, and as a message broker for queues.
*   **Technologies**: Redis (managed via Upstash).

### 4.4. External Services

#### 4.4.1. External LLM Providers
*   **Description**: Third-party APIs (e.g., Groq, Together AI) used by the AI Service for large language model capabilities such as content analysis, summarization, and generation.
*   **Technologies**: Groq API, Together AI API.

#### 4.4.2. Email Service
*   **Description**: Used by the Notification Service for sending transactional emails (e.g., account recovery links, moderation alerts to admins) without revealing user PII.
*   **Technologies**: Resend.

#### 4.4.3. Push Notification Service
*   **Description**: (Future) Used for sending real-time notifications to mobile clients.
*   **Technologies**: Firebase Cloud Messaging (FCM) or similar.

#### 4.4.4. Object Storage
*   **Description**: Stores unstructured data such as AI-generated images, audio files, and other media attachments. Optimized for high availability and scalability.
*   **Technologies**: Cloudflare R2.

### 4.5. Background Processing

#### 4.5.1. Queue (BullMQ)
*   **Description**: A message queue system used for asynchronous processing of long-running or resource-intensive tasks, such as AI content analysis, notification delivery, and data cleanup. This prevents blocking the main API request flow.
*   **Technologies**: BullMQ, Redis.

## 5. Data Flow Example: Anonymous Post Creation

1.  **User Action**: User creates a new post in the Web Frontend.
2.  **API Request**: Frontend sends a POST request to `/posts` endpoint via the API Gateway.
3.  **Authentication**: API Gateway validates the anonymous token with the Auth Service.
4.  **Routing**: API Gateway forwards the request to the Post Service.
5.  **Post Creation**: Post Service validates the content, stores it in the PostgreSQL Database, and returns a success response.
6.  **Asynchronous Processing**: Post Service sends a message to the Queue (BullMQ) to trigger AI analysis (Moderation Service, AI Service) and potentially feed updates (Feed Service).
7.  **AI Analysis**: Moderation Service and AI Service consume messages from the Queue, perform sentiment analysis, toxicity checks, and update moderation queues.
8.  **Feed Update**: Feed Service consumes messages from the Queue, updates relevant user feeds, and caches new content in Redis.

## 6. Future Architectural Considerations

*   **Edge Computing**: For lower latency content delivery and AI inference.
*   **Decentralized Components**: Exploring blockchain or IPFS for enhanced anonymity and censorship resistance.
*   **Advanced AI Orchestration**: More sophisticated workflows for complex AI tasks and model management.

## 7. References

*   [Mermaid Documentation](https://mermaid.js.org/) - Diagramming and charting tool that uses text-based definitions.
