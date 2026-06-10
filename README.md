# VIPulse AI — Intelligent VIP IT Service Desk

<div align="center">

![VIPulse AI](https://img.shields.io/badge/VIPulse-AI-7C3AED?style=for-the-badge&logo=lightning&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![LangGraph](https://img.shields.io/badge/LangGraph-0.2-4F46E5?style=for-the-badge&logo=openai&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

**An AI-powered enterprise IT helpdesk with automatic VIP detection, multi-agent triage, SLA prediction, and real-time escalation.**

</div>

---

## Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture Diagram](#-architecture-diagram)
- [AI Agent Pipeline](#-ai-agent-pipeline)
- [Data Models](#-data-models)
- [API Reference](#-api-reference)
- [Role-Based Access Control](#-role-based-access-control)
- [Setup Instructions](#-setup-instructions)
- [Run Instructions](#-run-instructions)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Assumptions](#-assumptions)
- [Limitations](#-limitations)
- [Demo Credentials](#-demo-credentials)

---

## 📋 Project Overview

VIPulse AI is a full-stack enterprise IT Service Desk platform that uses a **LangGraph multi-agent pipeline** to automatically triage, prioritize, and route IT support tickets. It detects VIP employees (C-suite, directors, senior executives) from a managed registry and applies accelerated handling to their requests.

The system processes each submitted ticket through **6 specialized AI agents** running in parallel — from classification and VIP detection to priority scoring, team routing, SLA prediction, and AI explainability — all within seconds of ticket submission.

### Core Value Propositions

| Problem | VIPulse Solution |
|---|---|
| Manual ticket sorting is slow | AI pipeline classifies & routes in < 3 seconds |
| VIP incidents get lost in queues | Automatic VIP detection with confidence scoring |
| SLA breaches discovered too late | Predictive SLA risk scoring on every ticket |
| No visibility into AI decisions | Full explainability panel with reasoning bullets |
| Bulk ticket creation is tedious | Excel/CSV import (1,000 rows) + PDF AI extraction |
| Static priority assignment | Dynamic scoring: VIP level × severity × keywords × business hours |

---

## ✨ Key Features

### Ticket Management
- **Manual ticket submission** with structured form validation
- **Bulk Excel/CSV import** — up to 1,000 tickets per upload with column alias detection
- **PDF/Image AI extraction** — Groq LLaMA3 reads PDFs and images, extracts structured ticket data, supports multi-issue documents
- **Soft delete** with full audit trail (is_deleted, deleted_at, deleted_by)
- **Real-time WebSocket updates** via Redis pub/sub

### AI Pipeline
- **Intake Agent** — classifies category/subcategory, detects urgency keywords
- **VIP Agent** — rule-based + MongoDB lookup, no LLM needed, 4-tier system (STANDARD/SILVER/GOLD/PLATINUM)
- **Priority Agent** — weighted scoring: VIP confidence (35%) + severity + keywords + business hours + category
- **Routing Agent** — LLM-based team assignment with VIP concierge override
- **SLA Agent** — breach risk prediction with VIP deadline multiplier (0.5×)
- **Explainability Agent** — generates human-readable reasoning bullets
- **Notification Agent** — Discord webhook + Gmail SMTP alerts
- **Fast-track path** — CRITICAL + VIP tickets skip routing/SLA and go directly to notification

### Dashboard & Analytics
- Live KPI cards with animated counters (today's tickets, VIP count, critical, escalated, SLA saved)
- Priority distribution doughnut chart
- Department issues bar chart
- 7-day escalation trend line chart
- Real-time live ticket feed (top 20 by priority score)
- Redis-cached dashboard stats (60s TTL), chart data (300s TTL)
- CSV/HTML export for managers and admins

### Security & Auth
- JWT authentication (access: 60min, refresh: 7 days)
- Token rotation on refresh, Redis blocklist on logout
- First-login credential change flow
- Role-based access control (Admin / Manager / Support Agent / Viewer)
- bcrypt password hashing (10 rounds)

---

## 🛠 Tech Stack

### Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Web Framework | FastAPI | 0.111.0 | REST API + WebSocket |
| ASGI Server | Uvicorn | 0.29.0 | Production server |
| Database | MongoDB Atlas | — | Primary data store |
| ODM | Beanie + Motor | 1.24.0 / 3.3.2 | Async MongoDB ORM |
| Cache / PubSub | Redis | 5.0.4 | Caching + WebSocket broker |
| AI Orchestration | LangGraph | 0.2.4 | Multi-agent state machine |
| LLM Framework | LangChain | 0.2.16 | LLM abstraction layer |
| LLM Provider | Groq (LLaMA3) | — | Fast inference |
| LLM Models | llama-3.1-8b-instant | — | Intake classification |
| | llama-3.3-70b-versatile | — | Priority / Routing / SLA |
| | llama3-70b-8192 | — | PDF extraction |
| Validation | Pydantic v2 | 2.7.1 | Request/response schemas |
| Auth | python-jose + passlib | — | JWT + bcrypt |
| Excel Parsing | pandas + openpyxl | 2.2.2 / 3.1.2 | Bulk ticket import |
| PDF Parsing | pdfplumber | 0.11.0 | Text extraction from PDFs |
| Email | aiosmtplib + Jinja2 | — | HTML email notifications |
| Observability | structlog + Sentry | — | Structured logging |

### Frontend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| UI Framework | React | 18.3.1 | Component tree |
| Language | TypeScript | 5.4.5 | Type safety |
| Build Tool | Vite | 5.3.1 | Dev server + bundler |
| Styling | Tailwind CSS | 3.4.4 | Utility-first dark theme |
| State (server) | React Query v3 | 3.39.3 | Server state + caching |
| State (client) | Zustand | 4.5.2 | Auth store |
| Forms | React Hook Form + Zod | 7.52 / 3.23 | Validated forms |
| Charts | Chart.js + react-chartjs-2 | 4.4.3 | Dashboard charts |
| Icons | Lucide React | 0.395.0 | Icon system |
| HTTP Client | Axios | 1.7.2 | API client with interceptors |
| Router | React Router v6 | 6.24.0 | SPA routing |

---

## 🏗 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VIPulse AI System Architecture                     │
└─────────────────────────────────────────────────────────────────────────────┘

  Browser (React + TypeScript + Vite)
  ┌────────────────────────────────────────────────────────────────────┐
  │  Pages: Login │ Dashboard │ Tickets │ Submit │ Analytics │ Admin   │
  │                                                                    │
  │  Components                    State                               │
  │  ├─ layout/                    ├─ authStore (Zustand + persist)    │
  │  │   ├─ Sidebar (collapse)     └─ ticketStore (Zustand)            │
  │  │   ├─ Header (search,bell)                                       │
  │  │   └─ PageWrapper            API Layer (Axios)                   │
  │  ├─ dashboard/                 ├─ /api/tickets.ts                  │
  │  │   ├─ StatsCard              ├─ /api/imports.ts                  │
  │  │   ├─ PriorityChart          ├─ /api/dashboard.ts                │
  │  │   ├─ DeptChart              └─ /api/client.ts (JWT interceptor) │
  │  │   ├─ EscalationTrend                                            │
  │  │   └─ LiveTicketFeed         WebSocket Hook                      │
  │  ├─ tickets/                   └─ useWebSocket (ping/pong, retry)  │
  │  │   ├─ TicketTable (delete)                                       │
  │  │   └─ AIDecisionPanel        React Query                         │
  │  └─ import/                    ├─ keepPreviousData                 │
  │      ├─ ExcelUpload            ├─ staleTime: 15-300s               │
  │      └─ PdfUpload              └─ stable query keys                │
  └─────────────────────┬──────────────────────────────────────────────┘
                        │ HTTPS / REST / WebSocket
                        ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    FastAPI Application (Uvicorn)                    │
  │                                                                     │
  │  Middleware: CORS │ RequestLogging │ TraceID                        │
  │  Exception Handlers: HTTP │ Validation │ Global                    │
  │                                                                     │
  │  Routers (prefix: /api/v1)                                         │
  │  ├─ /auth        → login, register, refresh, logout, change-creds  │
  │  ├─ /tickets     → CRUD + soft-delete + WebSocket (/ws/tickets)    │
  │  ├─ /tickets/import/excel   → bulk Excel/CSV import                │
  │  ├─ /tickets/import/pdf     → AI PDF extraction                    │
  │  ├─ /tickets/import/pdf/confirm → confirm previewed extraction     │
  │  ├─ /tickets/template       → download sample Excel                │
  │  ├─ /vip         → VIP employee CRUD                               │
  │  ├─ /dashboard   → stats, charts, live-feed, export                │
  │  └─ /analytics   → team workload, category breakdown               │
  │                                                                     │
  │  Dependencies: get_current_user │ require_roles │ get_ws_user       │
  └──────────────┬────────────────────────────────────────────────────-┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────────────────┐
  │ MongoDB  │ │  Redis   │ │          LangGraph AI Pipeline           │
  │  Atlas   │ │          │ │                                          │
  │          │ │ Key/TTL: │ │  START                                   │
  │ Collections:│ ticket:{id}│ │    │                                   │
  │ tickets  │ │  3600s   │ │    ▼                                     │
  │ users    │ │          │ │  [1] IntakeAgent                         │
  │ vip_     │ │ dashboard│ │   llama-3.1-8b-instant                   │
  │ employees│ │ :stats   │ │   → category, subcategory, keywords      │
  │          │ │  60s     │ │    │                                     │
  │ Indexes: │ │          │ │    ▼                                     │
  │ ticket_id│ │ dashboard│ │  [2] VIPAgent (rule-based, no LLM)       │
  │ (unique) │ │ :chart:* │ │   DB lookup → role scoring → dept boost  │
  │ priority │ │  300s    │ │   → vip_detected, vip_level, confidence  │
  │ +created │ │          │ │    │                                     │
  │ vip_det  │ │ refresh: │ │    ▼                                     │
  │ status   │ │ {user_id}│ │  [3] PriorityAgent                      │
  │ is_del   │ │  7d      │ │   llama-3.3-70b-versatile                │
  │          │ │          │ │   VIP(35%) + severity + keywords +       │
  │          │ │ blocklist│ │   business_hours + category → 0-100 score│
  │          │ │ :{jti}   │ │    │                                     │
  └──────────┘ └──────────┘ │    ▼                                     │
                             │  [CONDITIONAL EDGE]                      │
                             │  CRITICAL + VIP? ──YES──→ [6] Notify    │
                             │           │                              │
                             │          NO                              │
                             │           ▼                              │
                             │  [4] RoutingAgent                        │
                             │   llama-3.3-70b-versatile                │
                             │   category + VIP → team assignment       │
                             │    │                                     │
                             │    ▼                                     │
                             │  [5] SLAAgent                            │
                             │   llama-3.3-70b-versatile                │
                             │   VIP multiplier (0.5×) → deadline       │
                             │   → sla_risk_score 0-100                 │
                             │    │                                     │
                             │    ▼                                     │
                             │  [6] ExplainabilityAgent                 │
                             │   → ai_reasoning bullets                 │
                             │    │                                     │
                             │    ▼                                     │
                             │  [7] NotificationAgent                   │
                             │   Discord webhook + Gmail SMTP           │
                             │    │                                     │
                             │    ▼                                     │
                             │   END → WebSocket broadcast              │
                             └──────────────────────────────────────────┘

  External Services
  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
  │  Groq Cloud   │  │   Discord     │  │  Gmail SMTP   │
  │  LLaMA3 LLM   │  │   Webhook     │  │   aiosmtplib  │
  └───────────────┘  └───────────────┘  └───────────────┘
```

---

## 🤖 AI Agent Pipeline

Each ticket submission triggers an **async LangGraph StateGraph** with 7 agents. The state is passed forward, with each agent adding its outputs.

### Agent Details

| # | Agent | Model | Role | Output Fields |
|---|---|---|---|---|
| 1 | **IntakeAgent** | llama-3.1-8b-instant | Classifies ticket, detects urgency keywords | `category`, `subcategory`, `detected_keywords`, `urgency_level`, `business_impact` |
| 2 | **VIPAgent** | None (rule-based) | Detects VIP status from DB + role/dept scoring | `vip_detected`, `vip_level`, `vip_confidence`, `vip_score_breakdown` |
| 3 | **PriorityAgent** | llama-3.3-70b-versatile | Weighted 0-100 priority score | `priority_score`, `priority_label`, `priority_factors` |
| 4 | **RoutingAgent** | llama-3.3-70b-versatile | Assigns support team | `assigned_team`, `routing_reason` |
| 5 | **SLAAgent** | llama-3.3-70b-versatile | SLA breach risk prediction | `sla_risk_score`, `sla_risk_level`, `sla_deadline_hours` |
| 6 | **ExplainabilityAgent** | llama-3.3-70b-versatile | Human-readable reasoning | `ai_reasoning[]`, `full_explanation` |
| 7 | **NotificationAgent** | None | Sends Discord + email alerts | `discord_sent`, `email_sent` |

### Priority Scoring Formula

```
priority_score = VIP_contribution (vip_confidence × 0.35)   [max 35 pts]
               + severity_score   (critical=30, high=20, medium=10, low=5)
               + keyword_score    (len(keywords) × 5, max 20)
               + business_hours   (IST 9am-6pm: +10, else: +5)
               + category_score   (security/network=15, payroll=12, other=5)

Label: 0-30 = LOW  |  31-60 = MEDIUM  |  61-80 = HIGH  |  81-100 = CRITICAL
```

### SLA Deadlines

| Priority | Standard | VIP (0.5× multiplier) |
|---|---|---|
| CRITICAL | 2 hours | 1 hour |
| HIGH | 4 hours | 2 hours |
| MEDIUM | 8 hours | 4 hours |
| LOW | 24 hours | 12 hours |

### Fast-Track Condition

When a ticket is **CRITICAL** AND **VIP detected**, the pipeline skips agents 4-6 and fires notification immediately for the fastest possible alert delivery.

---

## 🗄 Data Models

### Ticket

```
ticket_id          T-XXXXXXXX (unique)     employee_id        string
employee_name      string                  role               string
department         string                  issue_title        string
issue_description  string                  severity           low|medium|high|critical
category           string (AI)             subcategory        string (AI)
priority           low|medium|high|critical  priority_score   float 0-100
vip_detected       bool                    vip_level          standard|silver|gold|platinum
vip_confidence     float 0-100             urgency_level      string
business_impact    string                  assigned_team      string
sla_risk_score     float 0-100             sla_deadline       datetime UTC
ai_reasoning       string[]                status             open|in_progress|resolved|escalated|sla_breached
created_at         datetime UTC            created_by         user_id
is_deleted         bool                    deleted_at         datetime
deleted_by         user_id
```

### VIP Employee

```
employee_id        string (unique)     name               string
email              string (unique)     role               string
department         string              vip_level          standard|silver|gold|platinum
vip_score_override float|null (0-100)  is_active          bool
```

### User

```
user_id            UUID                username           string
email              string (unique)     role               admin|manager|support_agent|viewer
is_active          bool                must_change_credentials  bool
is_first_login     bool
```

---

## 📡 API Reference

### Auth (`/api/v1/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | No | Login, returns JWT tokens |
| POST | `/register` | No | Create account |
| POST | `/refresh` | Refresh token | Rotate tokens |
| POST | `/logout` | Bearer | Revoke tokens |
| PUT | `/change-initial-credentials` | Bearer | First-login setup |

### Tickets (`/api/v1/tickets`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Bearer | Create ticket (202 Accepted, AI async) |
| GET | `/` | Bearer | List tickets (paginated, filtered) |
| GET | `/{ticket_id}` | Bearer | Get single ticket |
| PATCH | `/{ticket_id}` | Bearer | Update status/assignment |
| DELETE | `/{ticket_id}` | Bearer | Soft delete |
| GET | `/{ticket_id}/reasoning` | Bearer | Get AI explainability |
| WS | `/ws/tickets?token=` | JWT | Real-time events |
| POST | `/import/excel` | Bearer | Bulk import from .xlsx/.csv |
| POST | `/import/pdf` | Bearer | AI extraction from PDF/image |
| POST | `/import/pdf/confirm` | Bearer | Confirm previewed PDF import |
| GET | `/template` | Bearer | Download sample Excel template |

### Dashboard (`/api/v1/dashboard`)
| Method | Endpoint | Cache | Description |
|---|---|---|---|
| GET | `/stats` | 60s | KPI metrics |
| GET | `/charts/priority-distribution` | 300s | Priority breakdown |
| GET | `/charts/department-issues` | 300s | Issues by dept |
| GET | `/charts/escalation-trends` | 300s | 7-day trends |
| GET | `/charts/category-breakdown` | 300s | Category stats |
| GET | `/live-tickets` | None | Top 20 open by priority |
| POST | `/export` | None | CSV/HTML export (Manager+) |

### VIP Management (`/api/v1/vip`)
| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| GET | `/employees` | Admin/Manager | List VIP employees |
| POST | `/employees` | Admin/Manager | Add VIP employee |
| PATCH | `/employees/{id}` | Admin/Manager | Update employee |
| DELETE | `/employees/{id}` | Admin/Manager | Remove employee |

---

## 🔐 Role-Based Access Control

| Permission | Admin | Manager | Support Agent | Viewer |
|---|:---:|:---:|:---:|:---:|
| View all tickets | ✅ | ✅ | Own only | Own only |
| Create tickets | ✅ | ✅ | ✅ | ❌ |
| Update any ticket | ✅ | ✅ | Own only | ❌ |
| Delete any ticket | ✅ | ✅ | Own only | ❌ |
| Dashboard stats | ✅ | ✅ | ✅ | ✅ |
| Export tickets | ✅ | ✅ | ❌ | ❌ |
| VIP employee CRUD | ✅ | ✅ | ❌ | ❌ |
| View admin panel | ✅ | ✅ | ❌ | ❌ |

---

## ⚙️ Setup Instructions

### Prerequisites

| Tool | Minimum Version | Check |
|---|---|---|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Redis | 6+ | `redis-server --version` |
| MongoDB | Atlas or local 6+ | — |

### 1. Clone the Repository

```bash
git clone <repository-url>
cd vip-ticket-agent-project
```

### 2. Backend Setup

```bash
cd vipulse-backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Backend Environment Variables

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](#-environment-variables) below).

At minimum, you **must** set:
- `MONGODB_URL` — your MongoDB Atlas connection string or local URI
- `GROQ_API_KEY` — get a free key from [console.groq.com](https://console.groq.com)
- `SECRET_KEY` — generate a secure random string (32+ characters)

### 4. Frontend Setup

```bash
cd ../vipulse-frontend

# Install dependencies
npm install
```

### 5. Frontend Environment Variables

```bash
# Create .env.local
echo "VITE_API_URL=http://localhost:8000" > .env.local
```

If your backend runs on a different port, update `VITE_API_URL` accordingly.

### 6. Redis Setup

**Local Redis (recommended for development):**

```bash
# Windows (via WSL or Docker)
docker run -d -p 6379:6379 redis:7-alpine

# macOS
brew install redis && brew services start redis

# Ubuntu/Debian
sudo apt install redis-server && sudo systemctl start redis
```

**Redis Cloud (optional):** Set `REDIS_URL` in `.env` to your cloud Redis URL.

---

## 🚀 Run Instructions

### Start the Backend

```bash
cd vipulse-backend

# Activate virtual environment first
venv\Scripts\activate       # Windows
source venv/bin/activate    # macOS/Linux

# Start with auto-reload (development)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production (no reload, multiple workers)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Backend starts at: `http://localhost:8000`  
Swagger docs: `http://localhost:8000/docs`  
Redoc: `http://localhost:8000/redoc`

### Start the Frontend

```bash
cd vipulse-frontend

# Development server
npm run dev

# Production build
npm run build
npm run preview
```

Frontend starts at: `http://localhost:5173`

### Verify Everything is Working

```bash
# Backend health check
curl http://localhost:8000/health

# Expected: {"status":"ok","version":"1.0.0","env":"development"}

# Readiness check (MongoDB + Redis)
curl http://localhost:8000/ready

# Expected: {"status":"ready","checks":{"mongodb":"ok","redis":"ok"}}
```

### Using Docker (optional)

```bash
cd vipulse-backend

# Build and start backend + Redis
docker compose up --build

# Backend will be available at http://localhost:8000
```

---

## 🔑 Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `ENVIRONMENT` | No | `development` | App environment (`development` / `production`) |
| `SECRET_KEY` | **Yes** | — | JWT signing key (32+ chars, keep secret) |
| `MONGODB_URL` | **Yes** | — | MongoDB connection string (Atlas or local) |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection URL |
| `GROQ_API_KEY` | **Yes** | — | Groq API key for LLaMA3 inference |
| `GROQ_MODEL` | No | `llama3-70b-8192` | Default Groq model for PDF extraction |
| `DISCORD_WEBHOOK_URL` | No | `""` | Discord webhook for ticket alerts |
| `GMAIL_USER` | No | `""` | Gmail address for email notifications |
| `GMAIL_APP_PASSWORD` | No | `""` | Gmail App Password (not regular password) |
| `DASHBOARD_URL` | No | `http://localhost:3000` | Frontend URL used in email links |
| `TEAM_EMAIL_MAP` | No | `""` | `"Team Name:email@co.com,Team2:..."` |
| `SENTRY_DSN` | No | `""` | Sentry DSN for error tracking |

### Frontend (`.env.local`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `VITE_API_URL` | No | `http://localhost:8000` | Backend API base URL |

---

## 📁 Project Structure

```
vip-ticket-agent-project/
├── vipulse-backend/
│   ├── main.py                         # FastAPI app entry point
│   ├── requirements.txt                # Python dependencies
│   ├── .env / .env.example             # Environment config
│   └── app/
│       ├── agents/                     # AI pipeline agents
│       │   ├── base_agent.py           # BaseAgent with LLM helper
│       │   ├── intake_agent.py         # Ticket classification
│       │   ├── vip_agent.py            # VIP detection (rule-based)
│       │   ├── priority_agent.py       # Priority scoring
│       │   ├── routing_agent.py        # Team assignment
│       │   ├── sla_agent.py            # SLA risk prediction
│       │   ├── explainability_agent.py # Reasoning generation
│       │   └── notification_agent.py   # Discord + email alerts
│       ├── api/v1/
│       │   ├── dependencies.py         # Auth + role guards
│       │   ├── ws_manager.py           # WebSocket + Redis pub/sub
│       │   └── routes/
│       │       ├── auth.py             # Login, register, refresh
│       │       ├── tickets.py          # Ticket CRUD + WebSocket
│       │       ├── imports.py          # Excel/PDF import endpoints
│       │       ├── vip.py              # VIP employee management
│       │       ├── dashboard.py        # Stats + charts
│       │       └── analytics.py        # Team workload analytics
│       ├── core/
│       │   ├── config.py               # Pydantic settings
│       │   ├── database.py             # Beanie + Motor init
│       │   ├── redis_client.py         # Redis init + helpers
│       │   ├── security.py             # JWT + bcrypt + token store
│       │   └── seeder.py               # Default user seeding
│       ├── models/
│       │   ├── ticket.py               # Ticket document model
│       │   ├── employee.py             # VIP employee model
│       │   └── user.py                 # User document model
│       ├── orchestrator/
│       │   ├── graph.py                # LangGraph StateGraph
│       │   └── state.py                # AgentState TypedDict
│       ├── schemas/
│       │   ├── ticket_schemas.py       # Request/response models
│       │   └── auth_schemas.py         # Auth request models
│       ├── services/
│       │   ├── ticket_service.py       # Ticket business logic + Redis cache
│       │   ├── import_service.py       # Excel/PDF import logic
│       │   └── notification_service.py # Discord + email sending
│       └── utils/
│           ├── response.py             # Standard API envelope
│           └── exceptions.py           # HTTP exception classes
│
└── vipulse-frontend/
    ├── src/
    │   ├── api/
    │   │   ├── client.ts               # Axios + JWT interceptor + refresh queue
    │   │   ├── tickets.ts              # Ticket API calls
    │   │   ├── imports.ts              # Import API calls
    │   │   ├── dashboard.ts            # Dashboard API calls
    │   │   └── auth.ts                 # Auth API calls
    │   ├── components/
    │   │   ├── dashboard/              # KPI cards, charts, live feed
    │   │   ├── import/                 # ExcelUpload, PdfUpload
    │   │   ├── layout/                 # Sidebar, Header, PageWrapper
    │   │   ├── tickets/                # TicketTable, AIDecisionPanel
    │   │   └── ui/                     # Button, Modal, Toast, Badge, etc.
    │   ├── hooks/
    │   │   ├── useAuth.ts              # Auth computed flags
    │   │   └── useWebSocket.ts         # WS with retry + ping keepalive
    │   ├── pages/
    │   │   ├── Login.tsx               # Dark split-screen auth
    │   │   ├── Register.tsx            # Account creation
    │   │   ├── SetupAccount.tsx        # First-login credential change
    │   │   ├── Dashboard.tsx           # Main analytics dashboard
    │   │   ├── Tickets.tsx             # Paginated ticket list
    │   │   ├── TicketDetail.tsx        # Single ticket view
    │   │   ├── AIDecision.tsx          # AI explainability view
    │   │   ├── SubmitTicket.tsx        # 3-tab submit (Manual/Excel/PDF)
    │   │   ├── Analytics.tsx           # Deep analytics
    │   │   └── AdminPanel.tsx          # VIP employee management
    │   ├── store/
    │   │   ├── authStore.ts            # Zustand auth + localStorage
    │   │   └── ticketStore.ts          # Recently created ticket
    │   ├── types/
    │   │   ├── ticket.ts               # Ticket/filter/pagination types
    │   │   ├── dashboard.ts            # Dashboard API types
    │   │   └── auth.ts                 # User/token types
    │   └── utils/
    │       ├── constants.ts            # Dark-mode chip classes
    │       ├── formatters.ts           # Date, SLA color, priority
    │       └── cn.ts                   # clsx + tailwind-merge
    ├── tailwind.config.ts              # Dark design tokens
    └── index.css                       # Design system + component layer
```

---

## 💡 Assumptions

1. **Groq API availability** — the AI pipeline requires an active Groq API key. Without it, agents fall back gracefully to deterministic scoring (no LLM) but the priority labels may be less accurate.

2. **MongoDB Atlas connectivity** — the application targets MongoDB Atlas by default. The `pymongo==4.5.0` version is pinned specifically for compatibility with Motor 3.3.2 (pymongo 4.6+ removed `_QUERY_OPTIONS` which motor requires).

3. **Redis is required** — even in development, Redis must be running for WebSocket pub/sub and token blocklisting. Dashboard stats will fail without Redis.

4. **Single-session token design** — only one refresh token is valid per user at a time (stored in Redis). Logging in from a second device invalidates the first session's refresh token.

5. **VIP detection without DB record** — if an employee is not in the VIP registry, the system falls back to role + department scoring. C-suite roles (CEO, CTO, CFO) automatically score above the VIP threshold regardless of DB records.

6. **Excel import column aliases** — the import accepts 20+ column name variants (e.g. `emp_id`, `empid`, `id`, `employee id` all map to `employee_id`). The column alias table in `import_service.py` covers the most common variations but cannot anticipate every possible naming convention.

7. **PDF extraction quality** — AI extraction accuracy depends on document clarity. Scanned PDFs require OCR (pytesseract, not installed by default). Text-based PDFs work reliably. Image quality below ~200 DPI may produce partial extractions.

8. **Email notifications** — uses Gmail SMTP with App Password. Standard Gmail accounts may block App Password sign-in if 2FA is not enabled. A dedicated service account is recommended for production.

9. **Timezone handling** — all timestamps are stored as UTC in MongoDB. The frontend formats them using the browser's local timezone via `date-fns`.

10. **First-login flow** — the seeded admin account (`admin@vipulse.ai`) has `must_change_credentials: true` by default. The `/setup-account` page is enforced before any protected route can be accessed.

---

## ⚠️ Limitations

### AI Pipeline

- **LLM response time** — Groq inference typically adds 1-3 seconds per agent. The full pipeline (6 LLM agents + 1 rule-based) takes 4-10 seconds. Tickets appear in the UI immediately (202 response) but AI fields populate asynchronously.

- **LLM JSON parse failures** — occasionally LLMs produce malformed JSON. Every agent has a deterministic fallback that activates on parse error, so no ticket is ever left without scores.

- **Context window limits** — PDF text is truncated to 8,000 characters before sending to the extraction LLM. Very long documents (technical manuals, lengthy incident reports) may have later sections ignored.

- **Multi-issue PDF detection** — the LLM may sometimes combine multiple distinct issues into a single ticket if they appear related. Maximum 20 tickets can be extracted per PDF.

- **No persistent LangGraph state** — the `InMemorySaver` checkpointer is used. Graph state is not persisted across application restarts. This is fine for stateless ticket processing but means no workflow resumption after a crash.

### Infrastructure

- **No OCR out of the box** — scanned PDF support requires `pytesseract` + `Pillow` + a Tesseract binary installation, which are not included in `requirements.txt`. Install separately if needed.

- **Single Redis instance** — no Redis Cluster or Sentinel support. Redis failure causes WebSocket broadcasts and dashboard caching to degrade (not crash — errors are caught and logged).

- **In-process background tasks** — ticket AI pipelines run as `asyncio.create_task()` within the FastAPI process. Under very high load (hundreds of concurrent imports), these tasks compete with request handling. A dedicated task queue (Celery + Redis) would be the production upgrade.

- **No file storage** — uploaded Excel/PDF files are processed in memory and not persisted. If you need audit trails of imported files, add an S3/R2 upload step.

### Frontend

- **Chart.js bundle size** — the production bundle is ~700KB (gzipped: ~210KB). Chart.js accounts for most of this. Lazy-loading chart components would reduce the initial load.

- **React Query v3** — the project uses v3 (not v4/v5). The query key system and `keepPreviousData` API differ from newer versions. A migration to v5 would require updating all query hook signatures.

- **No offline support** — the application requires live API connectivity. No service worker or offline caching is implemented.

- **WebSocket reconnection cap** — the `useWebSocket` hook retries with exponential backoff up to 5 attempts. After 5 failures, the connection is abandoned and live updates stop (requires page refresh).

### Security

- **Demo credentials in UI** — the login page includes a "Try demo credentials" button that auto-fills `admin@vipulse.ai / admin123` for convenience. Remove this for any public-facing deployment.

- **CORS origins** — the default `CORS_ORIGINS` allows `localhost:3000` and `localhost:5173`. Set this to your actual domain in production via the `CORS_ORIGINS` environment variable.

- **No rate limiting** — there is no request rate limiting on the API. Add `slowapi` or a reverse proxy (nginx, Cloudflare) rate-limiting layer before going public.

---

## 🔑 Demo Credentials

The database is seeded automatically on first startup with these accounts:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@vipulse.ai` | `admin123` |
| **Manager** | `manager@vipulse.ai` | `manager123` |
| **Support Agent** | `support@vipulse.ai` | `support123` |
| **Viewer** | `viewer@vipulse.ai` | `viewer123` |

> **Note:** On first login, the admin account prompts a credential change via the `/setup-account` page. You can skip this in development by checking `must_change_credentials: false` in the database, or simply complete the setup flow once.

---

## 🧪 Quick Smoke Test

After starting both services:

```bash
# 1. Login
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vipulse.ai","password":"admin123"}' | python -m json.tool

# 2. Create a ticket (replace TOKEN with access_token from step 1)
curl -s -X POST http://localhost:8000/api/v1/tickets/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP-001",
    "employee_name": "Alice CEO",
    "role": "CEO",
    "department": "Executive",
    "issue_title": "Cannot access production dashboard",
    "issue_description": "The main production monitoring dashboard has been down since 9am. Multiple teams are blocked and this is a critical business issue affecting all operations.",
    "severity": "critical"
  }' | python -m json.tool

# 3. Dashboard stats
curl -s http://localhost:8000/api/v1/dashboard/stats \
  -H "Authorization: Bearer TOKEN" | python -m json.tool
```

---

<div align="center">

Built with ❤️ using FastAPI · LangGraph · React · MongoDB · Redis · Groq

</div>
