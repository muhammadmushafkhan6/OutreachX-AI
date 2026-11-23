import asyncio
import logging
from uuid import UUID
from datetime import datetime
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.outreach import (
    OutreachRequest, OutreachResponse, DMTrackRequest,
    EmailGenerateRequest, EmailGenerateResponse,
    EmailSendRequest, EmailSendResponse, EmailTestResponse,
    EmailBulkSendRequest, EmailBulkSendResponse,
    EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateOut,
    SentEmailOut, EmailCampaignCreate, EmailCampaignOut,
    EmailCampaignStartRequest,
)
from app.models.email_campaign import EmailTemplate, EmailCampaign, SentEmail
from app.services.ai_service import AIService
from app.services.email_service import EmailService
from app.services.social_media.apify_social import ApifySocialScraper
from app.dependencies import get_current_user
from app.models.user import User
from app.models.job import Job
from app.repositories.instagram_account_repository import InstagramAccountRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/outreach", tags=["outreach"])


class InstagramDMRequest(BaseModel):
    target_username: str
    message: str
    instagram_account_id: UUID

class InstagramDMGenerateRequest(BaseModel):
    username: str
    full_name: str | None = None
    bio: str | None = None
    followers_count: int | None = None
    website: str | None = None


@router.post("/track/dm-click")
async def track_dm_click(
    data: DMTrackRequest,
    current_user: User = Depends(get_current_user),
):
    logger.info(f"dm_clicked: lead_id={data.lead_id}, user_id={current_user.id}, timestamp={data.timestamp}")
    return {"status": "success", "event": "dm_clicked"}


@router.post("/generate", response_model=OutreachResponse)
async def generate_message(
    data: OutreachRequest,
    current_user: User = Depends(get_current_user),
):
    business_data = {
        "business_name": data.business_name,
        "category": data.category,
        "location": data.location,
    }
    ai_service = AIService()
    try:
        message = await asyncio.wait_for(
            asyncio.to_thread(
                ai_service.generate_outreach_message,
                business_data,
                data.phone,
            ),
            timeout=45,
        )
    except asyncio.TimeoutError:
        logger.warning("Outreach generation timed out for %s", data.business_name)
        message = ai_service._fallback_outreach_message(
            business_data,
            ai_service._is_pakistan_phone(data.phone),
        )
    except Exception as e:
        logger.error("Outreach generation failed: %s", e)
        message = ai_service._fallback_outreach_message(
            business_data,
            ai_service._is_pakistan_phone(data.phone),
        )

    if not message or not message.strip():
        message = ai_service._fallback_outreach_message(
            business_data,
            ai_service._is_pakistan_phone(data.phone),
        )

    return OutreachResponse(message=message.strip(), phone=data.phone)


@router.get("/status")
async def get_whatsapp_status():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:3001/status", timeout=2.0)
            return response.json()
    except Exception:
        return {"ready": False, "service_down": True}


@router.post("/send")
async def send_whatsapp(
    data: OutreachResponse,
    current_user: User = Depends(get_current_user),
):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:3001/send-message",
                json={
                    "phone": data.phone,
                    "message": data.message,
                },
                timeout=30.0,
            )

            if response.status_code == 503:
                raise HTTPException(
                    status_code=503,
                    detail="WhatsApp is connecting... Please wait for the QR scan and READY message in terminal.",
                )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"WhatsApp service error: {response.text}",
                )

            return {"status": "success", "data": response.json()}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to connect to WhatsApp service. Make sure 'node index.js' is running in whatsapp-service folder.",
        )


@router.post("/instagram-dm/generate")
async def generate_instagram_dm(
    data: InstagramDMGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        ai_service = AIService()
        message = ai_service.generate_instagram_dm(data.dict())
        return {"message": message}
    except Exception as e:
        logger.error("Failed to generate Instagram DM: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instagram-dm")
async def send_instagram_dm(
    data: InstagramDMRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        repo = InstagramAccountRepository(db)
        account = await repo.get_by_id(data.instagram_account_id, current_user.id)

        if not account:
            raise HTTPException(status_code=404, detail="Instagram account not found or not authorized")

        if not account.is_active:
            raise HTTPException(status_code=400, detail="Instagram account is not active")

        scraper = ApifySocialScraper()
        result = await scraper.send_instagram_dm(
            username=data.target_username,
            message=data.message,
            instagram_cookie=account.instagram_cookie,
        )

        account.last_used_at = datetime.utcnow()
        await db.commit()

        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error("Failed to send Instagram DM: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ======================================================================
# EMAIL OUTREACH ENDPOINTS
# ======================================================================

# -------- Email SMTP Status & Test --------

@router.get("/email/test", response_model=EmailTestResponse)
async def test_email_smtp(
    current_user: User = Depends(get_current_user),
):
    service = EmailService()
    return await service.test_connection()


# -------- AI Email Template Generation --------

@router.post("/email/generate", response_model=EmailGenerateResponse)
async def generate_email_template(
    data: EmailGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    ai_service = AIService()
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(ai_service.generate_email_template, data.dict()),
            timeout=60,
        )
    except asyncio.TimeoutError:
        logger.warning("Email template generation timed out")
        result = ai_service._fallback_email_template(data.dict())
    except Exception as e:
        logger.error("Email template generation failed: %s", e)
        result = ai_service._fallback_email_template(data.dict())

    return EmailGenerateResponse(
        subject=result.get("subject", ""),
        html_body=result.get("html_body", ""),
        text_body=result.get("text_body", ""),
    )


# -------- Single Email Send --------

@router.post("/email/send", response_model=EmailSendResponse)
async def send_single_email(
    data: EmailSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = EmailService()
    if not service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="SMTP not configured. Please set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL in .env.",
        )

    sent_email = SentEmail(
        user_id=current_user.id,
        lead_id=data.lead_id,
        lead_type=data.lead_type,
        to_email=str(data.to_email),
        to_name=data.to_name,
        from_email=service.from_email or service.username or "",
        subject=data.subject,
        status="sending",
    )
    db.add(sent_email)
    await db.flush()

    try:
        result = await service.send_email(
            to_email=str(data.to_email),
            subject=data.subject,
            html_body=data.html_body,
            text_body=data.text_body,
            reply_to=str(data.reply_to) if data.reply_to else None,
            cc=[str(x) for x in (data.cc or [])],
            bcc=[str(x) for x in (data.bcc or [])],
        )

        sent_email.status = "sent"
        sent_email.sent_at = datetime.utcnow()

        if data.lead_id and data.lead_type == "map":
            from app.models.map_lead import MapLead
            stmt = select(MapLead).where(MapLead.id == data.lead_id, MapLead.job_id.in_(
                select(Job.id).where(Job.user_id == current_user.id)
            ))
            r = await db.execute(stmt)
            lead = r.scalar_one_or_none()
            if lead:
                lead.email_sent = True
                lead.email_sent_at = datetime.utcnow()

        await db.commit()
        return EmailSendResponse(
            success=True,
            to=str(data.to_email),
            subject=data.subject,
            from_email=result.get("from"),
            sent_email_id=sent_email.id,
        )
    except Exception as e:
        logger.error("Single email send failed: %s", e)
        sent_email.status = "failed"
        sent_email.error_message = str(e)
        await db.commit()
        return EmailSendResponse(
            success=False,
            to=str(data.to_email),
            subject=data.subject,
            from_email=service.from_email,
            error=str(e),
        )


# -------- Bulk Email Send --------

@router.post("/email/bulk-send", response_model=EmailBulkSendResponse)
async def send_bulk_emails(
    data: EmailBulkSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = EmailService()
    if not service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="SMTP not configured. Please set SMTP_* variables in .env.",
        )

    campaign = None
    if data.campaign_name:
        campaign = EmailCampaign(
            user_id=current_user.id,
            name=data.campaign_name,
            status="running",
            subject=data.subject_template,
            html_body=data.html_template,
            text_body=data.text_template,
            reply_to=str(data.reply_to) if data.reply_to else None,
            delay_seconds=int(data.delay_seconds),
            total_recipients=len(data.recipients),
            started_at=datetime.utcnow(),
        )
        db.add(campaign)
        await db.flush()

    results = []
    success_count = 0
    failed_count = 0
    from_email = service.from_email or service.username or ""

    for i, rec in enumerate(data.recipients):
        subject = data.subject_template
        html_body = data.html_template
        text_body = data.text_template or ""

        for key, value in rec.dict().items():
            if isinstance(value, str):
                ph = "{{" + key + "}}"
                subject = subject.replace(ph, value)
                html_body = html_body.replace(ph, value)
                if text_body:
                    text_body = text_body.replace(ph, value)

        sent_email = SentEmail(
            user_id=current_user.id,
            campaign_id=campaign.id if campaign else None,
            lead_id=rec.lead_id,
            lead_type=rec.lead_type,
            to_email=str(rec.email),
            to_name=rec.name or rec.business_name,
            from_email=from_email,
            subject=subject,
            status="sending",
        )
        db.add(sent_email)
        await db.flush()

        try:
            await service.send_email(
                to_email=str(rec.email),
                subject=subject,
                html_body=html_body,
                text_body=text_body if text_body else None,
                reply_to=str(data.reply_to) if data.reply_to else None,
            )
            sent_email.status = "sent"
            sent_email.sent_at = datetime.utcnow()
            success_count += 1
            results.append({
                "index": i,
                "email": str(rec.email),
                "success": True,
                "sent_email_id": str(sent_email.id),
            })

            if rec.lead_id and (rec.lead_type == "map" or not rec.lead_type):
                from app.models.map_lead import MapLead
                from app.models.job import Job
                stmt = select(MapLead).where(
                    MapLead.id == rec.lead_id,
                ).join(Job).where(Job.user_id == current_user.id)
                r = await db.execute(stmt)
                lead = r.scalar_one_or_none()
                if lead:
                    lead.email_sent = True
                    lead.email_sent_at = datetime.utcnow()

        except Exception as e:
            logger.error("Bulk email send failed [%s]: %s", rec.email, e)
            sent_email.status = "failed"
            sent_email.error_message = str(e)
            failed_count += 1
            results.append({
                "index": i,
                "email": str(rec.email),
                "success": False,
                "error": str(e),
            })

        if data.delay_seconds > 0 and i < len(data.recipients) - 1:
            await db.commit()
            await asyncio.sleep(data.delay_seconds)

    if campaign:
        campaign.sent_count = success_count
        campaign.failed_count = failed_count
        campaign.status = "completed"
        campaign.completed_at = datetime.utcnow()

    await db.commit()

    return EmailBulkSendResponse(
        total=len(data.recipients),
        success_count=success_count,
        failed_count=failed_count,
        results=results,
        campaign_id=campaign.id if campaign else None,
    )


# -------- Email Templates CRUD --------

@router.get("/email/templates", response_model=List[EmailTemplateOut])
async def list_email_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailTemplate).where(
        EmailTemplate.user_id == current_user.id,
    ).order_by(EmailTemplate.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/email/templates", response_model=EmailTemplateOut)
async def create_email_template(
    data: EmailTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.is_default:
        stmt = select(EmailTemplate).where(
            EmailTemplate.user_id == current_user.id,
            EmailTemplate.is_default == True,
        )
        result = await db.execute(stmt)
        existing_default = result.scalar_one_or_none()
        if existing_default:
            existing_default.is_default = False

    tpl = EmailTemplate(
        user_id=current_user.id,
        name=data.name,
        subject=data.subject,
        html_body=data.html_body,
        text_body=data.text_body,
        variables=data.variables,
        is_default=data.is_default,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.patch("/email/templates/{template_id}", response_model=EmailTemplateOut)
async def update_email_template(
    template_id: UUID,
    data: EmailTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailTemplate).where(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tpl, key, value)

    if data.is_default:
        stmt2 = select(EmailTemplate).where(
            EmailTemplate.user_id == current_user.id,
            EmailTemplate.is_default == True,
            EmailTemplate.id != template_id,
        )
        r2 = await db.execute(stmt2)
        old_default = r2.scalar_one_or_none()
        if old_default:
            old_default.is_default = False

    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/email/templates/{template_id}")
async def delete_email_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailTemplate).where(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tpl)
    await db.commit()
    return {"status": "success", "deleted": True}


# -------- Email Campaigns --------

@router.get("/email/campaigns", response_model=List[EmailCampaignOut])
async def list_email_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(EmailCampaign).where(
        EmailCampaign.user_id == current_user.id,
    ).order_by(EmailCampaign.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/email/campaigns", response_model=EmailCampaignOut)
async def create_email_campaign(
    data: EmailCampaignCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subject = data.subject
    html_body = data.html_body
    text_body = data.text_body

    if data.template_id:
        stmt_tpl = select(EmailTemplate).where(
            EmailTemplate.id == data.template_id,
            EmailTemplate.user_id == current_user.id,
        )
        r_tpl = await db.execute(stmt_tpl)
        tpl = r_tpl.scalar_one_or_none()
        if tpl:
            subject = tpl.subject
            html_body = tpl.html_body
            text_body = tpl.text_body

    campaign = EmailCampaign(
        user_id=current_user.id,
        template_id=data.template_id,
        name=data.name,
        status="draft",
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        from_name=data.from_name,
        reply_to=data.reply_to,
        delay_seconds=data.delay_seconds,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/email/campaigns/{campaign_id}", response_model=EmailCampaignOut)
async def get_email_campaign(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailCampaign).where(
        EmailCampaign.id == campaign_id,
        EmailCampaign.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/email/campaigns/{campaign_id}/start")
async def start_email_campaign(
    campaign_id: UUID,
    data: EmailCampaignStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailCampaign).where(
        EmailCampaign.id == campaign_id,
        EmailCampaign.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status in ("running", "completed"):
        raise HTTPException(status_code=400, detail=f"Campaign is already {campaign.status}")

    service = EmailService()
    if not service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="SMTP not configured. Please set SMTP_* variables in .env.",
        )

    campaign.status = "running"
    campaign.total_recipients = len(data.recipients)
    campaign.started_at = datetime.utcnow()
    campaign.sent_count = 0
    campaign.failed_count = 0
    await db.flush()

    subject_template = campaign.subject
    html_template = campaign.html_body
    text_template = campaign.text_body or ""
    delay = max(0, float(campaign.delay_seconds))
    from_email = service.from_email or service.username or ""

    results = []
    success_count = 0
    failed_count = 0

    for i, rec in enumerate(data.recipients):
        subject = subject_template
        html_body = html_template
        text_body = text_template
        for key, value in rec.dict().items():
            if isinstance(value, str):
                ph = "{{" + key + "}}"
                subject = subject.replace(ph, value)
                html_body = html_body.replace(ph, value)
                if text_body:
                    text_body = text_body.replace(ph, value)

        sent_email = SentEmail(
            user_id=current_user.id,
            campaign_id=campaign.id,
            lead_id=rec.lead_id,
            lead_type=rec.lead_type,
            to_email=str(rec.email),
            to_name=rec.name or rec.business_name,
            from_email=from_email,
            subject=subject,
            status="sending",
        )
        db.add(sent_email)
        await db.flush()

        try:
            await service.send_email(
                to_email=str(rec.email),
                subject=subject,
                html_body=html_body,
                text_body=text_body if text_body else None,
                reply_to=campaign.reply_to,
            )
            sent_email.status = "sent"
            sent_email.sent_at = datetime.utcnow()
            success_count += 1
            results.append({"index": i, "email": str(rec.email), "success": True})
        except Exception as e:
            logger.error("Campaign email send failed [%s]: %s", rec.email, e)
            sent_email.status = "failed"
            sent_email.error_message = str(e)
            failed_count += 1
            results.append({"index": i, "email": str(rec.email), "success": False, "error": str(e)})

        campaign.sent_count = success_count
        campaign.failed_count = failed_count

        if delay > 0 and i < len(data.recipients) - 1:
            await db.commit()
            await asyncio.sleep(delay)

    campaign.status = "completed"
    campaign.completed_at = datetime.utcnow()
    await db.commit()

    return {
        "campaign_id": str(campaign.id),
        "status": "completed",
        "total": len(data.recipients),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
    }


# -------- Sent Emails History --------

@router.get("/email/sent", response_model=List[SentEmailOut])
async def list_sent_emails(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    campaign_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    stmt = select(SentEmail).where(SentEmail.user_id == current_user.id)
    if campaign_id:
        stmt = stmt.where(SentEmail.campaign_id == campaign_id)
    stmt = stmt.order_by(SentEmail.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/email/stats")
async def get_email_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import case

    total_stmt = select(func.count(SentEmail.id)).where(SentEmail.user_id == current_user.id)
    sent_stmt = select(func.count(SentEmail.id)).where(
        SentEmail.user_id == current_user.id,
        SentEmail.status == "sent",
    )
    failed_stmt = select(func.count(SentEmail.id)).where(
        SentEmail.user_id == current_user.id,
        SentEmail.status == "failed",
    )
    campaign_stmt = select(func.count(EmailCampaign.id)).where(
        EmailCampaign.user_id == current_user.id,
    )

    total_r = await db.execute(total_stmt)
    sent_r = await db.execute(sent_stmt)
    failed_r = await db.execute(failed_stmt)
    camp_r = await db.execute(campaign_stmt)

    return {
        "total_sent_emails": total_r.scalar() or 0,
        "successful": sent_r.scalar() or 0,
        "failed": failed_r.scalar() or 0,
        "campaigns_total": camp_r.scalar() or 0,
    }

