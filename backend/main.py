from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from sqlalchemy.orm import Session
from fastapi.staticfiles import StaticFiles
import models, crud
from database import engine, get_db
from api import tokens, telegram


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
    "http://localhost:5500", # Пример для Live Server в VS Code
    "http://127.0.0.1:5500",
    "http://localhost:8080", # Другие примеры локальных серверов
    "http://127.0.0.1:8080",
    "http://localhost:3000", # Пример для Create-React-App
    "http://127.0.0.1:3000",
    "http://localhost:63342", # <<< ДОБАВЬТЕ ЭТУ СТРОКУ
    "http://127.0.0.1:63342", # <<< И эту на всякий случай (иногда браузер использует 127.0.0.1)
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
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Web3 Crypto App Backend!"}

# Этот блок нужен только для запуска FastAPI локально напрямую из этого файла
# При запуске через `uvicorn backend.main:app --reload` он игнорируется
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True) # Порт 5000, как на фронте