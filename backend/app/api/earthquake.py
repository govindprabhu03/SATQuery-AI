from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_db import EarthquakeAnalysis
from app.services.earthquake_service import PlaceNotFound, analyze_earthquake_risk

router = APIRouter()


@router.get("/earthquake-risk")
def earthquake_risk(
    place: str = Query(..., min_length=1),
    years: int = Query(30, ge=1, le=100),
    radius_km: int = Query(200, ge=10, le=1000),
    db: Session = Depends(get_db),
):
    try:
        result = analyze_earthquake_risk(place, years, radius_km)
    except PlaceNotFound as e:
        raise HTTPException(404, str(e))

    db.add(
        EarthquakeAnalysis(
            place=result["place"],
            latitude=result["latitude"],
            longitude=result["longitude"],
            years=result["years"],
            radius_km=result["radius_km"],
            score=result["score"],
            level=result["level"],
            fault_name=result["fault_name"],
            fault_distance_km=result["fault_distance_km"],
            quake_count=result["quake_count"],
        )
    )
    db.commit()

    return result
