import re
from functools import lru_cache
from pathlib import Path

import torch
import torchvision
from PIL import Image
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

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

# NWPU VHR-10 -- real satellite/aerial object-detection benchmark this
# Faster R-CNN was fine-tuned on (see train_aerial_detector.py). Synonyms
# map loose user phrasing onto the 10 trained classes.
AERIAL_MODEL_PATH = Path(__file__).resolve().parents[3] / "models" / "aerial_detector.pt"
AERIAL_CLASS_NAMES = [
    "background",
    "airplane",
    "ship",
    "storage tank",
    "baseball diamond",
    "tennis court",
    "basketball court",
    "ground track field",
    "harbor",
    "bridge",
    "vehicle",
]
AERIAL_SYNONYMS = {
    "plane": "airplane",
    "aircraft": "airplane",
    "jet": "airplane",
    "boat": "ship",
    "vessel": "ship",
    "tank": "storage tank",
    "car": "vehicle",
    "truck": "vehicle",
    "van": "vehicle",
    "port": "harbor",
    "dock": "harbor",
    "court": "tennis court",
}
AERIAL_CONFIDENCE_THRESHOLD = 0.5


def _aerial_label_index(label: str):
    normalized = AERIAL_SYNONYMS.get(label, label)
    if normalized in AERIAL_CLASS_NAMES:
        return AERIAL_CLASS_NAMES.index(normalized), normalized
    return None, None


@lru_cache(maxsize=1)
def _load_aerial_model():
    model = torchvision.models.detection.fasterrcnn_mobilenet_v3_large_fpn(weights=None)
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, len(AERIAL_CLASS_NAMES))
    model.load_state_dict(torch.load(AERIAL_MODEL_PATH, map_location="cpu"))
    model.eval()
    return model


def _detect_aerial(image_path, label: str, class_idx: int):
    model = _load_aerial_model()
    image = Image.open(image_path).convert("RGB")
    tensor = torchvision.transforms.functional.to_tensor(image)

    with torch.no_grad():
        prediction = model([tensor])[0]

    objects = []
    for box, score, cls in zip(prediction["boxes"], prediction["scores"], prediction["labels"]):
        if int(cls) != class_idx or float(score) < AERIAL_CONFIDENCE_THRESHOLD:
            continue
        x1, y1, x2, y2 = [round(v) for v in box.tolist()]
        objects.append(
            {
                "label": label,
                "confidence": round(float(score), 3),
                "box": [x1, y1, x2, y2],
            }
        )

    objects.sort(key=lambda o: o["confidence"], reverse=True)
    return objects


@lru_cache(maxsize=1)
def _load_owlvit():
    from transformers import OwlViTForObjectDetection, OwlViTProcessor

    processor = OwlViTProcessor.from_pretrained("google/owlvit-base-patch32")
    model = OwlViTForObjectDetection.from_pretrained("google/owlvit-base-patch32")
    return processor, model


def _detect_owlvit(image_path, label: str, threshold: float = 0.1):
    processor, model = _load_owlvit()
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


def extract_target_label(question: str) -> str:
    words = re.findall(r"[a-zA-Z]+", question.lower())
    candidates = [w for w in words if w not in STOPWORDS]
    if not candidates:
        return "object"
    noun = candidates[-1]
    return noun.rstrip("s") if noun.endswith("s") and len(noun) > 3 else noun


def detect_objects(image_path, label: str, threshold: float = 0.1):
    class_idx, normalized_label = _aerial_label_index(label)
    if class_idx is not None:
        return _detect_aerial(image_path, normalized_label, class_idx)
    return _detect_owlvit(image_path, label, threshold)
