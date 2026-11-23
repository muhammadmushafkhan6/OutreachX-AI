"""Test PostgreSQL connection using backend/.env settings."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings


async def main() -> None:
    settings = get_settings()
    print(f"Host: {settings.postgres_host}:{settings.postgres_port}")
    print(f"User: {settings.postgres_user}")
    print(f"Database: {settings.postgres_db}")
    print(f"Password set: {'yes' if settings.postgres_password else 'NO'}")

    try:
        import asyncpg
    except ImportError:
        print("Install asyncpg: pip install asyncpg")
        sys.exit(1)

    try:
        conn = await asyncpg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            user=settings.postgres_user,
            password=settings.postgres_password,
            database=settings.postgres_db,
        )
        version = await conn.fetchval("SELECT version()")
        await conn.close()
        print("OK — connected.")
        print(version[:80] + "...")
    except Exception as e:
        print(f"FAILED — {type(e).__name__}: {e}")
        print("\nFix:")
        print("  1. pgAdmin → Login/Group Roles → postgres → Definition → set password")
        print("  2. Match POSTGRES_PASSWORD in backend/.env")
        print("  3. Ensure PostgreSQL service is running")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
