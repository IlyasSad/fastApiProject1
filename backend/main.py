from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from sqlalchemy.orm import Session
import models, crud
from database import engine, get_db
from api import tokens, telegram
from config import settings
from telegram_bot.bot import setup_webhook, application as tg_app # Импортируем бота


# Создаем таблицы в БД при старте
models.Base.metadata.create_all(bind=engine)

# Создаем сессию для начального заполнения (только при первом запуске)
# В реальном приложении это делается через миграции или отдельный скрипт
db = Session(engine)
crud.populate_tokens(db)
db.close()


app = FastAPI()

# Настройка CORS - разрешаем запросы с вашего фронтенда
# В продакшене укажите конкретный URL вашего фронтенда вместо "*"
origins = [
    "http://127.0.0.1:8001", # Пример для Live Server в VS Code
    "http://127.0.0.1:5500",
    "http://localhost:8080", # Другие примеры локальных серверов
    "http://localhost:63342",
    # Добавьте ваш актуальный URL фронтенда при деплое
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Подключаем роуты API
app.include_router(tokens.router)
app.include_router(telegram.router)

# Подключаем вебхук Telegram бота, если настроен URL
@app.on_event("startup")
async def startup_event():
    print("FastAPI app startup...")
    # При старте приложения устанавливаем вебхук Telegram
    # Убедитесь, что TELEGRAM_WEBHOOK_URL указан и ваш сервер доступен из интернета
    if settings.TELEGRAM_WEBHOOK_URL:
         await setup_webhook(settings.TELEGRAM_WEBHOOK_URL)
    else:
        print("TELEGRAM_WEBHOOK_URL не указан. Вебхук не настроен. "
              "Для работы Telegram бота на локальной машине, используйте Polling в отдельном скрипте "
              "(см. python-telegram-bot документацию).")


@app.get("/")
def read_root():
    return {"message": "Welcome to the Web3 Crypto App Backend!"}

# Этот блок нужен только для запуска FastAPI локально напрямую из этого файла
# При запуске через `uvicorn backend.main:app --reload` он игнорируется
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8001, reload=True) # Порт 5000, как на фронте