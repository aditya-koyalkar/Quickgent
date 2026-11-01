# Quickgent — Autonomous Agentic Workflow Platform

> **Quickgent** is an enterprise-grade visual AI workflow platform and execution runtime. It empowers teams to design, iterate, and deploy agentic AI graphs, autonomous tool-calling agents, and real-time conversational assistants with token streaming, stateless compute, and production-grade security.

---

## Architecture & High-Level Design (HLD)

Quickgent is organized as a decoupled, multi-tier system with strict separation between user-facing services, state persistence, and AI compute.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 HIGH-LEVEL ARCHITECTURE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

     [ Client / Browser ] ────────────────────────┐
     (React 19 + Vite + Tailwind v4)              │  Public / Embed Live Chat
                                                  ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                               API GATEWAY (apps/api)                                 │
 │  • Central Gateway, Authentication & Access Control (NestJS)                         │
 │  • Single Source of Truth for Database Writes (Prisma ORM)                           │
 │  • Multi-Tier Rate Limiting & Denial-of-Service Protection                            │
 │  • HMAC-SHA256 Cryptographic Request Signer                                          │
 └──────────────┬────────────────────────────────────────────────────────┬──────────────┘
                │                                                        │
         Prisma Client                                             HMAC-SHA256
         (PostgreSQL)                                            Internal Gateway
                ▼                                                        ▼
 ┌─────────────────────────────┐                         ┌──────────────────────────────┐
 │   POSTGRESQL 17 + REDIS 7   │                         │   COMPUTE ENGINE (Python)    │
 │ • User Accounts & Projects  │                         │ • Pure Stateless Compute     │
 │ • Workflow Graphs & Version │                         │ • Real-Time Token Streaming  │
 │ • Multi-Turn Conversations  │                         │ • Autonomous Agent Tools     │
 │ • Execution Audit & Telemetry                         │ • Google Gemini (Flash-Lite) │
 └─────────────────────────────┘                         └──────────────────────────────┘
```

---

## Core System Components

### 1. Web Application (`apps/web`)
* **Visual Graph Studio**: Drag-and-drop canvas for composing LLM prompts, autonomous agents, conditional branching, HTTP connectors, and data transformers.
* **Live Agent Portal**: Real-time chat interface with token-by-token streaming, active tool observation indicators, and execution telemetry inspection.
* **Project Dashboard & Analytics**: Project management, version history, execution success rates, and token consumption analytics.

### 2. API Gateway (`apps/api`)
* **State & Persistence Owner**: Manages all database models, transactions, migrations, and relationship integrity via Prisma.
* **Security & Auth Gateway**: Default-deny access control, JWT issuance, HttpOnly session cookies, and route-level rate limiting.
* **Stream Relay**: Proxies Server-Sent Events (SSE) from the Engine to the client in real-time, then commits final execution audit records upon stream completion.
* **Inter-Service Authentication**: Generates time-based cryptographic signatures for all requests to the Engine.

### 3. Execution Engine (`apps/engine`)
* **Pure Stateless Compute Worker**: Operates entirely in-memory with zero direct database connections, eliminating schema drift, connection pool exhaustion, and foreign key race conditions.
* **Token Streaming Generator**: Streams response tokens chunk-by-chunk via Server-Sent Events (SSE) as they are yielded by Google Gemini.
* **Autonomous Tool Executor**: Executes built-in tools (Web Search, Safe Calculator, Datetime) and feeds observations back into the agent reasoning loop.
* **HMAC Request Verifier**: Validates cryptographic signatures and prevents replay attacks using a 5-minute timestamp expiration window.

---

## Monorepo Directory Structure

```
Quickgent/
├── apps/
│   ├── api/                  # NestJS API Gateway & Persistence Manager
│   │   ├── src/auth/         # Authentication, JWT, and OAuth handlers
│   │   ├── src/common/       # Inter-service HMAC request signer
│   │   ├── src/conversations/# Studio Copilot management
│   │   ├── src/projects/     # Projects & execution analytics
│   │   ├── src/workflows/    # Workflow management & live streaming routes
│   │   └── src/prisma/       # Database client & schema
│   │
│   ├── engine/               # Python FastAPI Execution Runtime
│   │   ├── src/engine/common # HMAC auth validator & LLM streaming helpers
│   │   ├── src/engine/copilot# Studio workflow generator service
│   │   └── src/engine/workflow# Graph execution runtime & streaming router
│   │
│   └── web/                  # React 19 + Vite Frontend SPA
│       ├── src/components/   # Studio Canvas, nodes, and analytics modals
│       ├── src/hooks/        # useLiveWorkflow streaming chat hook
│       └── src/pages/        # Studio and Live Chat views
│
├── compose.yml               # Docker Compose configuration
└── README.md                 # System overview and architecture guide
```

---

## Environment Variables Reference

### API Gateway (`apps/api/.env`)
| Variable | Purpose |
| :--- | :--- |
| `PORT` | API server listen port (default: `3000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string for caching |
| `JWT_ACCESS_SECRET` | Secret key for JWT access tokens |
| `JWT_REFRESH_SECRET` | Secret key for JWT refresh tokens |
| `ENGINE_URL` | Internal URL to reach the Python Engine |
| `INTERNAL_ENGINE_SECRET`| Shared HMAC secret for signing requests to Engine |
| `CORS_ORIGIN` | Allowed web application origins |

### Execution Engine (`apps/engine/.env`)
| Variable | Purpose |
| :--- | :--- |
| `PORT` | Engine server listen port (default: `8000`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Primary LLM model (e.g. `gemini-flash-lite-latest`) |
| `INTERNAL_ENGINE_SECRET`| Shared HMAC secret matching API Gateway |
| `CORS_ORIGINS` | Allowed origins for direct engine requests |

---

## Getting Started

### Running with Docker Compose (Recommended)

```bash
# Build and start all services (API, Engine, PostgreSQL, Redis)
docker compose up --build -d

# View live service logs
docker compose logs -f
```

* **Web Studio**: `http://localhost:5173`
* **API Gateway**: `http://localhost:3000/api/v1`
* **Engine**: `http://localhost:8000`

### Health Check Endpoints
* **API Health**: `GET http://localhost:3000/api/v1/health` (Checks API, PostgreSQL, and Redis connectivity)
* **Engine Health**: `GET http://localhost:8000/health` (Checks stateless engine status and HMAC authentication readiness)
