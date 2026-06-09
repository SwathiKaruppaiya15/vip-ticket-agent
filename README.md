# VIPulse AI — Intelligent VIP-Aware IT Service Desk

<div align="center">

![VIPulse AI](https://img.shields.io/badge/VIPulse-AI-6366f1?style=for-the-badge&logo=lightning&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![LangGraph](https://img.shields.io/badge/LangGraph-0.2-FF6B35?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb)

**AI-powered helpdesk that detects VIP employees, scores ticket priorities, routes intelligently, and escalates critical issues — all in under 3 seconds.**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Docker Setup](#docker-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [AI Pipeline](#ai-pipeline)
- [Authentication Flow](#authentication-flow)
- [VIP Detection System](#vip-detection-system)
- [Default Credentials](#default-credentials)
- [Features](#features)
- [Development](#development)

---

## Overview

VIPulse AI is a production-grade IT helpdesk platform that uses a **LangGraph multi-agent pipeline** to automatically:

- Detect whether a ticket submitter is a VIP employee (C-suite, VP, Gold/Platinum tier)
- Score ticket priority (0-100) weighted by VIP status, severity, urgency keywords, and business hours
- Route to the correct support team using AI reasoning
- Predict SLA breach risk and set deadlines
- Generate human-readable AI decision explanations
- Fire Discord webhook + email notifications for critical/VIP tickets

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Login → Dashboard → Submit Ticket → AI Decision        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                  FastAPI Backend                         │
│  JWT Auth │ REST API │ WebSocket (Redis pub/sub)        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│           LangGraph Multi-Agent Pipeline                 │
│                                                          │
│  Intake → VIP Detection → Priority Scoring              │
│       → Routing → SLA Prediction → Explainability       │
│       → Notification                                     │
│                                                          │
│  Fast-track: CRITICAL+VIP skips to Notification         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────┬───────────┴──────────┬────────────────────┐
│  MongoDB   │       Redis           │   Groq LLM API     │
│  (Beanie)  │  (Cache + Sessions)   │  (llama-3.1/3.3)   │
└────────────┴──────────────────────┴────────────────────┘
```

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.111 | Web framework |
| Beanie | 1.24 | MongoDB ODM (async) |
| Motor | 3.3.2 | Async MongoDB driver |
| PyMongo | 4.5.0 | MongoDB driver |
| LangGraph | 0.2.4 | Multi-agent orchestration |
| LangChain | 0.2.16 | LLM abstraction |
| Groq | via langchain-groq | LLM provider (llama3) |
| Redis | 5.0.4 | Caching + JWT sessions + pub/sub |
| Pydantic | 2.7.1 | Data validation |
| python-jose | 3.3.0 | JWT tokens |
| passlib + bcrypt | 1.7.4 / 3.2.2 | Password hashing |
| structlog | 24.1.0 | Structured logging |
| Sentry SDK | 2.1.1 | Error monitoring |
| aiosmtplib | 3.0.1 | Async email (Gmail SMTP) |
| httpx | 0.27.0 | Async HTTP (Discord webhooks) |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| Vite | 5.3 | Build tool |
| TypeScript | 5.4 | Type safety |
| Tailwind CSS | 3.4 | Styling |
| React Router | 6.24 | Navigation |
| React Query | 3.39 | Server state |
| Zustand | 4.5 | Client state |
| React Hook Form | 7.52 | Form handling |
| Zod | 3.23 | Schema validation |
| Chart.js | 4.4 | Analytics charts |
| Lucide React | 0.395 | Icons |
| Axios | 1.7 | HTTP client |

---

## Project Structure

```
vip-ticket/
├── vipulse-backend/
│   ├── app/
│   │   ├── agents/                 # LangGraph AI agents
│   │   │   ├── base_agent.py       # Abstract base (lazy LLM init)
│   │   │   ├── intake_agent.py     # Classify category/keywords
│   │   │   ├── vip_agent.py        # VIP detection (DB + scoring)
│   │   │   ├── priority_agent.py   # 0-100 priority scoring
│   │   │   ├── routing_agent.py    # Team assignment
│   │   │   ├── sla_agent.py        # SLA risk + deadline
│   │   │   ├── explainability_agent.py  # AI reasoning bullets
│   │   │   └── notification_agent.py    # Discord + email
│   │   ├── api/v1/
│   │   │   ├── routes/             # FastAPI routers
│   │   │   │   ├── auth.py         # JWT auth + first-login flow
│   │   │   │   ├── tickets.py      # Ticket CRUD + WebSocket
│   │   │   │   ├── dashboard.py    # Stats + charts + export
│   │   │   │   ├── analytics.py    # Deep aggregations
│   │   │   │   └── vip.py          # VIP employee management
│   │   │   ├── dependencies.py     # JWT auth dependencies
│   │   │   └── ws_manager.py       # WebSocket + Redis pub/sub
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings
│   │   │   ├── security.py         # JWT + bcrypt + Redis tokens
│   │   │   ├── database.py         # Beanie + Motor init
│   │   │   ├── redis_client.py     # redis.asyncio pool
│   │   │   ├── seeder.py           # Default user seeder
│   │   │   └── logging.py          # structlog config
│   │   ├── models/                 # Beanie document models
│   │   │   ├── ticket.py
│   │   │   ├── employee.py
│   │   │   └── user.py
│   │   ├── orchestrator/
│   │   │   ├── graph.py            # LangGraph StateGraph
│   │   │   └── state.py            # TypedDict AgentState
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # Business logic layer
│   │   │   ├── ticket_service.py
│   │   │   └── notification_service.py
│   │   ├── templates/
│   │   │   └── email_alert.html    # Jinja2 email template
│   │   └── utils/
│   │       ├── exceptions.py
│   │       └── response.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_agents.py
│   │   ├── test_auth.py
│   │   ├── test_dashboard.py
│   │   ├── test_notifications.py
│   │   ├── test_orchestrator.py
│   │   └── test_tickets.py
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── vipulse-frontend/
│   ├── src/
│   │   ├── api/                    # Axios API clients
│   │   │   ├── client.ts           # Interceptors + token refresh
│   │   │   ├── auth.ts
│   │   │   ├── tickets.ts
│   │   │   └── dashboard.ts
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── AuthBranding.tsx
│   │   │   ├── dashboard/          # Charts + stats
│   │   │   ├── layout/             # Sidebar + Header
│   │   │   ├── tickets/            # AI panel + table
│   │   │   └── ui/                 # Design system
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useWebSocket.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── SetupAccount.tsx    # First-login credential change
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Tickets.tsx
│   │   │   ├── TicketDetail.tsx
│   │   │   ├── AIDecision.tsx      # AI reasoning showstopper
│   │   │   ├── Analytics.tsx
│   │   │   └── AdminPanel.tsx
│   │   ├── store/
│   │   │   ├── authStore.ts        # Zustand + persist
│   │   │   └── ticketStore.ts
│   │   └── types/
│   │       ├── auth.ts
│   │       ├── ticket.ts
│   │       └── dashboard.ts
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Backend CI/CD
│       └── frontend-ci.yml         # Frontend CI/CD
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB 7.0 (local or Atlas)
- Redis 7.x
- Groq API key (free at [console.groq.com](https://console.groq.com))

---

### Backend Setup

```bash
cd vipulse-backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URL, Redis URL, Groq API key, etc.

# 3. Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On first startup, the server automatically seeds default users if the database is empty.

Swagger UI: **http://localhost:8000/docs**

---

### Frontend Setup

```bash
cd vipulse-frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000

# 3. Start dev server
npm run dev
```

App runs at: **http://localhost:5173**

---

### Docker Setup

```bash
cd vipulse-backend

# Start everything (API + MongoDB + Redis)
docker-compose up -d

# With Mongo Express UI
docker-compose --profile dev up -d
```

| Service | URL |
|---|---|
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Mongo Express | http://localhost:8081 |

---

## Environment Variables

```env
# Application
ENVIRONMENT=development
SECRET_KEY=your-secret-key-min-32-chars

# Database
MONGODB_URL=mongodb://localhost:27017/vipulse

# Cache
REDIS_URL=redis://localhost:6379/0

# AI
GROQ_API_KEY=your-groq-api-key

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Frontend
DASHBOARD_URL=http://localhost:3000

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create account |
| `POST` | `/api/v1/auth/login` | Sign in → access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate tokens |
| `POST` | `/api/v1/auth/logout` | Invalidate session |
| `GET` | `/api/v1/auth/me` | Current user profile |
| `PUT` | `/api/v1/auth/change-initial-credentials` | First-login credential update |

### Tickets

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/tickets/` | Create ticket (202, AI runs in background) |
| `GET` | `/api/v1/tickets/` | List with filters + pagination |
| `GET` | `/api/v1/tickets/{id}` | Get single ticket |
| `PATCH` | `/api/v1/tickets/{id}` | Update status/assignment |
| `DELETE` | `/api/v1/tickets/{id}` | Delete ticket |
| `GET` | `/api/v1/tickets/{id}/reasoning` | AI explainability detail |
| `WS` | `/api/v1/tickets/ws/tickets?token=...` | Real-time updates |

### Dashboard & Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/dashboard/stats` | KPI widgets (60s cache) |
| `GET` | `/api/v1/dashboard/charts/priority-distribution` | Doughnut chart data |
| `GET` | `/api/v1/dashboard/charts/department-issues` | Bar chart data |
| `GET` | `/api/v1/dashboard/charts/escalation-trends` | 7-day line chart |
| `GET` | `/api/v1/dashboard/charts/category-breakdown` | Category percentages |
| `GET` | `/api/v1/dashboard/live-tickets` | Top 20 open by priority score |
| `POST` | `/api/v1/dashboard/export` | CSV / PDF export (Manager+) |
| `GET` | `/api/v1/analytics/team-workload` | Team queue depth |
| `GET` | `/api/v1/analytics/resolution-time` | Avg hours by priority |

### VIP Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/vip/employees` | List VIP employees |
| `POST` | `/api/v1/vip/employees` | Register VIP employee |
| `PATCH` | `/api/v1/vip/employees/{id}` | Update VIP level/score |
| `DELETE` | `/api/v1/vip/employees/{id}` | Remove VIP record |

---

## AI Pipeline

The LangGraph pipeline runs asynchronously after ticket creation:

```
START
  │
  ▼
Intake Agent          (llama-3.1-8b-instant)
  • Classify category / subcategory
  • Extract urgency keywords
  │
  ▼
VIP Agent             (no LLM — DB lookup + rule-based)
  • Query vip_employees collection by employee_id
  • Apply manual score override if set
  • Fallback: role keyword scoring + department scoring
  • Seeds initial ai_reasoning bullets
  │
  ▼
Priority Agent        (llama-3.3-70b-versatile)
  • Score 0-100 weighted by VIP confidence, severity, keywords, time
  │
  ├── CRITICAL + VIP ──────────────────────────────┐
  │                                                 │
  ▼                                                 │
Routing Agent         (llama-3.3-70b-versatile)    │
  • Select best support team                        │
  │                                                 │
  ▼                                                 │
SLA Agent             (llama-3.3-70b-versatile)    │
  • Risk score + deadline (VIP gets 50% window)    │
  │                                                 │
  ▼                                                 │
Explainability Agent  (llama-3.3-70b-versatile)    │
  • 4-6 AI reasoning bullets                        │
  │                                                 │
  └─────────────────────────────────────────────────┘
  │
  ▼
Notification Agent    (no LLM)
  • Discord webhook (embeds)
  • Gmail SMTP (Jinja2 HTML email)
  │
  ▼
END → DB update → Cache invalidation → WebSocket broadcast
```

**Fast-track**: When a ticket is both CRITICAL priority AND VIP employee, it skips routing/SLA/explainability and fires notifications immediately.

---

## Authentication Flow

### Standard Login
1. `POST /auth/login` with email + password
2. Returns `access_token` (30 min) + `refresh_token` (7 days)
3. Refresh tokens stored in Redis; blocklist in Redis on logout

### First-Login Setup (Demo Admin)
1. Admin logs in with `admin@vipulse.ai / admin123`
2. API returns `must_change_credentials: true`
3. Frontend redirects to `/setup-account`
4. User sets new email + strong password
5. Old session invalidated; user logs in with new credentials

### Token Security
- Every JWT carries a `jti` (UUID) for blocklisting
- Redis stores: `refresh:{user_id}` → JTI (7-day TTL)
- Redis stores: `blocklist:{jti}` → "1" (remaining access token TTL)
- Refresh token rotation on every use (old JTI deleted, new one stored)

---

## VIP Detection System

### Detection Priority
1. **MongoDB lookup** by `employee_id` (highest priority)
   - `vip_score_override` set → used directly as confidence (0-100)
   - Stored `vip_level` → baseline confidence: Platinum=90, Gold=70, Silver=50
2. **Role keyword scoring** (fallback when not in DB)
   - CEO/CTO/CFO: 50 pts | VP/SVP/EVP: 45 pts | Director: 40 pts
3. **Department scoring** (additive)
   - Executive: 25 pts | Finance/Security: 20 pts | Legal: 18 pts

### VIP Levels
| Level | Min Score | Priority Boost |
|---|---|---|
| PLATINUM | 80 | Full fast-track + 35 pts priority |
| GOLD | 60 | Full fast-track + 28 pts priority |
| SILVER | 40 | Elevated priority + VIP routing |
| STANDARD | < 40 | Normal processing |

### Registering a VIP Employee

```bash
POST /api/v1/vip/employees
Authorization: Bearer <manager-or-admin-token>

{
  "employee_id": "EMP101",
  "name": "Rajesh Kumar",
  "email": "rajesh@company.com",
  "role": "Finance Director",
  "department": "Finance",
  "vip_level": "gold",
  "vip_score_override": 100
}
```

---

## Default Credentials

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@vipulse.ai` | `admin123` | **Must change on first login** |
| Manager | `manager@vipulse.ai` | `manager123` | Full access except delete |
| Support | `support@vipulse.ai` | `support123` | Create + update tickets |

> **Security**: Admin credentials must be changed on first login. The system enforces this via `must_change_credentials=true`.

---

## Features

### Backend
- ✅ JWT authentication with JTI blocklisting and refresh token rotation
- ✅ First-login credential change enforcement
- ✅ LangGraph 6-agent AI pipeline with fast-track for CRITICAL+VIP
- ✅ VIP detection: DB lookup → role scoring → department scoring
- ✅ Redis caching (tickets 1h TTL, dashboard stats 60s)
- ✅ WebSocket real-time updates via Redis pub/sub
- ✅ Discord webhook notifications with rich embeds
- ✅ Jinja2 HTML email alerts via Gmail SMTP
- ✅ Timezone-aware datetimes throughout (no naive datetime bugs)
- ✅ `jsonable_encoder` for safe datetime serialization
- ✅ Structured JSON logging with structlog + trace IDs
- ✅ Sentry error monitoring integration
- ✅ CSV / PDF export (Manager/Admin only)
- ✅ Readiness probe (`/ready`) checking MongoDB + Redis

### Frontend
- ✅ Split-screen login + register with password strength indicator
- ✅ First-login setup page with all password validation rules
- ✅ Route guards: `RequireAuth`, `RequireSetup`, `PublicOnly`
- ✅ Dashboard with 5 KPI cards + 4 Chart.js charts
- ✅ Live ticket feed with VIP gold border highlighting
- ✅ AI Decision page: SVG gauges + staggered reasoning bullet reveal
- ✅ WebSocket real-time toast notifications
- ✅ 30-second auto-refresh on dashboard
- ✅ Paginated ticket list with 5 filter dimensions
- ✅ Admin panel: VIP employee CRUD with modal forms
- ✅ Dark mode enterprise design system (Tailwind slate palette)
- ✅ Zero TypeScript errors, clean production build

---

## Development

### Run Backend Tests

```bash
cd vipulse-backend
pytest tests/ -v --asyncio-mode=auto
```

### Run Frontend Type Check + Build

```bash
cd vipulse-frontend
npx tsc --noEmit   # type check
npm run build      # production build
```

### Lint

```bash
# Backend
pip install ruff
ruff check .

# Frontend
npm run lint
npm run format:check
```

### Useful Dev Endpoints (non-production only)

```
GET  /api/v1/auth/debug/users   — list all users
POST /api/v1/auth/seed          — seed default users
GET  /docs                      — Swagger UI
GET  /ready                     — readiness probe
```

---

## CI/CD

GitHub Actions workflows at `.github/workflows/`:

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | Push/PR to `main` | lint → test → docker build → deploy to Render |
| `frontend-ci.yml` | Push/PR to `main` | lint → tsc + build → deploy to Vercel |

### Required GitHub Secrets

```
GROQ_API_KEY          MONGODB_URL           REDIS_URL
DISCORD_WEBHOOK_URL   GMAIL_USER            GMAIL_APP_PASSWORD
SENTRY_DSN            RENDER_DEPLOY_HOOK    VERCEL_TOKEN
VERCEL_ORG_ID         VERCEL_PROJECT_ID     CODECOV_TOKEN
```

---

## License

MIT © 2026 VIPulse AI
