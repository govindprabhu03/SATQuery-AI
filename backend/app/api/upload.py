import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_db import Image

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
CONTENT_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
}

router = APIRouter()


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    image_id = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{image_id}{ext}"

    data = await file.read()
    with dest.open("wb") as f:
        f.write(data)

    db.add(
        Image(
            image_id=image_id,
            filename=dest.name,
            content_type=CONTENT_TYPES[ext],
            size_bytes=len(data),
        )
    )
    db.commit()

    return {"image_id": image_id, "filename": dest.name}
