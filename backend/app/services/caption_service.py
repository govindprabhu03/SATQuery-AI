from functools import lru_cache
from pathlib import Path

from PIL import Image

FINETUNED_DIR = Path(__file__).resolve().parents[3] / "models" / "caption_finetuned"
BASE_MODEL = "Salesforce/blip-image-captioning-base"


@lru_cache(maxsize=1)
def _load_model():
    from transformers import BlipForConditionalGeneration, BlipProcessor

    source = str(FINETUNED_DIR) if FINETUNED_DIR.exists() else BASE_MODEL
    processor = BlipProcessor.from_pretrained(source)
    model = BlipForConditionalGeneration.from_pretrained(source)
    return processor, model


def generate_caption(image_path) -> str:
    processor, model = _load_model()
    image = Image.open(image_path).convert("RGB")
    inputs = processor(image, return_tensors="pt")
    output = model.generate(**inputs, max_new_tokens=40)
    return processor.decode(output[0], skip_special_tokens=True)
