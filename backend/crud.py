from sqlalchemy.orm import Session
from sqlalchemy import or_, func
import models, schemas
import random
import string
from datetime import datetime

# === CRUD для Токенов ===

def get_token(db: Session, token_id: int):
    return db.query(models.Token).filter(models.Token.id == token_id).first()

def get_token_by_address(db: Session, chain_id: int, address: str):
     # Обрабатываем регистр адреса и случай 'NATIVE'
     # Для 'NATIVE' регистр не важен
     if address.lower() == 'native':
         return db.query(models.Token).filter(
             models.Token.chain_id == chain_id,
             models.Token.address == 'NATIVE' # Храним 'NATIVE' как строку
         ).first()
     else:
         # Для контрактов, можно хранить checksummed адрес
         # ethers.utils.getAddress(address) на фронтенде или web3.toChecksumAddress на бэке
         # Для простоты здесь ищем без учета регистра (может быть небезопасно в проде)
         # Лучше хранить и искать по checksummed адресу.
          from web3 import Web3 # Предполагаем web3 установлена
          try:
              checksum_address = Web3.toChecksumAddress(address)
              return db.query(models.Token).filter(
                  models.Token.chain_id == chain_id,
                  models.Token.address == checksum_address # Или .ilike(address) для безрегистрового поиска
              ).first()
          except ValueError:
              # Некорректный адрес
              return None


def get_tokens(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Token).offset(skip).limit(limit).all()

def get_tokens_by_chain(db: Session, chain_id: int):
     return db.query(models.Token).filter(models.Token.chain_id == chain_id).all()

def create_token(db: Session, token: schemas.TokenCreate):
     # TODO: В идеале, перед сохранением адреса контракта,
     # проверить его формат и/или сконвертировать в checksummed
     db_token = models.Token(**token.model_dump()) # Используем model_dump() для Pydantic V2
     db.add(db_token)
     db.commit()
     db.refresh(db_token)
     return db_token

# === CRUD для TelegramLink ===

def get_telegram_link_by_wallet(db: Session, wallet_address: str):
     # TODO: В идеале использовать checksummed адрес
     return db.query(models.TelegramLink).filter(models.TelegramLink.wallet_address == wallet_address).first()

def get_telegram_link_by_chat_id(db: Session, telegram_chat_id: str):
    return db.query(models.TelegramLink).filter(models.TelegramLink.telegram_chat_id == telegram_chat_id).first()

def get_telegram_link_by_linking_code(db: Session, linking_code: str):
     # Ищем только активные (pending) коды
    return db.query(models.TelegramLink).filter(
        models.TelegramLink.linking_code == linking_code,
        models.TelegramLink.status == "pending"
    ).first()


def create_telegram_link_request(db: Session, wallet_address: str):
     # TODO: В идеале использовать checksummed адрес
     # Проверяем, нет ли уже активной связки или запроса для этого адреса
     existing_link = get_telegram_link_by_wallet(db, wallet_address)
     if existing_link:
         if existing_link.status == "linked":
             return existing_link, "already_linked"
         else: # pending
             # Можно обновить время создания или просто вернуть существующий
              return existing_link, "pending_exists"

     # Генерируем уникальный код
     while True:
         linking_code = ''.join(random.choices(string.digits, k=6)) # 6 цифр
         if not get_telegram_link_by_linking_code(db, linking_code): # Проверяем уникальность среди pending
             break # Код уникален

     db_link = models.TelegramLink(
         wallet_address=wallet_address,
         linking_code=linking_code,
         status="pending"
         # telegram_chat_id и telegram_username будут добавлены ботом
     )
     db.add(db_link)
     db.commit()
     db.refresh(db_link)
     return db_link, "created"

def link_telegram(db: Session, linking_code: str, telegram_chat_id: str, telegram_username: str = None):
    link_request = get_telegram_link_by_linking_code(db, linking_code)

    if not link_request:
        return None # Код не найден или уже использован/неактивен

    # Проверяем, не связан ли этот chat_id уже с другим кошельком
    existing_chat_link = get_telegram_link_by_chat_id(db, telegram_chat_id)
    if existing_chat_link and existing_chat_link.status == "linked":
         # Можно удалить старую связку или запретить новую.
         # Для простоты, скажем, что этот chat_id уже используется.
         # Или удалить existing_chat_link? Зависит от логики.
         # Здесь: не связываем.
         return link_request, "chat_already_linked"


    link_request.telegram_chat_id = telegram_chat_id
    link_request.telegram_username = telegram_username
    link_request.status = "linked"
    link_request.linked_at = func.now()
    link_request.linking_code = None # Удаляем код после использования

    db.commit()
    db.refresh(link_request)
    return link_request, "linked"

def unlink_telegram(db: Session, wallet_address: str):
     # TODO: В идеале использовать checksummed адрес
    link = get_telegram_link_by_wallet(db, wallet_address)
    if link:
        db.delete(link)
        db.commit()
        return True
    return False # Связь не найдена

def get_networks(db: Session):
    db_networks = db.query(models.NetworkConfig) \
        .filter(models.NetworkConfig.is_supported_on_frontend == 1) \
        .order_by(models.NetworkConfig.name) \
        .all()
    return db_networks