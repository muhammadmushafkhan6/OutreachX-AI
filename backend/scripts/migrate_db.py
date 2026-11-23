import asyncio
import logging
import sys
import os
from pathlib import Path

# Add backend directory to sys.path to allow absolute imports
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from sqlalchemy import text
from app.database import engine, Base
from app.models import Job, MapLead, SocialMediaLead

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def update_db():
    # 1. Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 2. Add missing columns one by one in separate transactions
    columns_to_add = [
        ("mode", "VARCHAR(20) DEFAULT 'website'"),
        ("query", "VARCHAR(512)"),
        ("location", "VARCHAR(255)"),
    ]
    
    for col_name, col_type in columns_to_add:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type}"))
                logger.info(f"Added '{col_name}' column to 'jobs' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info(f"'{col_name}' column already exists.")
                else:
                    logger.warning(f"Could not add '{col_name}' column: {e}")

    # 2.1 Add email to map_leads
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE map_leads ADD COLUMN email VARCHAR(255)"))
            logger.info("Added 'email' column to 'map_leads' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("'email' column already exists in map_leads.")
            else:
                logger.warning(f"Could not add 'email' column to map_leads: {e}")

    # 3. Modify existing columns
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE jobs ALTER COLUMN status TYPE VARCHAR(100)"))
            logger.info("Increased 'status' column length to 100.")
        except Exception as e:
            logger.warning(f"Could not increase 'status' column length: {e}")

    # 4. Add instagram_username to users table
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN instagram_username VARCHAR(100)"))
            logger.info("Added 'instagram_username' column to 'users' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("'instagram_username' column already exists.")
            else:
                logger.warning(f"Could not add 'instagram_username' column: {e}")

if __name__ == "__main__":
    asyncio.run(update_db())
