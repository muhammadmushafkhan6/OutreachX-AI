import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, AILeadFinderJob
from app.schemas import (
    AILeadFinderFilters,
    AILeadFinderLeadResponse,
    AILeadFinderJobResponse,
    StartAILeadFinderRequest,
    StartAILeadFinderResponse,
    PaginatedAILeadFinderLeadsResponse,
)
from app.services.ai_lead_finder_service import AILeadFinderService

router = APIRouter(prefix="/api/v1/ai-lead-finder", tags=["AI Lead Finder"])


def _job_to_response(job: AILeadFinderJob) -> AILeadFinderJobResponse:
    import json
    return AILeadFinderJobResponse(
        id=job.id,
        user_id=job.user_id,
        status=job.status,
        progress=job.progress,
        apify_run_id=job.apify_run_id,
        filters=json.loads(job.filters) if job.filters else None,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _lead_to_response(lead) -> AILeadFinderLeadResponse:
    return AILeadFinderLeadResponse(
        id=lead.id,
        job_id=lead.job_id,
        company_name=lead.company_name,
        company_website=lead.company_website,
        industry=lead.industry,
        company_size=lead.company_size,
        revenue=lead.revenue,
        funding=lead.funding,
        contact_name=lead.contact_name,
        job_title=lead.job_title,
        business_email=lead.business_email,
        personal_email=lead.personal_email,
        phone_number=lead.phone_number,
        linkedin_url=lead.linkedin_url,
        location=lead.location,
        country=lead.country,
        lead_score=lead.lead_score,
        ai_business_summary=lead.ai_business_summary,
        ai_cold_email=lead.ai_cold_email,
        ai_whatsapp_message=lead.ai_whatsapp_message,
        ai_voice_script=lead.ai_voice_script,
        created_at=lead.created_at,
    )


async def run_job_background(job_id: uuid.UUID, db: AsyncSession):
    async with db.begin():
        service = AILeadFinderService(db)
        await service.run_job(str(job_id))


@router.post("/jobs", response_model=StartAILeadFinderResponse)
async def start_lead_finder_job(
    request: StartAILeadFinderRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AILeadFinderService(db)
    job = await service.start_job(str(current_user.id), request.filters.model_dump())
    
    # Run job in background
    background_tasks.add_task(run_job_background, job.id, db)
    
    return StartAILeadFinderResponse(
        job_id=job.id,
        message="Lead Finder job started successfully"
    )


@router.get("/jobs", response_model=List[AILeadFinderJobResponse])
async def get_user_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AILeadFinderJob).where(
        AILeadFinderJob.user_id == current_user.id
    ).order_by(desc(AILeadFinderJob.created_at))
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return [_job_to_response(job) for job in jobs]


@router.get("/jobs/{job_id}", response_model=AILeadFinderJobResponse)
async def get_job(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AILeadFinderJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.get("/jobs/{job_id}/leads", response_model=PaginatedAILeadFinderLeadsResponse)
async def get_job_leads(
    job_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AILeadFinderJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    service = AILeadFinderService(db)
    leads, total = await service.get_job_leads(str(job_id), page, page_size)
    
    return PaginatedAILeadFinderLeadsResponse(
        leads=[_lead_to_response(lead) for lead in leads],
        total=total,
        page=page,
        page_size=page_size,
    )
