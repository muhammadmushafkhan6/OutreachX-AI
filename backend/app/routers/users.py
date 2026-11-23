from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user

@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    repo = UserRepository(db)
    
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        # Check if email is already taken
        if data.email.lower() != user.email.lower():
            existing = await repo.get_by_email(data.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
        user.email = data.email.lower()
    if data.instagram_username is not None:
        # Clean up username (remove @ if present)
        ig_user = data.instagram_username.strip()
        if ig_user.startswith("@"):
            ig_user = ig_user[1:]
        user.instagram_username = ig_user

    await db.commit()
    await db.refresh(user)
    return user
