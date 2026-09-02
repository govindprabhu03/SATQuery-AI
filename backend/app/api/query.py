from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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


def _find_image(image_id: str) -> Path:
    matches = list(UPLOAD_DIR.glob(f"{image_id}.*"))
    if not matches:
        raise HTTPException(404, "Image not found")
    return matches[0]


@router.post("/query")
def query(req: QueryRequest):
    image_path = _find_image(req.image_id)
    question_lower = req.question.strip().lower()

    if any(trigger in question_lower for trigger in CAPTION_TRIGGERS):
        return {
            "answer": generate_caption(image_path),
            "task_type": "caption",
            "objects": [],
            "count": None,
        }

    if any(trigger in question_lower for trigger in GROUNDING_TRIGGERS):
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
        return {
            "answer": answer,
            "task_type": "grounding",
            "objects": objects,
            "count": count,
        }

    return {
        "answer": answer_question(image_path, req.question),
        "task_type": "vqa",
        "objects": [],
        "count": None,
    }
