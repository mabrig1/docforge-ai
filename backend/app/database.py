"""SQLAlchemy database setup — SQLite, no external DB required."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# DATABASE_URL env var lets Render point to a persistent disk path (/data/docforge.db).
# Falls back to local file for development.
_db_path = os.getenv("DATABASE_URL", "./docforge.db")
DATABASE_URL = f"sqlite:///{_db_path}" if not _db_path.startswith("sqlite") else _db_path

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
