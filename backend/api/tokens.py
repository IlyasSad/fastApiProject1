from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend import schemas, crud
from backend.database import get_db

router = APIRouter(
    prefix="/api/tokens",
    tags=["tokens"],
)

@router.get("/", response_model=List[schemas.Token])
def read_tokens(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tokens = crud.get_tokens(db, skip=skip, limit=limit)
    return tokens

@router.get("/{chain_id}", response_model=List[schemas.Token])
def read_tokens_by_chain(chain_id: int, db: Session = Depends(get_db)):
    tokens = crud.get_tokens_by_chain(db, chain_id=chain_id)
    if not tokens:
         # Возвращаем пустой список, если нет токенов для этой сети
         # Или можно вернуть 404, если сеть не поддерживается вообще
         return [] # HTTPException(status_code=404, detail=f"Tokens not found for chain ID {chain_id}")
    return tokens

# Можно добавить POST /api/tokens/ для добавления токенов вручную через админку или API
# @router.post("/", response_model=schemas.Token)
# def create_token(token: schemas.TokenCreate, db: Session = Depends(get_db)):
#     db_token = crud.create_token(db=db, token=token)
#     return db_token