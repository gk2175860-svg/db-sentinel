"""Async engine and session factory bound to application settings."""
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings


@lru_cache(maxsize=1)
def async_engine() -> AsyncEngine:
    settings = get_settings()
    url = settings.database_url
    
    # Configure SSL for production databases
    connect_args = {}
    if settings.app_env == "production" and "postgresql" in url:
        connect_args["ssl"] = "require"
    elif settings.app_env == "production" and "mysql" in url:
        connect_args["ssl"] = {"ssl_mode": "REQUIRED"}
    
    return create_async_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


@lru_cache(maxsize=1)
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(async_engine(), expire_on_commit=False)
