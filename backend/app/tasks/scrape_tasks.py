import asyncio
import uuid

from app.database import AsyncSessionLocal
from app.services.job_service import JobService

process_single_job = None
process_bulk_job = None


def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_tasks():
    from app.celery_app import celery_app

    if celery_app is None:
        return None, None

    @celery_app.task(name="process_single_job", bind=True, max_retries=2)
    def process_single_job_task(self, job_id: str, url: str):
        async def _run():
            async with AsyncSessionLocal() as db:
                service = JobService(db)
                await service.process_single_url(uuid.UUID(job_id), url)
                await db.commit()

        try:
            run_async(_run())
        except Exception as exc:
            raise self.retry(exc=exc, countdown=5)

    @celery_app.task(name="process_bulk_job", bind=True, max_retries=2)
    def process_bulk_job_task(self, job_id: str, urls: list[str]):
        async def _run():
            async with AsyncSessionLocal() as db:
                service = JobService(db)
                await service.process_bulk(uuid.UUID(job_id), urls)
                await db.commit()

        try:
            run_async(_run())
        except Exception as exc:
            raise self.retry(exc=exc, countdown=5)

    return process_single_job_task, process_bulk_job_task


process_single_job, process_bulk_job = _make_tasks()
