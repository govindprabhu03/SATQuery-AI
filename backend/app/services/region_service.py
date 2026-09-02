"""
Analyzes a named place over time using real Sentinel-2 satellite data --
no upload required. Geocodes the place name, pulls cloud-free Sentinel-2
scenes from Microsoft's Planetary Computer STAC catalog for two periods,
computes NDVI (vegetation index) mosaics, and reports the change.

Two data-correctness issues were found and fixed while building this:
1. A single lowest-cloud scene per period can land in different, non-
   overlapping UTM tiles -- always mosaic multiple scenes over the exact
   query bbox instead of picking one "best" scene.
2. Sentinel-2 L2A products from processing baseline 04.00+ (2022-01-25
   onward) carry a +1000 DN offset ESA added to avoid negative reflectance
   values. Comparing a pre-2022 period against a post-2022 period without
   removing that offset makes NDVI look like it dropped ~0.08 across the
   board even with zero real change -- confirmed by checking `s2:processing_baseline`
   on real items (2020 scenes: 02.12, 2025 scenes: 05.11).
"""

import io
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import odc.stac
import pandas as pd
import planetary_computer
import pystac_client
import requests
from PIL import Image

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
RESOLUTION_M = 120  # keep pixel count small -- this is a regional overview, not a pixel-precise map
AOI_PAD_DEG = 0.08  # ~9km half-width box around the geocoded point
MAX_SCENES_PER_PERIOD = 4  # fewer scenes = faster fetch; still enough for a clean cloud-free median
CLOUD_COVER_MAX = 40

# Sentinel-2 Scene Classification Layer codes to exclude from the composite
BAD_SCL = {0, 1, 3, 8, 9, 10, 11}  # nodata, saturated, cloud shadow, cloud (med/high), cirrus, snow

# ESA baseline 04.00+ (2022-01-25 onward) applies a +1000 DN offset
BASELINE_OFFSET_START = "04.00"

OUTPUT_DIR = Path(__file__).resolve().parents[3] / "uploads" / "region"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class RegionNotFound(Exception):
    pass


class NoImageryFound(Exception):
    pass


def geocode(place: str):
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": place, "format": "json", "limit": 1},
        headers={"User-Agent": "SatQueryAI/1.0 (satquery-ai hackathon project)"},
        timeout=15,
    )
    r.raise_for_status()
    results = r.json()
    if not results:
        raise RegionNotFound(f"Couldn't find a location for '{place}'")
    d = results[0]
    lat, lon = float(d["lat"]), float(d["lon"])
    bbox = [lon - AOI_PAD_DEG, lat - AOI_PAD_DEG, lon + AOI_PAD_DEG, lat + AOI_PAD_DEG]
    return bbox, lat, lon


def _needs_offset_correction(item) -> bool:
    baseline = item.properties.get("s2:processing_baseline", "00.00")
    return baseline >= BASELINE_OFFSET_START


def _ndvi_mosaic(bbox, date_range: str):
    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    items = list(
        catalog.search(
            collections=["sentinel-2-l2a"],
            bbox=bbox,
            datetime=date_range,
            query={"eo:cloud_cover": {"lt": CLOUD_COVER_MAX}},
        ).items()
    )
    if not items:
        raise NoImageryFound(f"No usable Sentinel-2 scenes found for {date_range}")
    items = items[:MAX_SCENES_PER_PERIOD]

    ds = odc.stac.load(items, bands=["red", "nir", "SCL"], bbox=bbox, resolution=RESOLUTION_M, chunks={})
    red = ds["red"].astype("float32")
    nir = ds["nir"].astype("float32")
    scl = ds["SCL"]

    # odc.stac.load can merge items that share an exact acquisition
    # timestamp (e.g. two adjacent MGRS tiles from one satellite overpass),
    # so the loaded "time" dimension isn't guaranteed to be 1:1 with
    # `items` by position -- match correction need by timestamp instead of
    # list index, or a merged slice silently gets the wrong item's data
    # (or an out-of-bounds index once items collapse to fewer time steps).
    item_needs_correction = {
        pd.Timestamp(item.datetime).tz_convert(None): _needs_offset_correction(item) for item in items
    }
    item_timestamps = list(item_needs_correction.keys())

    for i, t in enumerate(red["time"].values):
        ts = pd.Timestamp(t)
        nearest = min(item_timestamps, key=lambda k: abs((k - ts).total_seconds()))
        if item_needs_correction[nearest]:
            red[i] = (red[i] - 1000).clip(min=0)
            nir[i] = (nir[i] - 1000).clip(min=0)

    bad_mask = scl.isin(list(BAD_SCL))
    red = red.where(~bad_mask)
    nir = nir.where(~bad_mask)

    ndvi = ((nir - red) / (nir + red + 1e-6)).median(dim="time", skipna=True)
    return ndvi.values, len(items)


def _ndvi_to_rgb(ndvi: np.ndarray) -> np.ndarray:
    """Diverging colormap: water/bare (blue-brown) -> sparse (yellow) -> dense veg (dark green)."""
    stops = np.array([-0.2, 0.0, 0.2, 0.4, 0.6, 0.8])
    colors = np.array(
        [
            [30, 60, 130],   # water
            [140, 100, 60],  # bare soil / built-up
            [210, 190, 60],  # sparse vegetation
            [140, 190, 60],  # moderate vegetation
            [60, 150, 50],   # dense vegetation
            [20, 90, 30],    # very dense vegetation
        ],
        dtype=np.float32,
    )
    flat = np.nan_to_num(ndvi, nan=-0.2).clip(stops[0], stops[-1]).ravel()
    r = np.interp(flat, stops, colors[:, 0])
    g = np.interp(flat, stops, colors[:, 1])
    b = np.interp(flat, stops, colors[:, 2])
    rgb = np.stack([r, g, b], axis=-1).reshape(*ndvi.shape, 3).astype(np.uint8)
    return rgb


def _save_ndvi_png(ndvi: np.ndarray, name: str, upscale: int = 4) -> str:
    rgb = _ndvi_to_rgb(ndvi)
    img = Image.fromarray(rgb, mode="RGB")
    img = img.resize((img.width * upscale, img.height * upscale), Image.NEAREST)
    path = OUTPUT_DIR / name
    img.save(path)
    return f"/region-images/{name}"


CHANGE_DEADZONE = 0.06  # NDVI diffs smaller than this are scene-to-scene noise, not real change


def _save_diff_png(diff: np.ndarray, name: str, upscale: int = 4) -> str:
    # red = vegetation loss, green = vegetation gain, gray = below the noise floor
    from scipy import ndimage

    norm = ndimage.uniform_filter(np.nan_to_num(diff, nan=0.0), size=3)
    intensity = np.clip((np.abs(norm) - CHANGE_DEADZONE) / 0.3, 0, 1)
    rgb = np.full((*norm.shape, 3), 90, dtype=np.float32)
    loss = norm < 0
    gain = norm >= 0
    rgb[..., 0] = np.where(loss, 90 + intensity * 165, 90 - intensity * 60)
    rgb[..., 1] = np.where(gain, 90 + intensity * 165, 90 - intensity * 60)
    rgb[..., 2] = 90 - intensity * 60
    img = Image.fromarray(rgb.clip(0, 255).astype(np.uint8), mode="RGB")
    img = img.resize((img.width * upscale, img.height * upscale), Image.NEAREST)
    path = OUTPUT_DIR / name
    img.save(path)
    return f"/region-images/{name}"


def _generate_narrative(place, veg_before, veg_after, mean_change, year_before, year_after) -> str:
    from app.services.gemini_service import GEMINI_API_KEY, GEMINI_URL

    direction = "increased" if mean_change > 0 else "decreased"
    prompt = (
        f"You are a remote sensing analyst. Between {year_before} and {year_after}, "
        f"satellite-derived vegetation cover (NDVI) in {place} {direction} from "
        f"{veg_before:.1f}% to {veg_after:.1f}% of the analyzed area (mean NDVI change: "
        f"{mean_change:+.3f}). Write a 2-3 sentence plain-language summary of what this "
        f"likely reflects on the ground (e.g. urbanization, agriculture cycles, deforestation, "
        f"seasonal effects, or reforestation), being appropriately cautious since this is a "
        f"single regional average, not ground-truthed."
    )
    if not GEMINI_API_KEY:
        return (
            f"Vegetated area in {place} went from {veg_before:.1f}% to {veg_after:.1f}% "
            f"between {year_before} and {year_after} (mean NDVI change: {mean_change:+.3f})."
        )
    try:
        resp = requests.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return (
            f"Vegetated area in {place} went from {veg_before:.1f}% to {veg_after:.1f}% "
            f"between {year_before} and {year_after} (mean NDVI change: {mean_change:+.3f})."
        )


def compute_periods(year_before: int, year_after: int, months=(1, 2, 3)):
    m1, m2 = f"{months[0]:02d}", f"{months[-1]:02d}"
    day2 = "31" if months[-1] in (1, 3, 5, 7, 8, 10, 12) else "30"
    period_before = f"{year_before}-{m1}-01/{year_before}-{m2}-{day2}"
    period_after = f"{year_after}-{m1}-01/{year_after}-{m2}-{day2}"
    return period_before, period_after


def analyze_region(place: str, year_before: int, year_after: int, months=(1, 2, 3)):
    bbox, lat, lon = geocode(place)
    period_before, period_after = compute_periods(year_before, year_after, months)

    # The two periods are independent network+compute fetches -- run them
    # concurrently instead of sequentially, since almost all the time is
    # spent waiting on STAC search + Azure blob reads (I/O releases the GIL).
    with ThreadPoolExecutor(max_workers=2) as pool:
        future_before = pool.submit(_ndvi_mosaic, bbox, period_before)
        future_after = pool.submit(_ndvi_mosaic, bbox, period_after)
        ndvi_before, n_before = future_before.result()
        ndvi_after, n_after = future_after.result()

    diff = ndvi_after - ndvi_before
    veg_before = float(np.nanmean(ndvi_before > 0.3) * 100)
    veg_after = float(np.nanmean(ndvi_after > 0.3) * 100)
    mean_change = float(np.nanmean(diff))

    token = f"{abs(hash((place, year_before, year_after))):x}"
    before_url = _save_ndvi_png(ndvi_before, f"{token}_before.png")
    after_url = _save_ndvi_png(ndvi_after, f"{token}_after.png")
    diff_url = _save_diff_png(diff, f"{token}_diff.png")

    narrative = _generate_narrative(place, veg_before, veg_after, mean_change, year_before, year_after)

    return {
        "place_name": place,
        "latitude": lat,
        "longitude": lon,
        "period_before": period_before,
        "period_after": period_after,
        "vegetated_pct_before": round(veg_before, 1),
        "vegetated_pct_after": round(veg_after, 1),
        "mean_ndvi_change": round(mean_change, 4),
        "scenes_used_before": n_before,
        "scenes_used_after": n_after,
        "narrative": narrative,
        "before_image_url": before_url,
        "after_image_url": after_url,
        "diff_image_url": diff_url,
    }
