from sqlalchemy import Column, Integer, String, DateTime, Boolean, UniqueConstraint
from sqlalchemy.sql import func
from database import Base

# Модель для хранения информации о токенах
class Token(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True)
    chain_id = Column(Integer, index=True)
    address = Column(String, index=True) # Адрес контракта или 'NATIVE'
    symbol = Column(String, index=True)
    name = Column(String)
    decimals = Column(Integer)
    logo_uri = Column(String, nullable=True)

    __table_args__ = (UniqueConstraint('chain_id', 'address', name='uq_token_chain_address'),)

# Модель для связки кошелька и Telegram
class TelegramLink(Base):
    __tablename__ = "telegram_links"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, unique=True, index=True) # Адрес кошелька
    telegram_chat_id = Column(String, unique=True, index=True) # ID чата в Telegram
    telegram_username = Column(String, nullable=True) # Username пользователя в Telegram
    linking_code = Column(String, unique=True, index=True, nullable=True) # Код для связывания
    status = Column(String, default="pending") # 'pending' или 'linked'
    created_at = Column(DateTime, server_default=func.now())
    linked_at = Column(DateTime, nullable=True)

    # Можно добавить другие поля, например, список активов для уведомлений