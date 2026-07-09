# VEIL Project Structure

This document details the layout and file organization of the VEIL - Anonymous Social Space codebase, incorporating the documentation realignment and source cleanup.

## Folder Tree Overview

```
VEIL_SOCIAL/
├── backend/
│   ├── prisma/             # Schema, migrations, and seed scripts
│   │   ├── dev.db          # SQLite dev database
│   │   ├── schema.prisma   # Prisma schema with index optimizations
│   │   └── seed.js         # Seed data script
│   ├── src/
│   │   ├── config/         # Environment loading and database connections
│   │   ├── controllers/    # API endpoint handlers
│   │   ├── middleware/     # Rate limiters, security guards, validations
│   │   ├── routes/         # Express routing definitions
│   │   ├── schemas/        # Request schemas (Zod)
│   │   ├── services/       # AI moderation and retention crons
│   │   └── utils/          # Cryptographic helpers
│   ├── src/tests/          # Automated integration/unit test suite
│   ├── app.js              # Express main server runner
│   ├── ecosystem.config.cjs # PM2 cluster manager config
│   └── package.json        # Cleaned npm package configurations
├── docs/
│   ├── PRD.md              # Core Product Requirements Document
│   ├── README.md           # Documentation overview landing page
│   ├── PROJECT_STRUCTURE.md # This structure report
│   ├── api/
│   │   └── API_SPEC.md     # Express routing API endpoint specs
│   ├── architecture/
│   │   ├── AI_ARCHITECTURE.md   # AI generation & analysis flows
│   │   ├── ARCHITECTURE.md      # Platform high-level system layout
│   │   └── MODEL_SELECTION.md   # Model trade-offs and rationale
│   ├── archive/            # Archival folder for legacy specifications
│   │   ├── AUDIT_REPORT.md
│   │   ├── CHANGELOG.md
│   │   ├── COMPETITOR_ANALYSIS.md
│   │   ├── CURRENT_ARCHITECTURE.md
│   │   ├── DECISIONS_LOG.md
│   │   ├── E2EE_REMEDIATION_LOG.md
│   │   ├── E2EE_VERIFICATION_REPORT.md
│   │   ├── FEATURES.md
│   │   ├── MARKET_RESEARCH.md
│   │   ├── MONETIZATION.md
│   │   ├── MVP.md
│   │   ├── PROMPT_ENGINEERING.md
│   │   ├── ROADMAP.md
│   │   ├── SKILL.md
│   │   ├── USER_STORIES.md
│   │   └── report.md
│   ├── database/
│   │   └── DATABASE_SCHEMA.md  # Database specs and entity definitions
│   ├── deployment/
│   │   ├── DEPLOYMENT.md       # Target hosting plans (AWS / PM2)
│   │   └── run_guide.md        # Local startup instruction guide
│   ├── reports/
│   │   └── (Audit Reports generated during final production assessment)
│   ├── security/
│   │   ├── AI_MODERATION.md    # Safety rules and classifiers
│   │   ├── AI_SAFETY_POLICY.md # LLM usage guidelines
│   │   ├── AUTHENTICATION.md   # Passkeys, TOTP, and re-auth logic
│   │   ├── AUTHORIZATION.md    # Route restrictions
│   │   ├── DATA_RETENTION.md   # Two-phase cron purge workflows
│   │   ├── INCIDENT_RESPONSE.md# Secrets rotation & breach plans
│   │   ├── PRIVACY_POLICY.md   # Data treatment policies
│   │   ├── SECURITY.md         # Production threat model hardening
│   │   └── THREAT_MODEL.md     # OWASP top-10 mitigation vectors
│   └── testing/
│       ├── PERFORMANCE_TEST.md # Load and throughput tests
│       ├── SECURITY_TESTING.md # Pentesting methodologies
│       ├── TEST_CASES.md       # Interactive UI/UX test list
│       └── TEST_PLAN.md        # Automation plan
├── frontend/
│   ├── src/
│   │   ├── assets/         # Design and graphic resources
│   │   ├── components/     # UI components (atoms and layouts)
│   │   ├── hooks/          # React queries and store contexts
│   │   ├── lib/            # Crypto, face detection and api layers
│   │   └── routes/         # TanStack page routes
│   ├── eslint.config.js    # Optimized build linter settings
│   ├── package.json        # Frontend package configuration
│   └── vite.config.ts      # Vite compile directives
├── package.json            # Root level workspace runner configurations
└── README.md               # Primary project landing instructions
