import asyncio
import sys
from pathlib import Path
import uuid

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.append(str(backend_dir))

from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.job import Job
from app.models.log import Log

async def check_job(job_id_str):
    async with AsyncSessionLocal() as db:
        try:
            job_id = uuid.UUID(job_id_str)
            result = await db.execute(
                select(Job).where(Job.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                print(f"Job {job_id_str} not found.")
                return
                
            print(f"--- Job {job_id_str} ---")
            print(f"Status: {job.status}")
            print(f"Progress: {job.progress}")
            print(f"Error: {job.error_message}")
            
            print("\n--- Job Logs ---")
            log_result = await db.execute(
                select(Log).where(Log.job_id == job_id).order_by(Log.created_at.asc())
            )
            for log in log_result.scalars().all():
                print(f"[{log.created_at}] {log.level.upper()}: {log.message}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        asyncio.run(check_job(sys.argv[1]))
    else:
        print("Please provide a job ID.")
