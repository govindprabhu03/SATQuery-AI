from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.upload import router as upload_router
from app.api.query import router as query_router
from app.api.compare import router as compare_router
from app.api.region import router as region_router
from app.api.earthquake import router as earthquake_router
from app.db import Base, engine
from app import models_db  # noqa: F401 -- registers models on Base

Base.metadata.create_all(bind=engine)

REGION_IMAGES_DIR = Path(__file__).resolve().parents[2] / "uploads" / "region"
REGION_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="SatQuery AI")
app.include_router(upload_router)
app.include_router(query_router)
app.include_router(compare_router)
app.include_router(region_router)
app.include_router(earthquake_router)
app.mount("/region-images", StaticFiles(directory=REGION_IMAGES_DIR), name="region-images")


@app.get("/health")
def health():
    return {"status": "ok"}
