"""
Trains a small U-Net to predict pixel-level change masks from LEVIR-CD --
real satellite building-change-detection pairs (Chen & Shi, 2020) -- to
replace the naive blur/threshold heuristic with a learned model.

Usage: python train_change_detection.py
Reads:  ../datasets/levir_cd/data/{train,val}-*.parquet  (imageA, imageB, label)
Writes: ../models/change_detector.pt
"""

import io
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "datasets" / "levir_cd" / "data"
MODEL_PATH = ROOT / "models" / "change_detector.pt"

IMG_SIZE = 256
TRAIN_SUBSET = 1200  # keep runtime bounded on CPU
EPOCHS = 2
BATCH_SIZE = 4


class LEVIRDataset(Dataset):
    def __init__(self, df):
        self.rows = df

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows.iloc[idx]
        a = Image.open(io.BytesIO(row["imageA"]["bytes"])).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
        b = Image.open(io.BytesIO(row["imageB"]["bytes"])).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
        m = Image.open(io.BytesIO(row["label"]["bytes"])).convert("L").resize((IMG_SIZE, IMG_SIZE))

        a_t = torch.from_numpy(np.asarray(a, dtype=np.float32) / 255.0).permute(2, 0, 1)
        b_t = torch.from_numpy(np.asarray(b, dtype=np.float32) / 255.0).permute(2, 0, 1)
        mask_t = torch.from_numpy((np.asarray(m, dtype=np.float32) > 127).astype(np.float32)).unsqueeze(0)

        return torch.cat([a_t, b_t], dim=0), mask_t


def conv_block(in_ch, out_ch):
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, 3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, 3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
    )


class SmallUNet(nn.Module):
    """Compact U-Net: 6-channel (before+after RGB) -> 1-channel change mask logits."""

    def __init__(self):
        super().__init__()
        self.enc1 = conv_block(6, 16)
        self.enc2 = conv_block(16, 32)
        self.enc3 = conv_block(32, 64)
        self.pool = nn.MaxPool2d(2)

        self.bottleneck = conv_block(64, 128)

        self.up3 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec3 = conv_block(128, 64)
        self.up2 = nn.ConvTranspose2d(64, 32, 2, stride=2)
        self.dec2 = conv_block(64, 32)
        self.up1 = nn.ConvTranspose2d(32, 16, 2, stride=2)
        self.dec1 = conv_block(32, 16)

        self.out = nn.Conv2d(16, 1, 1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))

        d3 = self.dec3(torch.cat([self.up3(b), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))

        return self.out(d1)


def main():
    print("Loading LEVIR-CD subset...")
    train_files = sorted(DATA_DIR.glob("train-*.parquet"))
    df = pd.concat([pd.read_parquet(f) for f in train_files], ignore_index=True)
    if len(df) > TRAIN_SUBSET:
        df = df.sample(n=TRAIN_SUBSET, random_state=42).reset_index(drop=True)
    print(f"Training on {len(df)} before/after/mask triples")

    loader = DataLoader(LEVIRDataset(df), batch_size=BATCH_SIZE, shuffle=True)

    model = SmallUNet()
    start_epoch = 0
    progress_file = MODEL_PATH.with_suffix(".progress")
    if MODEL_PATH.exists() and progress_file.exists():
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        start_epoch = int(progress_file.read_text().strip())
        print(f"Resuming from checkpoint at epoch {start_epoch}")

    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCEWithLogitsLoss()

    model.train()
    for epoch in range(start_epoch, EPOCHS):
        total_loss = 0.0
        n = 0
        for images, masks in loader:
            logits = model(images)
            loss = criterion(logits, masks)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n += 1
            if n % 50 == 0:
                print(f"  epoch {epoch + 1} batch {n}/{len(loader)}  loss={loss.item():.4f}")
                MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), MODEL_PATH)
                progress_file.write_text(str(epoch))  # epoch not yet complete
                print(f"Mid-epoch checkpoint saved ({n}/{len(loader)} batches)")

        print(f"Epoch {epoch + 1}/{EPOCHS}  avg_loss={total_loss / n:.4f}")
        torch.save(model.state_dict(), MODEL_PATH)
        progress_file.write_text(str(epoch + 1))
        print(f"Checkpoint saved to {MODEL_PATH} (epoch {epoch + 1})")

    print("Training complete.")


if __name__ == "__main__":
    main()
