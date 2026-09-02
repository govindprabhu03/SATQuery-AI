# Dataset Research

Reference guide for every dataset used or evaluated for SatQuery AI, in priority order.

| Dataset | Status | Scale / Content | Feeds Into | Access |
|---|---|---|---|---|
| **ShipsNet** | Done | 4,000 labeled 80×80 ship/no-ship chips, Planet imagery (California) | Ship detector (99.1% val accuracy) | HF: `jonathan-roberts1/Ships-In-Satellite-Imagery` |
| **NWPU VHR-10** | Done | 800 images, 10 classes (plane, ship, tank, courts, fields, harbor, bridge, vehicle), Google Earth 0.5–2m | Multi-class aerial detector | HF mirror: `SGhazalS/nwpu-vhr10` |
| **RSICD** | Done | ~10,921 satellite images × 5 captions each | Fixes generic-caption problem on satellite photos | HF: `arampacha/rsicd` |
| **RSVQA-HR** | Done | Q&A pairs generated from Sentinel-2 / aerial imagery + OpenStreetMap | Fixes generic VQA answers on satellite photos | HF: `cpratikaki/RSVQA-HR_qwen_finetuning` |
| **DOTA v1.5** | Phase 2 | 2,806 images (up to 4000×4000px), 188k–403k instances, 16 categories, oriented boxes | Broader/rotated detection beyond NWPU's 10 classes | HF mirror: `benjamintli/dota-v1.5` (large) |
| **DIOR / DIOR-R** | Phase 2 | 23,463 images, 192,518 instances, 20 classes, 800×800 fixed | Alternative/complement to DOTA | HF: `danielz01/DIOR-RSVG` |
| **HRSC2016** | Phase 2 | 1,061 images, 6 harbors, oriented (rotated) ship boxes | Sharper ship boxes than axis-aligned ShipsNet model | Official release |
| **xBD** | Roadmap | 850,736 building annotations, pre/post-disaster image pairs, damage levels | Disaster damage assessment — flood/cyclone relevance | xview2.org (registration required) |
| **LEVIR-CD** | Roadmap | 637 image pairs, 1024×1024, 31,333 change instances, Google Earth | Learned change detection (current version uses classical image diffing) | HF: `ericyu/LEVIRCD_Cropped_256` |
| **ISRO Bhuvan** | Roadmap | India's own open satellite geoportal | Real Indian-geography validation/demo imagery | bhuvan.nrsc.gov.in |
| **SSDD (SAR)** | Roadmap | SAR ship detection dataset | Matches ISRO's RISAT (SAR) sensor family, all-weather/night | Academic mirrors |

## Notes

- **Ship detector**: trained on ShipsNet, then hard-negative-mined against real
  satellite scenes (breakwaters, piers, and artificial islands were confused
  for ships in early testing — patches from those exact regions were added as
  confirmed negatives). Measured **~83% precision / ~90% recall** on a real,
  previously-unseen harbor scene — not a validation-set number.
- **Multi-class detector**: fine-tunes a COCO-pretrained Faster R-CNN
  (MobileNetV3-FPN backbone) on NWPU VHR-10 rather than training from scratch.
- Datasets are not committed to this repository (several are multi-GB) — see
  `colab/SatQuery_AI_Training.ipynb`, which downloads and trains against all
  of them from a clean environment.
