"""
VIPulse AI — FastAPI application entry point.
"""
import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.api.v1.routes import analytics, auth, dashboard, tickets, vip
from app.api.v1.ws_manager import manager as ws_manager
from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.redis_client import close_redis, init_redis
from app.models.employee import Employee
from app.models.ticket import Ticket
from app.models.user import User

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Sentry (only if DSN is configured and not a placeholder) ──────────────────
_sentry_dsn = settings.SENTRY_DSN or ""
if _sentry_dsn and "your-sentry" not in _sentry_dsn and _sentry_dsn != "":
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2 if settings.ENVIRONMENT == "production" else 1.0,
        send_default_pii=False,
    )
    logger.info("sentry_enabled")
else:
    logger.info("sentry_disabled (no valid DSN)")

# ── Lifespan ──────────────────────────────────────────────────────────────────
_ws_subscriber_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ws_subscriber_task

    logger.info(f"startup | env={settings.ENVIRONMENT}")

    # 1. MongoDB + Beanie
    await init_db(document_models=[Ticket, Employee, User])
    logger.info("mongodb_ready")

    # 2. Seed default users (idempotent — only runs on empty DB)
    from app.core.seeder import seed_users
    await seed_users()

    # 3. Redis
    await init_redis()
    logger.info("redis_ready")

    # 4. WebSocket Redis subscriber (background task)
    _ws_subscriber_task = asyncio.create_task(
        ws_manager.start_subscriber(),
        name="ws_redis_subscriber",
    )

    logger.info("startup_complete ── API ready at http://0.0.0.0:8000")
    logger.info("docs available at http://localhost:8000/docs")
    logger.info("login: admin@vipulse.ai / admin123")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    if _ws_subscriber_task and not _ws_subscriber_task.done():
        _ws_subscriber_task.cancel()
        try:
            await _ws_subscriber_task
        except asyncio.CancelledError:
            pass

    await close_db()
    await close_redis()
    logger.info("shutdown_complete")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "VIPulse AI — Intelligent VIP-aware IT helpdesk triage system.\n\n"
        "**Default login:** `admin@vipulse.ai` / `admin123`"
    ),
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging ───────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id

    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000, 2)

    logger.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} ({ms}ms) trace={trace_id}"
    )
    response.headers["X-Trace-ID"] = trace_id
    return response


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": str(exc.detail), "trace_id": trace_id},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Validation error",
            "details": exc.errors(),
            "trace_id": trace_id,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    logger.exception(f"Unhandled error [{trace_id}]: {exc}")
    if _sentry_dsn:
        sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error.", "trace_id": trace_id},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = settings.API_V1_PREFIX

app.include_router(auth.router,      prefix=PREFIX)
app.include_router(tickets.router,   prefix=PREFIX)
app.include_router(vip.router,       prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)


# ── Health probes ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Ops"])
async def health():
    """Liveness probe."""
    return {"status": "ok", "version": settings.VERSION, "env": settings.ENVIRONMENT}


@app.get("/ready", tags=["Ops"])
async def ready():
    """Readiness probe — checks MongoDB and Redis."""
    checks: dict[str, str] = {}

    try:
        from app.core.database import get_motor_client
        await get_motor_client().admin.command("ping")
        checks["mongodb"] = "ok"
    except Exception as exc:
        checks["mongodb"] = f"error: {exc}"

    try:
        from app.core.redis_client import get_redis
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "ready" if all_ok else "degraded", "checks": checks},
    )
