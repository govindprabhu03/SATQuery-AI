from functools import lru_cache
from pathlib import Path

from PIL import Image

FINETUNED_DIR = Path(__file__).resolve().parents[3] / "models" / "vqa_finetuned"
BASE_MODEL = "Salesforce/blip-vqa-base"


@lru_cache(maxsize=1)
def _load_model():
    from transformers import BlipForQuestionAnswering, BlipProcessor

    source = str(FINETUNED_DIR) if FINETUNED_DIR.exists() else BASE_MODEL
    processor = BlipProcessor.from_pretrained(source)
    model = BlipForQuestionAnswering.from_pretrained(source)
    return processor, model


def answer_question(image_path, question: str) -> str:
    processor, model = _load_model()
    image = Image.open(image_path).convert("RGB")
    inputs = processor(image, question, return_tensors="pt")
    output = model.generate(**inputs, max_new_tokens=20)
    return processor.decode(output[0], skip_special_tokens=True)
