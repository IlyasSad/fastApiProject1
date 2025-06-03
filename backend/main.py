from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from fastapi.staticfiles import StaticFiles
from api import tokens, telegram, networks, operations




app = FastAPI()

# Настройка CORS - разрешаем запросы с вашего фронтенда
# В продакшене укажите конкретный URL вашего фронтенда вместо "*"
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:63354",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:63342",
    "http://127.0.0.1:8001",
    'http://localhost:63343'# Это сам бэкенд, для него CORS не нужен
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
app.include_router(networks.router)
app.include_router(operations.router)

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