import asyncio
import tempfile
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.init_db import init_db
from sqlalchemy import text

async def test():
    tmp = tempfile.mkdtemp()
    db_path = os.path.join(tmp, 'test.db')
    engine = create_async_engine(f'sqlite+aiosqlite:///{db_path}')
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        await init_db(session)
    
    # Check if tables exist
    async with factory() as session:
        result = await session.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result]
        print('Tables:', tables)
    
    await engine.dispose()
    os.unlink(db_path)

asyncio.run(test())