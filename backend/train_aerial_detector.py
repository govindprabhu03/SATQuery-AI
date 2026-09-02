"""
Fine-tunes a Faster R-CNN (MobileNetV3-FPN backbone, COCO-pretrained) on
NWPU VHR-10 -- a real, peer-reviewed aerial imagery object detection
benchmark (Cheng & Han, 2016), 10 classes:

  1 airplane   2 ship        3 storage tank   4 baseball diamond
  5 tennis court  6 basketball court  7 ground track field
  8 harbor     9 bridge      10 vehicle

Usage: python train_aerial_detector.py
Reads:  ../datasets/nwpu_vhr10/NWPU VHR-10 dataset/{positive image set, ground truth}
Writes: ../models/aerial_detector.pt
"""

import re
from pathlib import Path

import torch
import torchvision
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "datasets" / "nwpu_vhr10" / "NWPU VHR-10 dataset"
IMAGES_DIR = DATA_DIR / "positive image set"
GT_DIR = DATA_DIR / "ground truth"
MODEL_PATH = ROOT / "models" / "aerial_detector.pt"

CLASS_NAMES = [
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
NUM_CLASSES = len(CLASS_NAMES)  # 10 objects + background

BOX_RE = re.compile(r"\((\d+),(\d+)\),\((\d+),(\d+)\),(\d+)")


def parse_gt(txt_path):
    boxes, labels = [], []
    for line in txt_path.read_text().splitlines():
        m = BOX_RE.search(line)
        if not m:
            continue
        x1, y1, x2, y2, cls = map(int, m.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        boxes.append([x1, y1, x2, y2])
        labels.append(cls)
    return boxes, labels


class NWPUDataset(Dataset):
    def __init__(self, ids):
        self.ids = ids

    def __len__(self):
        return len(self.ids)

    def __getitem__(self, idx):
        img_id = self.ids[idx]
        image = Image.open(IMAGES_DIR / f"{img_id}.jpg").convert("RGB")
        boxes, labels = parse_gt(GT_DIR / f"{img_id}.txt")

        tensor = torchvision.transforms.functional.to_tensor(image)
        boxes_t = torch.tensor(boxes, dtype=torch.float32).reshape(-1, 4)
        labels_t = torch.tensor(labels, dtype=torch.int64).reshape(-1)
        target = {
            "boxes": boxes_t,
            "labels": labels_t,
            "image_id": torch.tensor([idx]),
        }
        return tensor, target


def collate_fn(batch):
    return tuple(zip(*batch))


def build_model():
    model = torchvision.models.detection.fasterrcnn_mobilenet_v3_large_fpn(
        weights="DEFAULT"
    )
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, NUM_CLASSES)
    return model


def box_iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


@torch.no_grad()
def evaluate(model, loader, score_thresh=0.5, iou_thresh=0.5):
    model.eval()
    tp = fp = fn = 0
    for images, targets in loader:
        preds = model(list(images))
        for pred, target in zip(preds, targets):
            gt_boxes = target["boxes"].tolist()
            gt_labels = target["labels"].tolist()
            matched = [False] * len(gt_boxes)

            keep = pred["scores"] >= score_thresh
            pred_boxes = pred["boxes"][keep].tolist()
            pred_labels = pred["labels"][keep].tolist()

            for pbox, plabel in zip(pred_boxes, pred_labels):
                best_iou, best_j = 0.0, -1
                for j, (gbox, glabel) in enumerate(zip(gt_boxes, gt_labels)):
                    if matched[j] or glabel != plabel:
                        continue
                    iou = box_iou(pbox, gbox)
                    if iou > best_iou:
                        best_iou, best_j = iou, j
                if best_iou >= iou_thresh:
                    matched[best_j] = True
                    tp += 1
                else:
                    fp += 1
            fn += matched.count(False)

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    return precision, recall


def main():
    ids = sorted(p.stem for p in IMAGES_DIR.glob("*.jpg"))
    split = int(len(ids) * 0.85)
    train_ids, val_ids = ids[:split], ids[split:]
    print(f"Train: {len(train_ids)}  Val: {len(val_ids)}")

    train_loader = DataLoader(
        NWPUDataset(train_ids), batch_size=4, shuffle=True, collate_fn=collate_fn
    )
    val_loader = DataLoader(
        NWPUDataset(val_ids), batch_size=2, shuffle=False, collate_fn=collate_fn
    )

    model = build_model()
    start_epoch = 0
    if MODEL_PATH.exists():
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        progress = MODEL_PATH.with_suffix(".progress")
        if progress.exists():
            start_epoch = int(progress.read_text().strip())
        print(f"Resuming from checkpoint at epoch {start_epoch}")

    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.SGD(params, lr=0.005, momentum=0.9, weight_decay=5e-4)
    lr_scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=6, gamma=0.1)
    for _ in range(start_epoch):
        lr_scheduler.step()

    epochs = 15
    for epoch in range(start_epoch, epochs):
        model.train()
        total_loss = 0.0
        n_batches = 0
        for images, targets in train_loader:
            loss_dict = model(list(images), list(targets))
            loss = sum(loss_dict.values())
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1
            if n_batches % 30 == 0:
                MODEL_PATH.parent.mkdir(exist_ok=True)
                torch.save(model.state_dict(), MODEL_PATH)
                MODEL_PATH.with_suffix(".progress").write_text(str(epoch))  # epoch not yet complete
                print(f"Mid-epoch checkpoint saved ({n_batches}/{len(train_loader)} batches)")

        lr_scheduler.step()
        precision, recall = evaluate(model, val_loader)
        print(
            f"Epoch {epoch + 1}/{epochs}  loss={total_loss / n_batches:.4f}  "
            f"val_precision={precision:.4f}  val_recall={recall:.4f}"
        )

        MODEL_PATH.parent.mkdir(exist_ok=True)
        torch.save(model.state_dict(), MODEL_PATH)
        MODEL_PATH.with_suffix(".progress").write_text(str(epoch + 1))
        print(f"Checkpoint saved to {MODEL_PATH} (epoch {epoch + 1})")

    print("Training complete.")


if __name__ == "__main__":
    main()
