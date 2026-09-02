from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_db import Image, Query as QueryRow
from app.services.caption_service import generate_caption
from app.services.grounding_service import detect_objects, extract_target_label
from app.services.ship_detector_service import detect_ships
from app.services.vqa_service import answer_question

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"

CAPTION_TRIGGERS = ("describe", "what is this", "what's in this", "caption")
GROUNDING_TRIGGERS = (
    "how many",
    "count",
    "where is",
    "where are",
    "locate",
    "find",
    "show me",
    "highlight",
)
SHIP_WORDS = ("ship", "ships", "vessel", "vessels", "boat", "boats")

router = APIRouter()


class QueryRequest(BaseModel):
    image_id: str
    question: str


def _find_image(image_id: str, db: Session) -> tuple[Path, Image]:
    image = db.query(Image).filter(Image.image_id == image_id).first()
    if image is None:
        raise HTTPException(404, "Image not found")
    path = UPLOAD_DIR / image.filename
    if not path.exists():
        raise HTTPException(404, "Image file missing on disk")
    return path, image


@router.post("/query")
def query(req: QueryRequest, db: Session = Depends(get_db)):
    image_path, image = _find_image(req.image_id, db)
    question_lower = req.question.strip().lower()

    if any(trigger in question_lower for trigger in CAPTION_TRIGGERS):
        result = {
            "answer": generate_caption(image_path),
            "task_type": "caption",
            "objects": [],
            "count": None,
        }
    elif any(trigger in question_lower for trigger in GROUNDING_TRIGGERS):
        is_ship_query = any(word in question_lower for word in SHIP_WORDS)
        if is_ship_query:
            label = "ship"
            objects = detect_ships(image_path)
        else:
            label = extract_target_label(req.question)
            objects = detect_objects(image_path, label)
        count = len(objects)
        plural = "s" if count != 1 else ""
        answer = (
            f"I found {count} {label}{plural}."
            if count
            else f"I couldn't find any {label} in this image."
        )
        result = {
            "answer": answer,
            "task_type": "grounding",
            "objects": objects,
            "count": count,
        }
    else:
        result = {
            "answer": answer_question(image_path, req.question),
            "task_type": "vqa",
            "objects": [],
            "count": None,
        }

    db.add(
        QueryRow(
            image_id=image.id,
            question=req.question,
            answer=result["answer"],
            task_type=result["task_type"],
            objects=result["objects"],
            count=result["count"],
        )
    )
    db.commit()

    return result


@router.get("/images/{image_id}/history")
def image_history(image_id: str, db: Session = Depends(get_db)):
    _, image = _find_image(image_id, db)
    rows = (
        db.query(QueryRow)
        .filter(QueryRow.image_id == image.id)
        .order_by(QueryRow.created_at)
        .all()
    )
    return [
        {
            "question": r.question,
            "answer": r.answer,
            "task_type": r.task_type,
            "count": r.count,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
