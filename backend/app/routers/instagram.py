import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.instagram_account_repository import InstagramAccountRepository
from app.schemas.instagram import InstagramAccountCreate, InstagramAccountResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/instagram", tags=["instagram"])


@router.post("/accounts", response_model=InstagramAccountResponse)
async def connect_instagram_account(
    data: InstagramAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    repo = InstagramAccountRepository(db)
    account = await repo.create(
        user_id=current_user.id,
        username=data.username,
        cookie=data.instagram_cookie
    )
    return account


@router.get("/accounts", response_model=list[InstagramAccountResponse])
async def list_instagram_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    repo = InstagramAccountRepository(db)
    return await repo.get_by_user_id(current_user.id)


@router.delete("/accounts/{account_id}")
async def delete_instagram_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    repo = InstagramAccountRepository(db)
    success = await repo.delete(account_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Instagram account not found")
    return {"status": "success", "message": "Instagram account disconnected"}
