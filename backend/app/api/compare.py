from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.change_detection_service import detect_changes, summarize

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"

router = APIRouter()


class CompareRequest(BaseModel):
    before_id: str
    after_id: str
    question: str = ""


def _find_image(image_id: str) -> Path:
    matches = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not matches:
        raise HTTPException(404, f"Image not found: {image_id}")
    return matches[0]


@router.post("/compare")
def compare(req: CompareRequest):
    before_path = _find_image(req.before_id)
    after_path = _find_image(req.after_id)

    result = detect_changes(before_path, after_path)

    return {
        "answer": summarize(result),
        "task_type": "change_detection",
        "changed_area_percent": result["changed_area_percent"],
        "count": result["num_regions"],
        "objects": [
            {"label": "change", "confidence": None, "box_percent": r["box"]}
            for r in result["regions"]
        ],
    }
