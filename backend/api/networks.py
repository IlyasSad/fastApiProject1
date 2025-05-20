from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import schemas
from backend.crud import get_networks
from backend.database import get_db


router = APIRouter(
    prefix="/api",  # Если хочешь общий префикс для API эндпоинтов
    tags=["networks"],  # Для FastAPI Swagger UI
)


@router.get("/networks", response_model=List[schemas.NetworkInfo])
async def get_supported_networks_from_db(db: Session = Depends(get_db)):

    db_networks = get_networks(db)

    if not db_networks:
        raise HTTPException(status_code=404, detail="No supported networks found in the database.")

    return db_networks

