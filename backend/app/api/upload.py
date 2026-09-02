import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}

router = APIRouter()


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    image_id = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{image_id}{ext}"

    with dest.open("wb") as f:
        f.write(await file.read())

    return {"image_id": image_id, "filename": dest.name}
