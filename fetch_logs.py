import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.append(str(backend_dir))

from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.log import Log

async def get_logs():
    async with AsyncSessionLocal() as db:
        try:
            # Get latest 20 logs
            result = await db.execute(
                select(Log).order_by(Log.created_at.desc()).limit(20)
            )
            logs = result.scalars().all()
            if not logs:
                print("No logs found in database.")
                return
                
            print(f"--- Latest {len(logs)} Logs ---")
            for log in reversed(logs):
                print(f"[{log.created_at}] {log.level.upper()}: {log.message}")
        except Exception as e:
            print(f"Error fetching logs: {e}")

if __name__ == "__main__":
    asyncio.run(get_logs())
