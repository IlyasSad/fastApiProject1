from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_BOT_USERNAME: str
    class Config:
        env_file = ".env"

settings = Settings()
