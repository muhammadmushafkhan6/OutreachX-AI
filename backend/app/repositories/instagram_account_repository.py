from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instagram_account import InstagramAccount


class InstagramAccountRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, username: str, cookie: str) -> InstagramAccount:
        account = InstagramAccount(
            user_id=user_id,
            username=username,
            instagram_cookie=cookie
        )
        self.db.add(account)
        await self.db.commit()
        await self.db.refresh(account)
        return account

    async def get_by_user_id(self, user_id: UUID) -> list[InstagramAccount]:
        result = await self.db.execute(
            select(InstagramAccount)
            .where(InstagramAccount.user_id == user_id)
            .order_by(InstagramAccount.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, account_id: UUID, user_id: UUID) -> InstagramAccount | None:
        result = await self.db.execute(
            select(InstagramAccount)
            .where(InstagramAccount.id == account_id, InstagramAccount.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, account_id: UUID, user_id: UUID) -> bool:
        account = await self.get_by_id(account_id, user_id)
        if account:
            await self.db.delete(account)
            await self.db.commit()
            return True
        return False
