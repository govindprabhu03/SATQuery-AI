# Roadmap & Pitch Guidance

## What to say

- "We trained a ship detector from scratch on the ShipsNet benchmark, then
  hard-negative-mined it against real satellite scenes — measured 83%
  precision / 90% recall on imagery it never saw during training."
- "Captioning and VQA use BLIP; we fine-tuned it on RSICD/RSVQA specifically
  because generic photo-captioning models perform poorly on overhead
  imagery — here's the before/after."
- "For object classes outside our trained set, we fall back to
  open-vocabulary zero-shot detection — lower accuracy, but never a hard
  failure."
- "Here is our roadmap to a production system: DOTA/DIOR for broader class
  coverage, xBD for disaster damage assessment, SAR data to match ISRO's
  RISAT sensors."

## What not to say

- Do not claim 100% accuracy, or that any capability is guaranteed correct —
  no vision-language system achieves this, and a judge who tests one
  adversarial image will find the gap.
- Do not present a metric that was not measured on real, previously-unseen
  imagery — validation-set numbers and real-scene numbers should both be
  shown, and be different (that difference is expected and fine to say out
  loud).
- Do not claim this replaces or matches ISRO's own production
  remote-sensing systems — position it as a well-engineered assistive
  prototype with a credible path forward, built on the same public
  benchmarks real remote-sensing researchers use.

## Roadmap

1. **Broader detection coverage** — DOTA / DIOR (15–23 classes, oriented
   boxes) instead of NWPU's fixed 10.
2. **Oriented ship boxes** — HRSC2016, since axis-aligned boxes undersell
   ships photographed at an angle.
3. **Disaster response** — xBD (building damage assessment) or LEVIR-CD
   (learned change detection) to replace the current classical
   image-differencing approach with a trained model.
4. **SAR imagery** — SSDD or similar, to match ISRO's RISAT sensor family
   and enable all-weather, day/night monitoring.
5. **India-specific validation** — imagery sourced from ISRO's Bhuvan
   portal, so accuracy claims are demonstrated on the exact geography and
   sensor conditions relevant to the intended deployment.
