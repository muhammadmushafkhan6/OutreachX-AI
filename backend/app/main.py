import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# Playwright on Windows needs Proactor loop (uvicorn --reload can break this)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, exports, jobs, websocket, outreach, users, instagram, ai_lead_finder, voice_agent

settings = get_settings()
logging.basicConfig(level=logging.INFO if settings.debug else logging.WARNING)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "PostgreSQL: %s@%s:%s/%s",
        settings.postgres_user,
        settings.postgres_host,
        settings.postgres_port,
        settings.postgres_db,
    )
    async with engine.begin() as conn:
        # ── One-time migration: drop linkedin_leads if columns are missing ──
        # create_all never alters existing tables, so if the table was created
        # with a different schema we must drop and let it be recreated.
        try:
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'linkedin_leads' AND column_name = 'first_name'"
            ))
            row = result.fetchone()
            if row is None:
                # Table exists but is missing the expected columns — drop it
                logger.warning(
                    "linkedin_leads table schema is outdated — dropping and recreating..."
                )
                await conn.execute(text("DROP TABLE IF EXISTS linkedin_leads CASCADE"))
        except Exception as mig_err:
            logger.warning("linkedin_leads migration check failed (safe to ignore): %s", mig_err)

        # ── Ensure map_leads has all new columns ──
        try:
            columns_to_add = [
                ("place_id", "VARCHAR(255)"),
                ("lat", "DOUBLE PRECISION"),
                ("lng", "DOUBLE PRECISION"),
                ("emails", "JSON"),
                ("extra_phones", "JSON"),
                ("whatsapp", "VARCHAR(50)"),
                ("social_links", "JSON"),
                ("email_sent", "BOOLEAN DEFAULT FALSE"),
                ("email_sent_at", "TIMESTAMPTZ"),
                ("whatsapp_sent", "BOOLEAN DEFAULT FALSE"),
                ("whatsapp_sent_at", "TIMESTAMPTZ"),
                ("source", "VARCHAR(100)"),
            ]
            for col_name, col_type in columns_to_add:
                await conn.execute(text(
                    f"ALTER TABLE map_leads ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
        except Exception as col_err:
            logger.warning("map_leads migration check (safe to ignore if table doesn't exist yet): %s", col_err)

        await conn.run_sync(Base.metadata.create_all)
    logger.info("Ready (PostgreSQL)")
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation error: %s", exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api/v1"

app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(jobs.router, prefix=api_prefix)
app.include_router(exports.router, prefix=api_prefix)
app.include_router(outreach.router, prefix=api_prefix)
app.include_router(instagram.router, prefix=api_prefix)
app.include_router(ai_lead_finder.router, prefix=api_prefix)
app.include_router(voice_agent.router, prefix=api_prefix)
app.include_router(websocket.router)


@app.get("/health")
@limiter.limit("60/minute")
async def health(request: Request):
    return {"status": "ok", "app": settings.app_name}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    response = JSONResponse(
        status_code=500,
        content={"detail": str(exc) if settings.debug else "Internal server error"},
    )
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response
