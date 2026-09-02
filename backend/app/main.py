from fastapi import FastAPI

from app.api.upload import router as upload_router
from app.api.query import router as query_router

app = FastAPI(title="SatQuery AI")
app.include_router(upload_router)
app.include_router(query_router)


@app.get("/health")
def health():
    return {"status": "ok"}
