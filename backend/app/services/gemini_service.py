import base64
import mimetypes
import os

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
# gemini-3.6-flash is a "thinking" model — it burns hundreds of hidden
# reasoning tokens even on trivial prompts (~17s for "say hello"). The
# lite variant skips that and answers image questions in ~2-3s instead.
GEMINI_MODEL = "gemini-flash-lite-latest"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

SYSTEM_PROMPT = (
    "You are a remote sensing analyst explaining findings to a non-expert who "
    "has never studied satellite imagery or GIS — assume no prior knowledge "
    "of the field. You may be shown either (a) a raw satellite/aerial photo, "
    "or (b) a processed remote sensing product — a land-cover/land-use "
    "classification map, a change-detection overlay, an NDVI or other index "
    "visualization, or a GIS layer with a legend, grid references, coordinate "
    "ticks, scale bar, or boundary lines.\n\n"
    "If it's a classified/thematic map: read the legend and identify what "
    "each color/symbol represents (e.g. dark green = dense vegetation/forest, "
    "bright green = cropland/sparse vegetation, magenta/pink = built-up or "
    "changed area, yellow = bare soil or another cover class, red/pink lines "
    "= roads or mapped boundaries, white dashed lines = administrative "
    "boundaries, numbered grid lines = map reference/coordinate overlays). "
    "State what each visible class covers and roughly how the classes are "
    "distributed across the frame, not just a single label.\n\n"
    "If it's a raw photo: answer using both what you can see and your own "
    "real-world knowledge (named landmarks, distances, history).\n\n"
    "Whenever you use a technical term a non-expert wouldn't know — NDVI, "
    "cloud cover, resolution, spectral band, classification, change "
    "detection, and similar jargon — briefly define it in plain words right "
    "where you use it (a short parenthetical is enough, e.g. 'NDVI (a score "
    "computed from the image that shows how healthy the plant life is)'). "
    "Never assume the reader already knows remote-sensing vocabulary.\n\n"
    "Always answer accurately and concisely. If the question can't be "
    "answered from the image or general knowledge, say so plainly instead "
    "of guessing."
)


def answer_with_gemini(image_path, question: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    mime_type = mimetypes.guess_type(str(image_path))[0] or "image/jpeg"
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    resp = requests.post(
        GEMINI_URL,
        params={"key": GEMINI_API_KEY},
        json={
            "contents": [
                {
                    "parts": [
                        {"text": f"{SYSTEM_PROMPT}\n\nQuestion: {question}"},
                        {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                    ]
                }
            ]
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


SUGGESTION_PROMPT = (
    "Look at this satellite/aerial image. A non-expert with no remote-sensing "
    "background is about to explore it with an AI assistant but doesn't know "
    "what to ask. Suggest exactly 4 short, specific questions (under 8 words "
    "each) they could ask about THIS image — based on what's actually visible "
    "(e.g. if you see boats, suggest a ship-counting question; if it's a "
    "classified map, suggest a legend question; if it's a recognizable place, "
    "suggest a knowledge question). Reply with ONLY the 4 questions, one per "
    "line, no numbering, no quotes, no extra text."
)


def suggest_questions(image_path) -> list[str]:
    if not GEMINI_API_KEY:
        return []

    mime_type = mimetypes.guess_type(str(image_path))[0] or "image/jpeg"
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    try:
        resp = requests.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": SUGGESTION_PROMPT},
                            {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                        ]
                    }
                ]
            },
            timeout=20,
        )
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        lines = [line.strip("-*• \t") for line in text.splitlines()]
        return [line for line in lines if line][:4]
    except Exception:
        return []
