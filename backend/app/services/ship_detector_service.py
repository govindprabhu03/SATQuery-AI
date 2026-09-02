from functools import lru_cache
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image

MODEL_PATH = Path(__file__).resolve().parents[3] / "models" / "ship_classifier.pt"
CHIP_SIZE = 80
STRIDE = 10
CONFIDENCE_THRESHOLD = 0.96
IOU_THRESHOLD = 0.15
MAX_IMAGE_DIM = 3000

# Buildings in dense urban areas produce many tightly-packed false-positive
# "ships" (the classifier was never trained to explicitly reject buildings —
# see mine_hard_negatives.py). Real ships in open water are rarely this
# densely clustered, so treat a dense cluster as land/urban and drop it.
CLUSTER_RADIUS = 200
CLUSTER_SUPPRESS_THRESHOLD = 5


class ShipCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 10 * 10, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 2),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


@lru_cache(maxsize=1)
def _load_model():
    model = ShipCNN()
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()
    return model


def _nms(boxes, scores, iou_threshold):
    if not boxes:
        return []
    boxes_arr = np.array(boxes, dtype=np.float32)
    scores_arr = np.array(scores, dtype=np.float32)
    order = scores_arr.argsort()[::-1]

    x1, y1, x2, y2 = boxes_arr[:, 0], boxes_arr[:, 1], boxes_arr[:, 2], boxes_arr[:, 3]
    areas = (x2 - x1) * (y2 - y1)

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[1:][iou <= iou_threshold]

    return keep


def _suppress_dense_clusters(boxes, radius, min_neighbors):
    """Drop detections sitting in an unusually dense cluster (likely urban
    buildings, not ships)."""
    if not boxes:
        return []
    centers = np.array([[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] for b in boxes])
    keep = []
    for i in range(len(centers)):
        dists = np.linalg.norm(centers - centers[i], axis=1)
        neighbors = np.sum((dists > 0) & (dists <= radius))
        if neighbors < min_neighbors:
            keep.append(i)
    return keep


def detect_ships(image_path):
    model = _load_model()
    image = Image.open(image_path).convert("RGB")

    scale = min(1.0, MAX_IMAGE_DIM / max(image.width, image.height))
    if scale < 1.0:
        image = image.resize(
            (round(image.width * scale), round(image.height * scale))
        )

    width, height = image.size
    if width < CHIP_SIZE or height < CHIP_SIZE:
        return []

    arr = np.asarray(image, dtype=np.float32) / 255.0

    patches = []
    coords = []
    for y in range(0, height - CHIP_SIZE + 1, STRIDE):
        for x in range(0, width - CHIP_SIZE + 1, STRIDE):
            patches.append(arr[y : y + CHIP_SIZE, x : x + CHIP_SIZE])
            coords.append((x, y))

    if not patches:
        return []

    batch = torch.from_numpy(np.stack(patches)).permute(0, 3, 1, 2)

    all_probs = []
    with torch.no_grad():
        for i in range(0, batch.size(0), 256):
            chunk = batch[i : i + 256]
            logits = model(chunk)
            probs = torch.softmax(logits, dim=1)[:, 1]
            all_probs.append(probs)
    probs = torch.cat(all_probs).numpy()

    raw_boxes, raw_scores = [], []
    for (x, y), p in zip(coords, probs):
        if p >= CONFIDENCE_THRESHOLD:
            raw_boxes.append([x, y, x + CHIP_SIZE, y + CHIP_SIZE])
            raw_scores.append(float(p))

    keep = _nms(raw_boxes, raw_scores, IOU_THRESHOLD)
    kept_boxes = [raw_boxes[i] for i in keep]
    survivors = _suppress_dense_clusters(kept_boxes, CLUSTER_RADIUS, CLUSTER_SUPPRESS_THRESHOLD)
    keep = [keep[i] for i in survivors]

    objects = []
    for i in keep:
        x1, y1, x2, y2 = raw_boxes[i]
        objects.append(
            {
                "label": "ship",
                "confidence": round(raw_scores[i], 3),
                "box": [round(v / scale) for v in (x1, y1, x2, y2)],
            }
        )

    objects.sort(key=lambda o: o["confidence"], reverse=True)
    return objects
