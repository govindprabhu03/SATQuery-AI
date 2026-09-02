from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_db import Comparison, Image
from app.services.change_detection_service import detect_changes, summarize

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"

router = APIRouter()


class CompareRequest(BaseModel):
    before_id: str
    after_id: str
    question: str = ""


def _find_image(image_id: str, db: Session) -> tuple[Path, Image]:
    image = db.query(Image).filter(Image.image_id == image_id).first()
    if image is None:
        raise HTTPException(404, f"Image not found: {image_id}")
    path = UPLOAD_DIR / image.filename
    if not path.exists():
        raise HTTPException(404, f"Image file missing on disk: {image_id}")
    return path, image


@router.post("/compare")
def compare(req: CompareRequest, db: Session = Depends(get_db)):
    before_path, before_image = _find_image(req.before_id, db)
    after_path, after_image = _find_image(req.after_id, db)

    result = detect_changes(before_path, after_path)
    answer = summarize(result)

    db.add(
        Comparison(
            before_image_id=before_image.id,
            after_image_id=after_image.id,
            answer=answer,
            changed_area_percent=result["changed_area_percent"],
            regions=result["regions"],
        )
    )
    db.commit()

    return {
        "answer": answer,
        "task_type": "change_detection",
        "changed_area_percent": result["changed_area_percent"],
        "count": result["num_regions"],
        "objects": [
            {"label": "change", "confidence": None, "box_percent": r["box"]}
            for r in result["regions"]
        ],
    }
