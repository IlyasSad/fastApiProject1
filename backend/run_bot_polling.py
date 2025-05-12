# run_bot_polling.py

import asyncio
import logging
# import signal # signal больше не нужен, т.к. run_polling сам обрабатывает Ctrl+C
import sys

from backend.config import settings
from backend.telegram_bot.bot import application # Импортируем объект application
from telegram import Update # Импортируем Update

# Настройка логирования
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("telegram").setLevel(logging.INFO)


# Удаляем async def main() и используем прямой запуск run_polling
# async def main(): # <-- Удалите эту строку
#     """Запускает бота в режиме опроса.""" # <-- Удалите эту строку

print("Starting Telegram bot in polling mode...")

# Убедитесь, что TELEGRAM_BOT_TOKEN указан
if not settings.TELEGRAM_BOT_TOKEN:
    logging.error("TELEGRAM_BOT_TOKEN is not set in the .env file.")
    sys.exit(1)

# Останавливаем вебхук, если он был установлен ранее (рекомендуется при переходе на polling)
print("Ensuring webhook is removed...")
# Этот блок удаления вебхука должен выполняться внутри асинхронной функции,
# но application.run_polling() не позволяет просто выполнить await до своего старта.
# Простейшее решение - сделать это один раз вручную через отдельный скрипт,
# или перенести этот await вызов внутрь application.run_polling() если PTB это позволяет
# (обычно не позволяет), или использовать более низкоуровневые методы запуска PTB.
# Для простоты курсовой, можно закомментировать этот блок удаления вебхука,
# предполагая, что вы удалили его вручную через BotFather /deleteWebhook.
# Или создать отдельный разовый скрипт async def delete_webhook_script(): await application.bot.delete_webhook()

# !!! ВНИМАНИЕ: Если вы ранее настроили вебхук, Telegram будет пытаться
# отправлять обновления на ваш бэкенд. Пока вы не удалите вебхук через
# BotFather /deleteWebhook, бот в режиме опроса может не получать
# все обновления, так как Telegram будет считать, что отправляет их на вебхук.
# Удалите вебхук командой /deleteWebhook в BotFather.

# === Запуск бота в режиме опроса ===
print("Running bot polling...")
# application.run_polling() запускает асинхронный цикл событий и блокирует выполнение скрипта
# until interrupted (e.g., by Ctrl+C)
# stop_signals=[signal.SIGINT, signal.SIGTERM] можно оставить, но предупреждение может остаться на Windows
# Или убрать stop_signals=None, чтобы отключить обработку сигналов PTB,
# полагаясь на стандартную обработку Ctrl+C Python.
try:
    # Убрали await и вызов внутри asyncio.run
    application.run_polling(poll_interval=1.0, allowed_updates=Update.ALL_TYPES)
except KeyboardInterrupt:
    print("\nBot stopped manually by KeyboardInterrupt.")
    # PTB run_polling обрабатывает KeyboardInterrupt сам и пытается корректно завершиться
except Exception as e:
     # Ловим другие ошибки во время работы run_polling
     logging.error(f"An unexpected error occurred while running the bot: {e}", exc_info=True)


print("Bot script finished.")

# Удаляем блок if __name__ == "__main__": с asyncio.run()
# if __name__ == "__main__":
#     try:
#         # asyncio.run(main()) # <-- Удалите эту строку
#         pass # Или оставьте pass
#     except KeyboardInterrupt:
#         print("\nBot stopped manually.")
#     except SystemExit:
#          print("\nBot stopped by SystemExit.")
#     except Exception as e:
#          logging.error(f"An unexpected error occurred while running the bot: {e}", exc_info=True)
#
# print("Bot script finished.")