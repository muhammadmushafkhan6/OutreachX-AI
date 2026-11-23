import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.database import get_db
from app.models.ai_analysis import AIAnalysis
from app.models.map_lead import MapLead
from app.models.user import User
from app.repositories.job_repository import JobRepository
from app.schemas.extracted import AIAnalysisResponse, ExtractedDataResponse
from app.schemas.job import DashboardStats, JobCreateSingle, JobResponse
from app.schemas.maps import MapLeadResponse, SocialMediaLeadResponse
from app.services.job_service import JobService
from app.config import get_settings

router = APIRouter(tags=["jobs"])
settings = get_settings()


async def _run_single_async(job_id: uuid.UUID, url: str):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        service = JobService(db)
        await service.process_single_url(job_id, url)
        await db.commit()


async def _run_bulk_async(job_id: uuid.UUID, urls: list[str]):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        service = JobService(db)
        await service.process_bulk(job_id, urls)
        await db.commit()


async def _run_maps_async(job_id: uuid.UUID, query: str, location: str | None = None):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        service = JobService(db)
        await service.process_maps_search(job_id, query, location)
        await db.commit()


async def _run_social_async(job_id: uuid.UUID, query: str, location: str | None = None, platform: str = "instagram"):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        service = JobService(db)
        await service.process_social_media_search(job_id, query, location, platform)
        await db.commit()


async def _run_peaky_async(job_id: uuid.UUID, filters: dict | None = None):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        service = JobService(db)
        await service.process_peaky_search(job_id, filters)
        await db.commit()


async def _run_linkedin_async(job_id: uuid.UUID, filters: dict | None = None):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        service = JobService(db)
        await service.process_linkedin_search(job_id, filters)
        await db.commit()


def enqueue_single(job_id: uuid.UUID, data: JobCreateSingle, background_tasks: BackgroundTasks):
    if data.mode == "maps" or getattr(data, "job_type", None) == "maps_search" or (data.query and not data.url):
        background_tasks.add_task(_run_maps_async, job_id, data.query, data.location)
        return
    
    if data.mode == "social":
        platform = getattr(data, "platform", "instagram")
        background_tasks.add_task(_run_social_async, job_id, data.query, data.location, platform)
        return
    
    if data.mode == "peaky":
        filters = {k: v for k, v in data.model_dump().items() if k not in ["url", "query", "location", "mode"]}
        background_tasks.add_task(_run_peaky_async, job_id, filters)
        return

    if data.mode == "linkedin":
        filters = {k: v for k, v in data.model_dump().items() if k not in ["url", "query", "location", "mode"]}
        background_tasks.add_task(_run_linkedin_async, job_id, filters)
        return


    url = data.url
    if settings.sync_jobs:
        background_tasks.add_task(_run_single_async, job_id, url)
        return
    try:
        from app.tasks.scrape_tasks import process_single_job

        if process_single_job:
            process_single_job.delay(str(job_id), url)
            return
    except Exception:
        pass
    background_tasks.add_task(_run_single_async, job_id, url)


def enqueue_bulk(job_id: uuid.UUID, urls: list[str], background_tasks: BackgroundTasks):
    if settings.sync_jobs:
        background_tasks.add_task(_run_bulk_async, job_id, urls)
        return
    try:
        from app.tasks.scrape_tasks import process_bulk_job

        if process_bulk_job:
            process_bulk_job.delay(str(job_id), urls)
            return
    except Exception:
        pass
    background_tasks.add_task(_run_bulk_async, job_id, urls)


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    jobs = await repo.list_by_user(user.id)
    return [JobResponse.model_validate(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    job = await repo.get_by_id(job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


@router.post("/jobs/single", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_single_job(
    data: JobCreateSingle,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    
    # Auto-detect mode if not specified
    mode = data.mode
    if not mode or mode == "website":
        if data.url and not data.url.startswith(("http", "www")):
             mode = "maps"
             data.query = data.url
             data.url = None
        else:
             mode = "website"

    if mode in ("social", "linkedin", "maps") and not (data.query or "").strip():
        raise HTTPException(status_code=400, detail="Search query is required for this mode")

    meta = {
        "enrich_contacts": getattr(data, "enrich_contacts", False),
        "use_vortex_actor": getattr(data, "use_vortex_actor", False),
    }

    job = await repo.create(
        user_id=user.id,
        job_type="single",
        mode=mode,
        url=data.url,
        query=data.query,
        location=data.location,
        platform=getattr(data, "platform", None),
        meta=meta,
    )
    await db.commit()
    enqueue_single(job.id, data, background_tasks)
    return JobResponse.model_validate(job)


@router.post("/jobs/bulk", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_bulk_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file with a 'url' column")

    content = await file.read()
    urls = JobService.parse_csv_urls(content)
    if not urls:
        raise HTTPException(status_code=400, detail="No valid URLs found in CSV")

    repo = JobRepository(db)
    job = await repo.create(user_id=user.id, job_type="bulk", total_urls=len(urls))
    await db.commit()
    enqueue_bulk(job.id, urls, background_tasks)
    return JobResponse.model_validate(job)


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    stats = await repo.get_dashboard_stats(user.id)
    return DashboardStats(**stats)


@router.get("/jobs/{job_id}/extracted", response_model=ExtractedDataResponse)
async def get_extracted(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    job = await repo.get_by_id(job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    extracted = await repo.get_latest_extracted(job_id)
    if not extracted:
        raise HTTPException(status_code=404, detail="No extracted data yet")
    return ExtractedDataResponse.model_validate(extracted)


@router.get("/jobs/{job_id}/ai-analysis", response_model=AIAnalysisResponse)
async def get_ai_analysis(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    job = await repo.get_by_id(job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.job_id == job_id).order_by(AIAnalysis.created_at.desc()).limit(1)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="AI analysis not ready yet")
    return AIAnalysisResponse.model_validate(analysis)


@router.get("/jobs/{job_id}/leads")
async def get_job_leads(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    job = await repo.get_by_id(job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.mode == "social":
        from app.models.social_media_lead import SocialMediaLead
        result = await db.execute(
            select(SocialMediaLead).where(SocialMediaLead.job_id == job_id).order_by(SocialMediaLead.created_at.desc())
        )
        leads = result.scalars().all()
        return [
            {
                "id": str(l.id),
                "job_id": str(l.job_id),
                "platform": l.platform,
                "username": l.username,
                "full_name": l.full_name,
                "bio": l.bio,
                "followers_count": l.followers_count,
                "following_count": l.following_count,
                "posts_count": l.posts_count,
                "website": l.website,
                "email": l.email,
                "phone": l.phone,
                "profile_url": l.profile_url,
                "profile_pic_url": l.profile_pic_url,
                "lead_score": l.lead_score or "Medium",
                "recommended_service": l.recommended_service,
                "ai_summary": l.ai_summary,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in leads
        ]
    
    if job.mode == "peaky":
        from app.models.peaky_lead import PeakyLead
        from app.schemas.maps import PeakyLeadResponse
        result = await db.execute(
            select(PeakyLead).where(PeakyLead.job_id == job_id).order_by(PeakyLead.created_at.desc())
        )
        leads = result.scalars().all()
        return [PeakyLeadResponse.model_validate(l).model_dump() for l in leads]

    if job.mode == "linkedin":
        from app.models.linkedin_lead import LinkedInLead
        from app.schemas.maps import LinkedInLeadResponse
        result = await db.execute(
            select(LinkedInLead).where(LinkedInLead.job_id == job_id).order_by(LinkedInLead.created_at.desc())
        )
        leads = result.scalars().all()
        return [LinkedInLeadResponse.model_validate(l).model_dump() for l in leads]

    from app.models.map_lead import MapLead
    result = await db.execute(
        select(MapLead).where(MapLead.job_id == job_id).order_by(MapLead.created_at.desc())
    )
    leads = result.scalars().all()
    out = []
    for l in leads:
        out.append({
            "id": str(l.id),
            "job_id": str(l.job_id),
            "business_name": l.business_name or "Unknown",
            "category": l.category,
            "phone": l.phone,
            "address": l.address,
            "website": l.website,
            "email": l.email,
            "rating": float(l.rating) if l.rating is not None else None,
            "reviews": int(l.reviews) if l.reviews is not None else None,
            "opening_hours": l.opening_hours,
            "maps_url": l.maps_url,
            "place_id": getattr(l, "place_id", None),
            "lat": float(l.lat) if getattr(l, "lat", None) is not None else None,
            "lng": float(l.lng) if getattr(l, "lng", None) is not None else None,
            "emails": l.emails if isinstance(getattr(l, "emails", None), list) else ([l.email] if l.email else []),
            "extra_phones": getattr(l, "extra_phones", None),
            "whatsapp": getattr(l, "whatsapp", None) or l.phone,
            "social_links": getattr(l, "social_links", None),
            "lead_score": l.lead_score or "Medium",
            "recommended_service": l.recommended_service,
            "ai_summary": l.ai_summary,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })
    return out
