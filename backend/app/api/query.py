from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.caption_service import generate_caption

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"

router = APIRouter()


class QueryRequest(BaseModel):
    image_id: str
    question: str


def _find_image(image_id: str) -> Path:
    matches = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not matches:
        raise HTTPException(404, "Image not found")
    return matches[0]


@router.post("/query")
def query(req: QueryRequest):
    image_path = _find_image(req.image_id)
    return {
        "answer": generate_caption(image_path),
        "task_type": "caption",
        "objects": [],
        "count": None,
    }
