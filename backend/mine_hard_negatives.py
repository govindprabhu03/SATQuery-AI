"""
Extracts confirmed-negative 80x80 patches from real satellite scenes
(manually verified non-ship regions: breakwaters, artificial islands,
industrial platforms, beach/land) to hard-negative-mine the ship classifier.
Saves patches as a .npy array for train_ship_classifier.py to include.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCENES_DIR = ROOT / "datasets" / "ships" / "scenes"

CHIP = 80
WIDE_STRIDE = 40  # for large general land/beach areas
TIGHT_STRIDE = 6  # for small, specifically-confused false-positive regions

# (scene file, [(x1,y1,x2,y2,stride), ...] confirmed ship-free regions)
REGIONS = {
    "scene_1.png": [
        (1150, 1600, 1460, 1790, TIGHT_STRIDE),  # breakwater spit (false positive)
        (880, 630, 1080, 820, TIGHT_STRIDE),  # pier / dock pilings (false positive)
        (1300, 1500, 1460, 1660, TIGHT_STRIDE),  # pier corner (false positive)
        (0, 0, 550, 1777, WIDE_STRIDE),  # dense city / land
    ],
    "scene_2.png": [
        (930, 480, 1100, 640, TIGHT_STRIDE),  # round artificial island 1
        (1900, 970, 2070, 1140, TIGHT_STRIDE),  # round artificial island 2
        (830, 910, 990, 1080, TIGHT_STRIDE),  # rectangular industrial platform
        (400, 0, 1900, 150, WIDE_STRIDE),  # beach / land strip
    ],
}


def extract_patches(image_path, regions):
    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    arr = np.asarray(image, dtype=np.uint8)

    patches = []
    for x1, y1, x2, y2, stride in regions:
        x2, y2 = min(x2, width), min(y2, height)
        for y in range(y1, y2 - CHIP + 1, stride):
            for x in range(x1, x2 - CHIP + 1, stride):
                patches.append(arr[y : y + CHIP, x : x + CHIP])
    return patches


def main():
    all_patches = []
    for fname, regions in REGIONS.items():
        path = SCENES_DIR / fname
        if not path.exists():
            print(f"skip missing {fname}")
            continue
        patches = extract_patches(path, regions)
        print(f"{fname}: {len(patches)} negative patches")
        all_patches.extend(patches)

    out = np.stack(all_patches)
    out_path = ROOT / "datasets" / "ships" / "hard_negatives.npy"
    np.save(out_path, out)
    print(f"Saved {out.shape[0]} hard negatives to {out_path}")


if __name__ == "__main__":
    main()
