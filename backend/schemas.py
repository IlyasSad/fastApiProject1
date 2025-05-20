from typing import Optional

from pydantic import BaseModel
from datetime import datetime

# Схема для Токена (для ответов API)
class TokenBase(BaseModel):
    chain_id: int
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: str | None = None

    class Config:
        from_attributes = True # Позволяет SQLAlchemy модели конвертироваться в Pydantic

class TokenCreate(TokenBase):
    pass # Пока совпадает с базовой

class Token(TokenBase):
    id: int

# Схема для статуса Telegram (для ответов API)
class TelegramStatusResponse(BaseModel):
    is_linked: bool
    telegram_username: str | None = None

# Схема для запроса связывания Telegram (для тела запроса)
class TelegramLinkRequest(BaseModel):
    wallet_address: str

# Схема для ответа запроса связывания
class TelegramLinkResponse(BaseModel):
    success: bool
    linking_code: str | None = None
    bot_username: str | None = None
    message: str | None = None

# Схема для запроса отмены связывания
class TelegramUnlinkRequest(BaseModel):
    wallet_address: str

# Схема для ответа отмены связывания
class TelegramUnlinkResponse(BaseModel):
     success: bool
     message: str | None = None

class NetworkInfo(BaseModel):
    chainId: int
    name: str
    explorer_url: str
    rpc_urls: str
    currency_symbol: str
    short_name: Optional[str] = None
    is_testnet: Optional[bool] = False
    is_supported_on_frontend: Optional[bool] = True



