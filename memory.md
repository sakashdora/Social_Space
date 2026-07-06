# Memory - Veil Shine (Complete Project Context)

> **Last Updated**: July 3, 2026
> **Purpose**: This file serves as the single source of truth / memory for the entire Veil Shine project.

---

## 1. Project Overview

**Veil Shine** is an AI-powered anonymous social platform where users can post confessions, stories, and messages anonymously, interact via reactions/comments, and leverage AI for content moderation, sentiment analysis, and smart suggestions.

- **Frontend**: Already built using React/TypeScript (React SPA)
- **Frontend Source**: Located in `frontend/` folder
- **Backend**: Node.js + Express.js (organized under `backend/`)
- **Database**: MongoDB (current basic setup) → planned migration to PostgreSQL via Supabase
- **AI Integration**: Moderation, NLP (sentiment), Generative AI via external microservices

---

## 2. Files Inventory

### Root-Level Source Code Files
| File | Type | Description |
|------|------|-------------|
| `app.js` | Backend Entry | Express.js app with MongoDB, CORS, Helmet, Morgan; routes for posts |
| `package.json` | Config | Dependencies: express, mongoose, axios, cors, dotenv, helmet, morgan, openai |
| `.env` | Config | PORT=3000, MONGO_URI, AI service URLs (moderation/5001, nlp/5002, generation/5003) |
| `Post.js` | Model | Mongoose schema: content, moderationStatus, sentiment, tags |
| `postController.js` | Controller | Placeholder createPost/getPosts handlers |
| `postRoutes.js` | Routes | POST/GET /posts with AI middleware |
| `userService.js` | Service | Placeholder createUser/getUserById |
| `aiIntegration.js` | Middleware | moderateContent, analyzeSentiment, generateSuggestions — calls external AI services via axios |
| `fetch_app.py` | Utility | Python script to scrape/analyze the frontend URL |

### Documentation Files (All `.md`)

#### Product Documentation
| File | Content Summary |
|------|----------------|
| `Product Requirements Document (PRD) - Veil Shine.md` | Vision, goals, 3 personas (Confider, Explorer, Contributor), functional requirements for anonymity, content creation, discovery, AI |
| `Minimum Viable Product (MVP) - Veil Shine.md` | MVP scope: anonymous accounts, text posts, categories, comments, reactions, AI moderation, sentiment analysis |
| `Features - Veil Shine.md` | P0/P1/P2 feature catalogue covering anonymity, content creation, discovery |
| `User Stories - Veil Shine.md` | Gherkin-style user stories for all personas and features |
| `Product Roadmap - Veil Shine.md` | Phase 0 (MVP Q3 2026) → Phase 1 (v1.0 Q4 2026-Q1 2027) → Phase 2 (v2.0) → Phase 3 (v3.0 2028+) |

#### Architecture Documentation
| File | Content Summary |
|------|----------------|
| `System Architecture - Veil Shine.md` | Microservices architecture with Mermaid diagrams: API Gateway, Auth/Post/Comment/Reaction/Feed/Moderation/AI/Notification/Admin services |
| `Database Schema - Veil Shine.md` | PostgreSQL schema: users, posts, comments, reactions, moderation_logs, admin_users tables with ERD |
| `API Specification - Veil Shine.md` | Full REST API spec: Auth (register/login/refresh), Users, Posts, Comments, Reactions, Moderation endpoints |
| `Technology Stack - Veil Shine.md` | Node.js 20 + TypeScript, Express.js, Zod, PostgreSQL/Supabase, Prisma, Redis/Upstash, Cloudflare R2, Groq/Together AI/Ollama, BullMQ, Docker, GitHub Actions, Sentry, Resend |
| `Deployment Guide - Veil Shine.md` | Docker Compose (dev), Kubernetes (prod), CI/CD with GitHub Actions |

#### Security Documentation
| File | Content Summary |
|------|----------------|
| `Security Overview - Veil Shine.md` | Security posture: anonymity by architecture, least privilege, defense in depth, secure defaults |
| `Authentication - Veil Shine.md` | Anonymous JWT auth, handle-based identity, no PII collection |
| `Authorization - Veil Shine.md` | Hybrid RBAC (admins) + context-based (users) authorization model |
| `Threat Model - Veil Shine.md` | STRIDE threat model with DFD, threats for Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Elevation of Privilege |
| `Privacy Policy - Veil Shine.md` | GDPR/CCPA-aligned; NO PII collected; anonymous data only |
| `DATA_RETENTION.md` | Data lifecycle, retention periods, deletion workflows |
| `Incident Response Plan.md` | 5-phase: Identification → Containment → Eradication → Recovery → Post-Incident Analysis |

#### AI Documentation
| File | Content Summary |
|------|----------------|
| `AI Architecture.md` | NLP, Generative AI, Moderation AI components with Mermaid diagram |
| `AI Model Selection.md` | Model criteria, NLP (BERT/RoBERTa/Cloud APIs), Generative (GPT/Gemini), Moderation (hybrid rule-based + ML) |
| `Prompt Engineering.md` | Zero-shot, few-shot, chain-of-thought, role-playing, system prompts |
| `AI Safety Policy.md` | Harm prevention, fairness, transparency, human oversight |
| `Content Moderation Strategy.md` | 3 pillars: Proactive AI, Reactive human review, Policy enforcement with workflow diagram |

#### Testing Documentation
| File | Content Summary |
|------|----------------|
| `Test Plan.md` | Unit → Integration → System → UAT testing phases; Jest, Supertest, Cypress, JMeter, OWASP ZAP |
| `Test Cases.md` | Example test cases for auth, posts, AI moderation, sentiment, security, performance |
| `Security Testing Strategy.md` | SAST, DAST, IAST, Pen Testing, Vulnerability Scanning, AI/ML-specific security |
| `Performance Testing Strategy.md` | Load, Stress, Scalability, Soak, Spike testing; KPIs; JMeter/k6/Locust tools |

#### Business Documentation
| File | Content Summary |
|------|----------------|
| `Market Research.md` | Target audience (18-35, privacy-conscious), market size ($192.8B social media market), trends |
| `Competitor Analysis.md` | Direct: Whisper, Yik Yak, Reddit. Indirect: Traditional social media, Mental health apps, AI chatbots. Veil Shine USPs |
| `Monetization Strategy.md` | Freemium model, AI credits, community boosts |

#### Meta Documentation
| File | Content Summary |
|------|----------------|
| `Veil Shine - Complete Documentation & Backend Architecture Suite.md` | Master index linking all documentation domains |
| `Veil Shine Backend.md` | Backend README with setup instructions, folder structure, AI integration guide |
| `plan.md` | Complete plan for documentation suite + backend architecture with execution phases |
| `SKILL.md` | Image generation routing skill (not project-specific) |

---

## 3. Target Folder Structure (from plan.md)

```
VEIL_SOCIAL/
├── docs/
│   ├── README.md                    ← Master index
│   ├── product/
│   │   ├── PRD.md
│   │   ├── MVP.md
│   │   ├── FEATURES.md
│   │   ├── USER_STORIES.md
│   │   └── ROADMAP.md
│   ├── architecture/
│   │   ├── ARCHITECTURE.md
│   │   ├── DATABASE_SCHEMA.md
│   │   ├── API_SPEC.md
│   │   ├── TECH_STACK.md
│   │   └── DEPLOYMENT.md
│   ├── security/
│   │   ├── SECURITY.md
│   │   ├── AUTHENTICATION.md
│   │   ├── AUTHORIZATION.md
│   │   ├── THREAT_MODEL.md
│   │   ├── PRIVACY_POLICY.md
│   │   ├── DATA_RETENTION.md
│   │   └── INCIDENT_RESPONSE.md
│   ├── ai/
│   │   ├── AI_ARCHITECTURE.md
│   │   ├── MODEL_SELECTION.md
│   │   ├── PROMPT_ENGINEERING.md
│   │   ├── SAFETY_POLICY.md
│   │   └── MODERATION.md
│   ├── testing/
│   │   ├── TEST_PLAN.md
│   │   ├── TEST_CASES.md
│   │   ├── SECURITY_TESTING.md
│   │   └── PERFORMANCE_TEST.md
│   └── business/
│       ├── MARKET_RESEARCH.md
│       ├── COMPETITOR_ANALYSIS.md
│       └── MONETIZATION.md
│
├── backend/
│   ├── README.md
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   ├── storage.ts
│   │   │   └── ai.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── posts.routes.ts
│   │   │   ├── comments.routes.ts
│   │   │   ├── reactions.routes.ts
│   │   │   ├── feed.routes.ts
│   │   │   ├── moderation.routes.ts
│   │   │   └── admin.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── posts.controller.ts
│   │   │   ├── comments.controller.ts
│   │   │   ├── reactions.controller.ts
│   │   │   ├── feed.controller.ts
│   │   │   ├── moderation.controller.ts
│   │   │   └── admin.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── posts.service.ts
│   │   │   ├── comments.service.ts
│   │   │   ├── reactions.service.ts
│   │   │   ├── feed.service.ts
│   │   │   ├── moderation.service.ts
│   │   │   ├── ai.service.ts
│   │   │   └── notification.service.ts
│   │   ├── repositories/
│   │   │   ├── post.repository.ts
│   │   │   ├── comment.repository.ts
│   │   │   ├── reaction.repository.ts
│   │   │   └── user.repository.ts
│   │   ├── models/
│   │   │   ├── post.model.ts
│   │   │   ├── comment.model.ts
│   │   │   ├── reaction.model.ts
│   │   │   └── user.model.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rateLimit.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   ├── errorHandler.middleware.ts
│   │   │   └── cors.middleware.ts
│   │   ├── utils/
│   │   │   ├── jwt.ts
│   │   │   ├── crypto.ts
│   │   │   ├── pagination.ts
│   │   │   ├── logger.ts
│   │   │   └── response.ts
│   │   ├── jobs/
│   │   │   ├── moderation.job.ts
│   │   │   └── cleanup.job.ts
│   │   └── types/
│   │       ├── express.d.ts
│   │       └── index.ts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── scripts/
│       ├── seed.ts
│       └── migrate.ts
│
├── frontend/                        ← From frontend (cleaned)
│   └── (React SPA frontend source)
│
├── memory.md                        ← THIS FILE
└── plan.md
```

---

## 4. Technology Stack Summary

| Layer | Technology | Free Tier |
|-------|-----------|-----------|
| Runtime | Node.js 20 + TypeScript | Open source |
| Framework | Express.js + Zod validation | Open source |
| Database | PostgreSQL via Supabase | 500 MB free |
| ORM | Prisma | Open source |
| Cache | Redis via Upstash | 10K req/day free |
| Auth | Supabase Auth + custom JWT | Free tier |
| Storage | Cloudflare R2 | 10 GB free/month |
| Email | Resend | 3,000 emails/month free |
| AI/LLM | Groq API (Llama 3, Mixtral) | Free tier |
| AI/LLM alt | Together AI | $1 free credit |
| AI/LLM alt | Ollama (local) | Fully free |
| Queue | BullMQ + Upstash Redis | Free tier |
| Monitoring | Sentry | 5K errors/month free |
| CI/CD | GitHub Actions | Free for public repos |
| Container | Docker + Docker Compose | Open source |

---

## 5. Current State & Next Steps

### Current State
- ✅ All 30+ documentation files created and organized (product, architecture, security, AI, testing, business)
- ✅ Backend files restructured into `backend/` and ESM refactored
- ✅ `frontend/` folder populated with React SPA source code
- ✅ Folder structure organized per plan.md specification
- ✅ `docs/` organized folder structure
- ✅ `backend/` organized folder structure
- ✅ Frontend cleaned of external branding references and telemetry
- ✅ Backend fully developed (SQLite, Prisma, Auth, Posts, Comments, Reactions, and AI Moderation/Anonymization service)
- ✅ Frontend connected to backend API endpoints (TanStack Query integrations, Onboarding authentication, Compose publication, Feed fetching, Anonymize forwarding)
- ✅ Docker deployment configurations (Dockerfile, docker-compose.yml) added to backend
- ✅ Database seed script (seed.js) implemented and successfully executed

### Immediate Tasks
1. ✅ Create `memory.md` (this file)
2. ✅ Create the full folder structure as specified in plan.md
3. ✅ Move documentation files to `docs/` subfolders
4. ✅ Move/reorganize backend code into `backend/` structure
5. ✅ Get frontend source code
6. ✅ Clean external branding references and watermarks from frontend
7. ✅ Integrate frontend into project structure
8. ✅ Develop functional Express/Prisma backend
9. ✅ Connect frontend actions and pages to API endpoints
10. ✅ Containerize backend with Docker configurations
11. ✅ Seed database with default categories and mock feed posts

---

## 6. Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/register` | Create anonymous account (handle + optional passphrase) |
| POST | `/v1/auth/login` | Login with handle |
| POST | `/v1/auth/refresh` | Refresh JWT token |
| GET | `/v1/users/me` | Get current user profile |
| PUT | `/v1/users/me/avatar` | Update avatar |
| POST | `/v1/posts` | Create anonymous post |
| GET | `/v1/posts/{post_id}` | Get single post |
| GET | `/v1/posts/feed` | Get personalized feed |
| DELETE | `/v1/posts/{post_id}` | Soft-delete post |
| POST | `/v1/posts/{post_id}/comments` | Add comment |
| GET | `/v1/posts/{post_id}/comments` | Get comments |
| DELETE | `/v1/comments/{comment_id}` | Delete comment |
| POST | `/v1/posts/{post_id}/reactions` | React to post |
| POST | `/v1/comments/{comment_id}/reactions` | React to comment |
| DELETE | `/v1/reactions/{reaction_id}` | Remove reaction |
| GET | `/v1/admin/moderation/queue` | Get moderation queue (admin) |
| POST | `/v1/admin/moderation/{log_id}/action` | Take moderation action (admin) |

---

## 7. Database Schema (Key Tables)

- **users**: user_id (UUID PK), handle (UNIQUE), created_at, updated_at, is_banned, recovery_hash, avatar_url
- **posts**: post_id (UUID PK), user_id (FK), content, category, ai_labels (JSONB), media_url, sentiment_analysis (JSONB), is_deleted, is_ai_modified_media
- **comments**: comment_id (UUID PK), post_id (FK), user_id (FK), parent_comment_id (FK, nullable), content, is_deleted
- **reactions**: reaction_id (UUID PK), user_id (FK), post_id (FK, nullable), comment_id (FK, nullable), reaction_type
- **moderation_logs**: log_id (UUID PK), target_post_id, target_comment_id, admin_user_id, action_taken, reason, ai_flags (JSONB), original_content_snapshot
- **admin_users**: admin_user_id (UUID PK), username (UNIQUE), password_hash, role
