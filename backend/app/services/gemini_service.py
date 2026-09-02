import base64
import mimetypes
import os

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.6-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

SYSTEM_PROMPT = (
    "You are analyzing a satellite or aerial image. Answer the user's question "
    "accurately and concisely, using both what you can see in the image and your "
    "own real-world knowledge (e.g. named landmarks, distances, history). If the "
    "question can't be answered from the image or general knowledge, say so "
    "plainly instead of guessing."
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
