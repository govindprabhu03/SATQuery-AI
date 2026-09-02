from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_db import RegionAnalysis
from app.services.region_service import NoImageryFound, RegionNotFound, analyze_region, compute_periods

router = APIRouter()


class RegionRequest(BaseModel):
    place: str
    year_before: int = Field(..., ge=2015, le=2030)
    year_after: int = Field(..., ge=2015, le=2030)


def _row_to_result(row: RegionAnalysis) -> dict:
    return {
        "place_name": row.place_name,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "period_before": row.period_before,
        "period_after": row.period_after,
        "vegetated_pct_before": row.vegetated_pct_before,
        "vegetated_pct_after": row.vegetated_pct_after,
        "mean_ndvi_change": row.mean_ndvi_change,
        "scenes_used_before": row.scenes_used_before,
        "scenes_used_after": row.scenes_used_after,
        "narrative": row.narrative,
        "before_image_url": row.before_image_path,
        "after_image_url": row.after_image_path,
        "diff_image_url": row.diff_image_path,
        "cached": True,
    }


@router.post("/analyze-region")
def analyze_region_endpoint(req: RegionRequest, db: Session = Depends(get_db)):
    if req.year_after <= req.year_before:
        raise HTTPException(400, "year_after must be later than year_before")

    # Real satellite data for a fixed historical date range never changes,
    # so an identical (place, year_before, year_after) query is safe to
    # serve straight from the DB -- turns a ~15-40s live fetch into an
    # instant response for repeat/demo queries.
    period_before, period_after = compute_periods(req.year_before, req.year_after)
    cached = (
        db.query(RegionAnalysis)
        .filter(
            RegionAnalysis.place_name.ilike(req.place.strip()),
            RegionAnalysis.period_before == period_before,
            RegionAnalysis.period_after == period_after,
        )
        .order_by(RegionAnalysis.created_at.desc())
        .first()
    )
    if cached:
        return _row_to_result(cached)

    try:
        result = analyze_region(req.place, req.year_before, req.year_after)
    except RegionNotFound as e:
        raise HTTPException(404, str(e))
    except NoImageryFound as e:
        raise HTTPException(422, str(e))

    result["cached"] = False

    db.add(
        RegionAnalysis(
            place_name=result["place_name"],
            latitude=result["latitude"],
            longitude=result["longitude"],
            period_before=result["period_before"],
            period_after=result["period_after"],
            vegetated_pct_before=result["vegetated_pct_before"],
            vegetated_pct_after=result["vegetated_pct_after"],
            mean_ndvi_change=result["mean_ndvi_change"],
            scenes_used_before=result["scenes_used_before"],
            scenes_used_after=result["scenes_used_after"],
            narrative=result["narrative"],
            before_image_path=result["before_image_url"],
            after_image_path=result["after_image_url"],
            diff_image_path=result["diff_image_url"],
        )
    )
    db.commit()

    return result
