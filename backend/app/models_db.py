import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Image(Base):
    __tablename__ = "images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    queries: Mapped[list["Query"]] = relationship(back_populates="image", cascade="all, delete-orphan")


class Query(Base):
    __tablename__ = "queries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("images.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    task_type: Mapped[str] = mapped_column(String(32))
    objects: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    image: Mapped["Image"] = relationship(back_populates="queries")


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    before_image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("images.id", ondelete="CASCADE"))
    after_image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("images.id", ondelete="CASCADE"))
    answer: Mapped[str] = mapped_column(Text)
    changed_area_percent: Mapped[float] = mapped_column(Float)
    regions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class RegionAnalysis(Base):
    __tablename__ = "region_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    place_name: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    period_before: Mapped[str] = mapped_column(String(32))
    period_after: Mapped[str] = mapped_column(String(32))
    vegetated_pct_before: Mapped[float] = mapped_column(Float)
    vegetated_pct_after: Mapped[float] = mapped_column(Float)
    mean_ndvi_change: Mapped[float] = mapped_column(Float)
    scenes_used_before: Mapped[int] = mapped_column(Integer)
    scenes_used_after: Mapped[int] = mapped_column(Integer)
    narrative: Mapped[str] = mapped_column(Text)
    before_image_path: Mapped[str] = mapped_column(String(255))
    after_image_path: Mapped[str] = mapped_column(String(255))
    diff_image_path: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EarthquakeAnalysis(Base):
    __tablename__ = "earthquake_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    place: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    years: Mapped[int] = mapped_column(Integer)
    radius_km: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(16))
    fault_name: Mapped[str] = mapped_column(String(255))
    fault_distance_km: Mapped[float] = mapped_column(Float)
    quake_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
