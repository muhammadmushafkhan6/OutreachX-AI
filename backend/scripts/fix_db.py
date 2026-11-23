import asyncio
import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def add_column_async(conn, table: str, column: str, definition: str):
    try:
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
        await conn.commit()
        logger.info("Added '%s' column to '%s'", column, table)
    except Exception as e:
        await conn.rollback()
        msg = str(e).lower()
        if "already exists" in msg or "duplicate column" in msg:
            logger.info("'%s' already exists in '%s'", column, table)
        else:
            logger.error("Error adding '%s' to '%s': %s", column, table, e)


async def fix_columns():
    async with engine.connect() as conn:
        # ---------- jobs table ----------
        await add_column_async(conn, "jobs", "platform", "VARCHAR(50)")
        await add_column_async(conn, "jobs", "meta", "JSON")
        await add_column_async(conn, "jobs", "location", "VARCHAR(255)")

        # ---------- map_leads table ----------
        map_new_cols = [
            ("place_id", "VARCHAR(255)"),
            ("lat", "DOUBLE PRECISION"),
            ("lng", "DOUBLE PRECISION"),
            ("emails", "JSON"),
            ("extra_phones", "JSON"),
            ("whatsapp", "VARCHAR(50)"),
            ("social_links", "JSON"),
            ("email_sent", "BOOLEAN DEFAULT FALSE"),
            ("email_sent_at", "TIMESTAMP WITH TIME ZONE"),
            ("whatsapp_sent", "BOOLEAN DEFAULT FALSE"),
            ("whatsapp_sent_at", "TIMESTAMP WITH TIME ZONE"),
        ]
        for col, defn in map_new_cols:
            await add_column_async(conn, "map_leads", col, defn)

        # ---------- NEW email tables (auto created by create_all, but manual index) ----------
        for table in ["email_templates", "email_campaigns", "sent_emails"]:
            try:
                await conn.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS {table} (id UUID PRIMARY KEY)
                """))
                await conn.commit()
            except Exception:
                await conn.rollback()

        logger.info("\nColumn migration complete. Starting full create_all check...")

    async with engine.begin() as conn:
        from app.database import Base
        from app.models import (  # noqa: F401 – ensure all models are registered
            User, Job, Website, ExtractedData, AIAnalysis,
            MapLead, SocialMediaLead, PeakyLead, LinkedInLead,
            Export, Log, InstagramAccount,
            AILeadFinderJob, AILeadFinderLead,
            EmailTemplate, EmailCampaign, SentEmail,
        )
        await conn.run_sync(Base.metadata.create_all)

    logger.info("ALL DONE — schema up to date.")


if __name__ == "__main__":
    asyncio.run(fix_columns())
