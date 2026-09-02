import re
from functools import lru_cache

from PIL import Image

STOPWORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "there",
    "this",
    "image",
    "many",
    "how",
    "of",
    "in",
    "on",
    "any",
}


@lru_cache(maxsize=1)
def _load_model():
    from transformers import OwlViTForObjectDetection, OwlViTProcessor

    processor = OwlViTProcessor.from_pretrained("google/owlvit-base-patch32")
    model = OwlViTForObjectDetection.from_pretrained("google/owlvit-base-patch32")
    return processor, model


def extract_target_label(question: str) -> str:
    words = re.findall(r"[a-zA-Z]+", question.lower())
    candidates = [w for w in words if w not in STOPWORDS]
    if not candidates:
        return "object"
    noun = candidates[-1]
    return noun.rstrip("s") if noun.endswith("s") and len(noun) > 3 else noun


def detect_objects(image_path, label: str, threshold: float = 0.1):
    processor, model = _load_model()
    image = Image.open(image_path).convert("RGB")

    inputs = processor(text=[[label]], images=image, return_tensors="pt")
    outputs = model(**inputs)

    target_sizes = [(image.height, image.width)]
    results = processor.post_process_grounded_object_detection(
        outputs, threshold=threshold, target_sizes=target_sizes
    )[0]

    objects = []
    for score, box in zip(results["scores"], results["boxes"]):
        x1, y1, x2, y2 = [round(v) for v in box.tolist()]
        objects.append(
            {
                "label": label,
                "confidence": round(score.item(), 3),
                "box": [x1, y1, x2, y2],
            }
        )

    objects.sort(key=lambda o: o["confidence"], reverse=True)
    return objects
