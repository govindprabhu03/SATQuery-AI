"""
Fine-tunes BLIP image captioning (Salesforce/blip-image-captioning-base) on
RSICD -- a real satellite-image captioning benchmark (Lu et al., 2017) --
to fix generic-photo captions on aerial/satellite imagery.

Usage: python train_caption_finetune.py
Reads:  ../datasets/rsicd/data/{train,valid}-*.parquet
Writes: ../models/caption_finetuned/
"""

import io
from pathlib import Path

import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
import pandas as pd
from transformers import BlipForConditionalGeneration, BlipProcessor

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "datasets" / "rsicd" / "data"
OUT_DIR = ROOT / "models" / "caption_finetuned"

TRAIN_SUBSET = 1500  # keep runtime bounded on CPU
EPOCHS = 2
BATCH_SIZE = 4


class RSICDDataset(Dataset):
    def __init__(self, df, processor):
        self.rows = df
        self.processor = processor

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows.iloc[idx]
        image = Image.open(io.BytesIO(row["image"]["bytes"])).convert("RGB")
        caption = row["captions"][0]
        return image, caption


def collate(batch, processor):
    images, captions = zip(*batch)
    inputs = processor(images=list(images), text=list(captions), padding=True, return_tensors="pt")
    inputs["labels"] = inputs["input_ids"].clone()
    return inputs


def main():
    print("Loading RSICD...")
    df = pd.read_parquet(DATA_DIR / "train-00000-of-00001.parquet")
    if len(df) > TRAIN_SUBSET:
        df = df.sample(n=TRAIN_SUBSET, random_state=42).reset_index(drop=True)
    print(f"Training on {len(df)} image-caption pairs")

    start_epoch = 0
    progress_file = OUT_DIR / "progress.txt"
    if progress_file.exists():
        source = OUT_DIR
        start_epoch = int(progress_file.read_text().strip())
        print(f"Resuming from checkpoint at epoch {start_epoch}")
    else:
        source = "Salesforce/blip-image-captioning-base"

    processor = BlipProcessor.from_pretrained(source)
    model = BlipForConditionalGeneration.from_pretrained(source)

    ds = RSICDDataset(df, processor)
    loader = DataLoader(
        ds, batch_size=BATCH_SIZE, shuffle=True,
        collate_fn=lambda b: collate(b, processor),
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-6)

    model.train()
    for epoch in range(start_epoch, EPOCHS):
        total_loss = 0.0
        n = 0
        for batch in loader:
            outputs = model(**batch)
            loss = outputs.loss
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n += 1
            if n % 50 == 0:
                print(f"  epoch {epoch + 1} batch {n}/{len(loader)}  loss={loss.item():.4f}")
            if n % 50 == 0:
                OUT_DIR.mkdir(parents=True, exist_ok=True)
                model.save_pretrained(OUT_DIR)
                processor.save_pretrained(OUT_DIR)
                progress_file.write_text(str(epoch))  # epoch not yet complete
                print(f"Mid-epoch checkpoint saved ({n}/{len(loader)} batches)")

        print(f"Epoch {epoch + 1}/{EPOCHS}  avg_loss={total_loss / n:.4f}")

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        model.save_pretrained(OUT_DIR)
        processor.save_pretrained(OUT_DIR)
        progress_file.write_text(str(epoch + 1))
        print(f"Checkpoint saved to {OUT_DIR} (epoch {epoch + 1})")

    print("Training complete.")


if __name__ == "__main__":
    main()
