from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_BOT_USERNAME: str
    TELEGRAM_WEBHOOK_URL: str | None = None # None если не используем вебхуки

    model_config = SettingsConfigDict(env_file="../.env")

settings = Settings()