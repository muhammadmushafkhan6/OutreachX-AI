import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings


async def create_database():
    settings = get_settings()

    print("=== Database Setup ===")
    print(f"Host:     {settings.postgres_host}:{settings.postgres_port}")
    print(f"User:     {settings.postgres_user}")
    print(f"Database: {settings.postgres_db}")
    print(f"Password: {'set' if settings.postgres_password else 'empty'}")
    print()

    try:
        import asyncpg
    except ImportError:
        print("ERROR: asyncpg not installed. Run: pip install asyncpg")
        sys.exit(1)

    try:
        print("Connecting to PostgreSQL (postgres database)...")
        conn = await asyncpg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            user=settings.postgres_user,
            password=settings.postgres_password,
            database="postgres",
        )
        print("Connected successfully.\n")

        result = await conn.fetch(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.postgres_db,
        )

        if result:
            print(f"Database '{settings.postgres_db}' already exists. Nothing to do.")
        else:
            print(f"Creating database '{settings.postgres_db}'...")
            await conn.execute(f'CREATE DATABASE "{settings.postgres_db}"')
            print(f"Database '{settings.postgres_db}' created successfully!")

        await conn.close()

        print("\n" + "=" * 50)
        print("DONE. You can now start the backend with:")
        print("  python -m uvicorn app.main:app --reload --port 8000")
        print("=" * 50)

    except Exception as e:
        print(f"\nERROR: {type(e).__name__}: {e}")
        print()
        print("Troubleshooting:")
        print("  1. Make sure PostgreSQL service is running")
        print("  2. Check POSTGRES_PASSWORD in backend/.env matches your PostgreSQL password")
        print("  3. Verify POSTGRES_USER 'postgres' exists (default superuser)")
        print("  4. Or use Docker: cd backend ; docker compose up -d postgres")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(create_database())
