from fastapi import APIRouter, Depends, Body, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel # Для моделей запросов
from backend.database import get_db
from backend.telegram_bot.operations_notifier import process_swap_notification, process_bridge_notification

# Импортируем новые функции обработки уведомлений

router = APIRouter(prefix="/api/notify", tags=["Notifications"]) # Изменил префикс для ясности

# Pydantic модели для тел запросов (могут быть в schemas.py)
class SwapNotificationPayload(BaseModel):
    walletAddress: str
    fromTokenSymbol: str
    toTokenSymbol: str
    fromAmountStr: str
    toAmountStr: str
    networkName: str # Имя сети, где произошел свап
    transactionHash: str
    explorerUrlBase: str # Базовый URL эксплорера для сети свапа

class BridgeNotificationPayload(BaseModel):
    walletAddress: str
    fromTokenSymbol: str
    toTokenSymbol: str
    fromAmountStr: str
    toAmountStr: str # Приблизительная сумма получения
    fromNetworkName: str
    toNetworkName: str
    transactionHashFrom: str # Хэш транзакции в исходной сети
    explorerUrlBaseFrom: str


@router.post("/swap_completed")
async def notify_swap_completed(payload: SwapNotificationPayload, db: Session = Depends(get_db)):
    try:
        await process_swap_notification(
            db=db,
            wallet_address=payload.walletAddress,
            from_token_symbol=payload.fromTokenSymbol,
            to_token_symbol=payload.toTokenSymbol,
            from_amount_str=payload.fromAmountStr,
            to_amount_str=payload.toAmountStr,
            network_name=payload.networkName,
            transaction_hash=payload.transactionHash,
            explorer_url_base=payload.explorerUrlBase
        )
        return {"status": "success", "message": "Swap notification processed."}
    except Exception as e:
        print(f"Error processing swap notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to process swap notification.")


@router.post("/bridge_initiated")
async def notify_bridge_initiated(payload: BridgeNotificationPayload, db: Session = Depends(get_db)):
    try:
        await process_bridge_notification(
            db=db,
            wallet_address=payload.walletAddress,
            from_token_symbol=payload.fromTokenSymbol,
            to_token_symbol=payload.toTokenSymbol,
            from_amount_str=payload.fromAmountStr,
            to_amount_str=payload.toAmountStr,
            from_network_name=payload.fromNetworkName,
            to_network_name=payload.toNetworkName,
            transaction_hash_from=payload.transactionHashFrom,
            explorer_url_base_from=payload.explorerUrlBaseFrom
        )
        return {"status": "success", "message": "Bridge initiated notification processed."}
    except Exception as e:
        print(f"Error processing bridge notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to process bridge notification.")

