"""
Fine-tunes BLIP-VQA (Salesforce/blip-vqa-base) on RSVQA-HR -- real
satellite-imagery Q&A pairs (Lobry et al., 2020) -- to fix generic-photo
VQA answers on aerial/satellite imagery.

Usage: python train_vqa_finetune.py
Reads:  ../datasets/rsvqa_hr/data/train-*.parquet (uses a subset of shards)
Writes: ../models/vqa_finetuned/
"""

import io
from pathlib import Path

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from transformers import BlipForQuestionAnswering, BlipProcessor

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "datasets" / "rsvqa_hr" / "data"
OUT_DIR = ROOT / "models" / "vqa_finetuned"

N_SHARDS = 3  # ~1900 QA pairs per shard-group; keep runtime bounded on CPU
TRAIN_SUBSET = 2000
EPOCHS = 2
BATCH_SIZE = 4


class RSVQADataset(Dataset):
    def __init__(self, df):
        self.rows = df

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows.iloc[idx]
        image = Image.open(io.BytesIO(row["image"]["bytes"])).convert("RGB")
        return image, row["question"], str(row["answer"])


def collate(batch, processor):
    images, questions, answers = zip(*batch)
    inputs = processor(images=list(images), text=list(questions), padding=True, return_tensors="pt")
    labels = processor.tokenizer(list(answers), padding=True, return_tensors="pt").input_ids
    inputs["labels"] = labels
    return inputs


def main():
    print("Loading RSVQA-HR subset...")
    shard_files = sorted(DATA_DIR.glob("train-*.parquet"))[:N_SHARDS]
    df = pd.concat([pd.read_parquet(f) for f in shard_files], ignore_index=True)
    if len(df) > TRAIN_SUBSET:
        df = df.sample(n=TRAIN_SUBSET, random_state=42).reset_index(drop=True)
    print(f"Training on {len(df)} image-question-answer triples")

    start_epoch = 0
    progress_file = OUT_DIR / "progress.txt"
    if progress_file.exists():
        source = OUT_DIR
        start_epoch = int(progress_file.read_text().strip())
        print(f"Resuming from checkpoint at epoch {start_epoch}")
    else:
        source = "Salesforce/blip-vqa-base"

    processor = BlipProcessor.from_pretrained(source)
    model = BlipForQuestionAnswering.from_pretrained(source)

    ds = RSVQADataset(df)
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
