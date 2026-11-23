import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.database import get_db
from app.models.ai_analysis import AIAnalysis
from app.models.export import Export
from app.models.map_lead import MapLead
from app.models.social_media_lead import SocialMediaLead
from app.models.peaky_lead import PeakyLead
from app.models.user import User
from app.repositories.job_repository import JobRepository
from app.services.export_service import ExportService

router = APIRouter(tags=["exports"])


@router.get("/exports/{job_id}")
async def export_job(
    job_id: uuid.UUID,
    format: str = Query("json", alias="format", pattern="^(csv|xlsx|json)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = JobRepository(db)
    job = await repo.get_by_id(job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    service = ExportService()
    
    if job.mode == "maps":
        res = await db.execute(
            select(MapLead).where(MapLead.job_id == job_id).order_by(MapLead.created_at.desc())
        )
        leads = res.scalars().all()
        leads_dict = [
            {
                "business_name": l.business_name,
                "category": l.category,
                "phone": l.phone,
                "address": l.address,
                "website": l.website,
                "rating": l.rating,
                "reviews": l.reviews,
                "lead_score": l.lead_score,
                "recommended_service": l.recommended_service,
                "ai_summary": l.ai_summary,
            }
            for l in leads
        ]
        path = service.export(job_id, format, leads=leads_dict)
    elif job.mode == "social":
        res = await db.execute(
            select(SocialMediaLead).where(SocialMediaLead.job_id == job_id).order_by(SocialMediaLead.created_at.desc())
        )
        leads = res.scalars().all()
        leads_dict = [
            {
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
                "lead_score": l.lead_score,
                "recommended_service": l.recommended_service,
                "ai_summary": l.ai_summary,
            }
            for l in leads
        ]
        path = service.export(job_id, format, leads=leads_dict)
    elif job.mode == "peaky":
        res = await db.execute(
            select(PeakyLead).where(PeakyLead.job_id == job_id).order_by(PeakyLead.created_at.desc())
        )
        leads = res.scalars().all()
        leads_dict = [
            {
                "first_name": l.first_name,
                "last_name": l.last_name,
                "person_title": l.person_title,
                "seniority": l.seniority,
                "functional": l.functional,
                "person_country": l.person_country,
                "person_state": l.person_state,
                "company_name": l.company_name,
                "company_domain": l.company_domain,
                "company_employee_size": l.company_employee_size,
                "company_country": l.company_country,
                "company_state": l.company_state,
                "industry": l.industry,
                "revenue": l.revenue,
                "business_model": l.business_model,
                "work_email": l.work_email,
                "personal_email": l.personal_email,
                "phone": l.phone,
                "linkedin_url": l.linkedin_url,
                "company_linkedin_url": l.company_linkedin_url,
                "lead_score": l.lead_score,
                "recommended_service": l.recommended_service,
                "ai_summary": l.ai_summary,
            }
            for l in leads
        ]
        path = service.export(job_id, format, leads=leads_dict)
    elif job.mode == "linkedin":
        from app.models.linkedin_lead import LinkedInLead
        res = await db.execute(
            select(LinkedInLead).where(LinkedInLead.job_id == job_id).order_by(LinkedInLead.created_at.desc())
        )
        li_leads = res.scalars().all()
        leads_dict = [
            {
                "full_name": l.full_name,
                "job_title": l.job_title,
                "seniority": l.seniority,
                "company_name": l.company_name,
                "company_website": l.company_website,
                "company_size": l.company_size,
                "industry": l.industry,
                "location": l.location,
                "country": l.country,
                "city": l.city,
                "work_email": l.work_email,
                "personal_email": l.personal_email,
                "phone": l.phone,
                "linkedin_url": l.linkedin_url,
                "company_linkedin_url": l.company_linkedin_url,
                "lead_score": l.lead_score,
                "recommended_service": l.recommended_service,
                "ai_summary": l.ai_summary,
            }
            for l in li_leads
        ]
        path = service.export(job_id, format, leads=leads_dict)
    else:
        extracted = await repo.get_latest_extracted(job_id)
        ai_result = await db.execute(
            select(AIAnalysis).where(AIAnalysis.job_id == job_id).order_by(AIAnalysis.created_at.desc()).limit(1)
        )
        ai = ai_result.scalar_one_or_none()

        ext_dict = None
        if extracted:
            ext_dict = {
                "url": extracted.url,
                "company_name": extracted.company_name,
                "emails": extracted.emails,
                "phones": extracted.phones,
                "services": extracted.services,
                "tech_stack": extracted.tech_stack,
            }
        ai_dict = None
        if ai:
            ai_dict = {
                "company_name": ai.company_name,
                "industry": ai.industry,
                "lead_score": ai.lead_score,
                "summary": ai.summary,
                "services": ai.services,
            }

        path = service.export(job_id, format, ext_dict, ai_dict)

    db.add(Export(job_id=job_id, format=format, file_path=str(path)))
    await db.flush()

    media = {
        "json": "application/json",
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    return FileResponse(path, media_type=media[format], filename=path.name)
