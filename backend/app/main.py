from fastapi import FastAPI

from app.api.upload import router as upload_router
from app.api.query import router as query_router
from app.api.compare import router as compare_router
from app.db import Base, engine
from app import models_db  # noqa: F401 -- registers models on Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SatQuery AI")
app.include_router(upload_router)
app.include_router(query_router)
app.include_router(compare_router)


@app.get("/health")
def health():
    return {"status": "ok"}
