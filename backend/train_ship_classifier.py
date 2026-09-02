"""
Trains a ship/no-ship CNN classifier on the ShipsNet dataset
(4000 80x80 RGB chips: Hammell, "Ships in Satellite Imagery", CC BY-SA 4.0),
augmented with hard-negative patches mined from real scenes
(see mine_hard_negatives.py) to reduce false positives on
breakwaters/islands/coastline.

Usage: python train_ship_classifier.py
Reads:  ../datasets/ships/train.parquet
        ../datasets/ships/hard_negatives.npy (optional)
Writes: ../models/ship_classifier.pt
"""

import io
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "datasets" / "ships" / "train.parquet"
HARD_NEG_PATH = ROOT / "datasets" / "ships" / "hard_negatives.npy"
MODEL_PATH = ROOT / "models" / "ship_classifier.pt"

MAX_HARD_NEGATIVES = 2500


class ShipCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),  # 40x40
            nn.Conv2d(16, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),  # 20x20
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),  # 10x10
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


class ArrayDataset(Dataset):
    def __init__(self, images, labels):
        self.images = images
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        arr = self.images[idx].astype(np.float32) / 255.0
        tensor = torch.from_numpy(arr).permute(2, 0, 1)
        return tensor, self.labels[idx]


def load_shipsnet():
    df = pd.read_parquet(DATA_PATH)
    labels = (df["label"] == 0).astype(np.int64).to_numpy()  # 1 = ship
    images = np.stack(
        [
            np.asarray(Image.open(io.BytesIO(rec["bytes"])).convert("RGB"))
            for rec in df["image"]
        ]
    )
    return images, labels


def load_hard_negatives():
    if not HARD_NEG_PATH.exists():
        return None
    patches = np.load(HARD_NEG_PATH)
    if len(patches) > MAX_HARD_NEGATIVES:
        idx = np.random.RandomState(42).choice(
            len(patches), MAX_HARD_NEGATIVES, replace=False
        )
        patches = patches[idx]
    labels = np.zeros(len(patches), dtype=np.int64)  # 0 = no-ship
    return patches, labels


def main():
    print("Loading ShipsNet dataset...")
    images, labels = load_shipsnet()

    hard = load_hard_negatives()
    if hard is not None:
        hard_images, hard_labels = hard
        print(f"Adding {len(hard_images)} mined hard negatives")
        images = np.concatenate([images, hard_images])
        labels = np.concatenate([labels, hard_labels])

    print(f"Total examples: {len(labels)}  (ship={labels.sum()}, no-ship={(labels == 0).sum()})")

    train_idx, val_idx = train_test_split(
        np.arange(len(labels)), test_size=0.2, random_state=42, stratify=labels
    )

    train_ds = ArrayDataset(images[train_idx], labels[train_idx])
    val_ds = ArrayDataset(images[val_idx], labels[val_idx])

    train_loader = DataLoader(train_ds, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=64)

    # Class-weighted loss to correct for the no-ship majority after augmentation
    counts = np.bincount(labels[train_idx], minlength=2)
    class_weights = torch.tensor(counts.sum() / (2.0 * counts), dtype=torch.float32)
    print(f"Class weights (no-ship, ship): {class_weights.tolist()}")

    model = ShipCNN()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    epochs = 12
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for x, y in train_loader:
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * x.size(0)

        model.eval()
        correct, total = 0, 0
        tp = fp = fn = 0
        with torch.no_grad():
            for x, y in val_loader:
                pred = model(x).argmax(dim=1)
                correct += (pred == y).sum().item()
                total += y.size(0)
                tp += ((pred == 1) & (y == 1)).sum().item()
                fp += ((pred == 1) & (y == 0)).sum().item()
                fn += ((pred == 0) & (y == 1)).sum().item()
        val_acc = correct / total
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        print(
            f"Epoch {epoch + 1}/{epochs}  train_loss={total_loss / len(train_ds):.4f}  "
            f"val_acc={val_acc:.4f}  ship_precision={precision:.4f}  ship_recall={recall:.4f}"
        )

    MODEL_PATH.parent.mkdir(exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
