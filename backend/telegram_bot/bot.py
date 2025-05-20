from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
from sqlalchemy.orm import Session
from backend.config import settings
from backend.telegram_bot import handlers # Импортируем хендлеры

# Инициализация бота
application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()

# Добавляем обработчики команд и сообщений
application.add_handler(CommandHandler("start", handlers.start_command))
# Добавляем обработчик для текстовых сообщений, которые не являются командами
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handlers.handle_message))

# TODO: Можно добавить другие команды: /status, /unlink, /balance и т.д.
# application.add_handler(CommandHandler("status", handlers.status_command))
# application.add_handler(CommandHandler("unlink", handlers.unlink_command))


# Функция для обработки входящих обновлений с вебхука FastAPI
async def process_telegram_update(update_dict: dict, db: Session):
    # Создаем объект Update из словаря
    update = Update.de_json(update_dict, application.bot)

    # Передаем update в dispatcher для обработки.
    # Контекст (context) будет создан автоматически.
    # Мы можем добавить кастомные данные в контекст, например, сессию БД.
    # Однако, самый простой способ получить доступ к БД в хендлерах -
    # создавать сессию внутри хендлера или передавать ее через аргументы (сложно с python-telegram-bot dispatcher).
    # Проще всего создать сессию внутри хендлера: db = SessionLocal().
    # Либо использовать ApplicationBuilder(context_types=...). Здесь для простоты создаем сессию внутри хендлера.

    # application.update_queue.put(update) # Можно поставить в очередь, но для вебхука лучше обработать сразу
    await application.process_update(update)


# TODO: Функция для запуска бота (либо вебхук, либо опрос)
# Запуск вебхука обычно делается в main.py FastAPI
async def setup_webhook(webhook_url: str):
     if not webhook_url:
         print("TELEGRAM_WEBHOOK_URL не указан в .env. Вебхук не будет настроен.")
         return

     # Устанавливаем вебхук в Telegram
     # Убедитесь, что ваш FastAPI сервер доступен по этому URL из интернета
     await application.bot.set_webhook(url=webhook_url)
     print(f"Telegram webhook set to: {webhook_url}")

# Запуск опроса (для локальной разработки, не использовать вместе с вебхуком)
def run_polling():
     print("Starting Telegram bot polling...")
     application.run_polling(poll_interval=1.0)