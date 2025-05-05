from telegram import Update
from telegram.ext import ContextTypes
from sqlalchemy.orm import Session # Импортируем Session
from ..database import SessionLocal # Импортируем SessionLocal factory
from .. import crud # Импортируем CRUD функции

# Вспомогательная функция для получения сессии БД в хендлере
def get_db_session():
    db = SessionLocal()
    try:
        return db
    finally:
        # Сессия должна быть закрыта после использования!
        # В простом случае можно не закрывать явно, если хендлер короткий,
        # но лучше использовать with или finally
        pass # Закроется в вызывающем коде или gc (не идеально)

# Обновленная вспомогательная функция с явным закрытием
def with_db_session(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        db = SessionLocal()
        try:
            await func(update, context, db, *args, **kwargs)
        finally:
            db.close()
    return wrapper


# --- Хендлеры ---

@with_db_session # Используем декоратор для управления сессией
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE, db: Session):
    """Обрабатывает команду /start"""
    await update.message.reply_text(
        "Привет! Я бот для уведомлений о криптовалютных активах. "
        "Чтобы связать свой кошелек, используйте функцию 'Telegram Уведомления' в веб-приложении."
        # Можно добавить инструкции или кнопки
    )

@with_db_session # Используем декоратор
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE, db: Session):
    """Обрабатывает текстовые сообщения"""
    text = update.message.text.strip()
    chat_id = str(update.message.chat_id) # chat_id всегда строка
    username = update.message.from_user.username # Может быть None

    # Проверяем, является ли сообщение кодом связывания
    if len(text) == 6 and text.isdigit():
        print(f"Attempting to link chat {chat_id} with code: {text}")
        link_request, status = crud.link_telegram(db, text, chat_id, username)

        if status == "linked":
            # Получаем адрес кошелька из link_request
            wallet_address = link_request.wallet_address
            await update.message.reply_text(
                f"🎉 Успех! Ваш Telegram аккаунт связан с кошельком {wallet_address[:6]}...{wallet_address[-4:]}."
                "Теперь вы будете получать уведомления."
                # TODO: Можно отправить пользователю ссылку на веб-приложение
            )
            print(f"Successfully linked chat {chat_id} to wallet {wallet_address}")
        elif status == "chat_already_linked":
             await update.message.reply_text(
                 "Этот Telegram аккаунт уже связан с другим кошельком. Отключите его сначала, если нужно."
                 # TODO: Добавить команду для отключения
             )
             print(f"Attempted to link chat {chat_id} with code {text}, but chat already linked.")
        else: # Код не найден или не pending
             await update.message.reply_text(
                 "Неверный или устаревший код связывания. Пожалуйста, запросите новый код в веб-приложении."
             )
             print(f"Attempted to link chat {chat_id} with invalid/used code: {text}")

    else:
        # Если это не код связывания, отвечаем по умолчанию
        await update.message.reply_text(
            "Не понимаю ваше сообщение. Пожалуйста, используйте команды или запросите код связывания в веб-приложении."
        )

# TODO: Добавить хендлер для команды /status (получить статус связки)
# @with_db_session
# async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE, db: Session):
#     chat_id = str(update.message.chat_id)
#     link = crud.get_telegram_link_by_chat_id(db, chat_id)
#     if link and link.status == "linked":
#          await update.message.reply_text(f"Ваш Telegram аккаунт связан с кошельком {link.wallet_address[:6]}...{link.wallet_address[-4:]}. Вы будете получать уведомления.")
#     else:
#          await update.message.reply_text("Ваш Telegram аккаунт не связан с кошельком. Запросите код в веб-приложении.")

# TODO: Добавить хендлер для команды /unlink (отключить связку)
# @with_db_session
# async def unlink_command(update: Update, context: ContextTypes.DEFAULT_TYPE, db: Session):
#      chat_id = str(update.message.chat_id)
#      link = crud.get_telegram_link_by_chat_id(db, chat_id)
#      if link:
#          crud.unlink_telegram(db, link.wallet_address) # Отключаем по адресу кошелька
#          await update.message.reply_text("Связка с кошельком удалена.")
#      else:
#           await update.message.reply_text("Ваш Telegram аккаунт не был связан с кошельком.")