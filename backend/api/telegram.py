from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from web3 import Web3 # Для валидации адреса
import re # Для валидации адреса

from backend import schemas, crud
from backend.database import get_db
from backend.config import settings # Получаем имя бота из настроек

router = APIRouter(
    prefix="/api/telegram",
    tags=["telegram"],
)

# Вспомогательная функция для валидации и нормализации адреса
def validate_and_checksum_address(address: str):
    if not re.match(r'^0x[a-fA-F0-9]{40}$', address):
        raise HTTPException(status_code=400, detail="Invalid wallet address format.")
    try:
        return Web3.toChecksumAddress(address)
    except ValueError:
         # Should not happen if regex matches, but as a fallback
         raise HTTPException(status_code=400, detail="Invalid wallet address format.")


@router.get("/status", response_model=schemas.TelegramStatusResponse)
def get_telegram_status(address: str, db: Session = Depends(get_db)):
    checksum_address = validate_and_checksum_address(address)
    telegram_link = crud.get_telegram_link_by_wallet(db, checksum_address)

    if telegram_link and telegram_link.status == "linked":
        return {"is_linked": True, "telegram_username": telegram_link.telegram_username}
    else:
        return {"is_linked": False, "telegram_username": None}


@router.post("/link/request", response_model=schemas.TelegramLinkResponse)
def request_telegram_link(request: schemas.TelegramLinkRequest, db: Session = Depends(get_db)):
    checksum_address = validate_and_checksum_address(request.wallet_address)

    link_entry, status = crud.create_telegram_link_request(db, checksum_address)

    if status == "already_linked":
        return {"success": False, "message": f"Этот кошелек уже связан с Telegram (@{link_entry.telegram_username})."}
    elif status == "pending_exists":
         return {"success": True, "linking_code": link_entry.linking_code, "bot_username": settings.TELEGRAM_BOT_USERNAME, "message": "Запрос уже создан. Отправьте существующий код боту."}
    elif status == "created":
        return {"success": True, "linking_code": link_entry.linking_code, "bot_username": settings.TELEGRAM_BOT_USERNAME, "message": "Код создан. Отправьте его боту."}
    else:
         # Непредвиденный статус
         raise HTTPException(status_code=500, detail="Internal server error creating link request.")


@router.post("/unlink", response_model=schemas.TelegramUnlinkResponse)
def unlink_telegram(request: schemas.TelegramUnlinkRequest, db: Session = Depends(get_db)):
    checksum_address = validate_and_checksum_address(request.wallet_address)
    success = crud.unlink_telegram(db, checksum_address)

    if success:
        return {"success": True, "message": "Связка с Telegram удалена."}
    else:
        # Можно вернуть 404 или success: false
        return {"success": False, "message": "Связка для этого кошелька не найдена."}

# Этот эндпоинт будет вызываться серверами Telegram при получении ботом сообщения (если настроен вебхук)
# Или вы можете опрашивать обновления через getUpdates в отдельном скрипте/процессе
# Для работы вебхука нужно, чтобы FastAPI был доступен из интернета по TELEGRAM_WEBHOOK_URL
@router.post("/webhook")
async def telegram_webhook(update: dict, db: Session = Depends(get_db)):
    # Импортируем логику бота здесь, чтобы избежать циклических импортов или задержки старта бота
    # от инициализации FastAPI
    from ..telegram_bot.bot import process_telegram_update
    print("Received Telegram webhook update:", update) # Логирование входящего вебхука
    await process_telegram_update(update, db) # Передаем сессию БД
    return {"ok": True} # Telegram должен получить 200 OK