import numpy as np
from PIL import Image
from scipy import ndimage

TARGET_SIZE = 512
BLUR_SIGMA = 2.0
MIN_REGION_AREA = 150  # px, at TARGET_SIZE scale — filters noise specks


def _load_gray(image_path, size):
    img = Image.open(image_path).convert("RGB").resize((size, size))
    return np.asarray(img, dtype=np.float32), np.asarray(img.convert("L"), dtype=np.float32)


def detect_changes(before_path, after_path):
    before_rgb, before_gray = _load_gray(before_path, TARGET_SIZE)
    after_rgb, after_gray = _load_gray(after_path, TARGET_SIZE)

    diff = np.abs(ndimage.gaussian_filter(after_gray, BLUR_SIGMA) - ndimage.gaussian_filter(before_gray, BLUR_SIGMA))

    threshold = max(20.0, np.percentile(diff, 90))
    mask = diff > threshold

    labeled, n_regions = ndimage.label(mask)
    objects = ndimage.find_objects(labeled)

    changed_regions = []
    for i, sl in enumerate(objects, start=1):
        if sl is None:
            continue
        region_mask = labeled[sl] == i
        area = int(region_mask.sum())
        if area < MIN_REGION_AREA:
            continue
        y1, y2 = sl[0].start, sl[0].stop
        x1, x2 = sl[1].start, sl[1].stop
        changed_regions.append({
            "box": [
                round(x1 / TARGET_SIZE * 100, 1),
                round(y1 / TARGET_SIZE * 100, 1),
                round(x2 / TARGET_SIZE * 100, 1),
                round(y2 / TARGET_SIZE * 100, 1),
            ],
            "area_px": area,
        })

    changed_regions.sort(key=lambda r: r["area_px"], reverse=True)
    total_changed_pct = round(100.0 * mask.sum() / mask.size, 1)

    return {
        "changed_area_percent": total_changed_pct,
        "num_regions": len(changed_regions),
        "regions": changed_regions[:15],  # cap for response size
    }


def summarize(result):
    pct = result["changed_area_percent"]
    n = result["num_regions"]
    if n == 0:
        return "No significant changes detected between the two images."
    region_word = "region" if n == 1 else "regions"
    return (
        f"Detected {n} area{'s' if n != 1 else ''} of significant change "
        f"({region_word}), covering about {pct}% of the image."
    )
