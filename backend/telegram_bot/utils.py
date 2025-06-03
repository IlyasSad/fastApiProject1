# backend/telegram_bot/utils.py

from telegram import Bot, constants
from backend.config import \
    settings  # Предполагается, что settings импортирует переменные окружения, включая TELEGRAM_BOT_TOKEN


async def send_telegram_message(chat_id: str, message_text: str, parse_mode: str = constants.ParseMode.MARKDOWN_V2,
                                disable_web_page_preview: bool = True):
    """
    Асинхронно отправляет сообщение пользователю Telegram.

    Args:
        chat_id (str): ID чата, куда отправить сообщение.
        message_text (str): Текст сообщения.
        parse_mode (str, optional): Режим разметки сообщения. По умолчанию MarkdownV2.
                                    Можно использовать constants.ParseMode.HTML.
        disable_web_page_preview (bool, optional): Отключить предпросмотр ссылок. По умолчанию True.

    Returns:
        bool: True, если сообщение успешно отправлено, иначе False.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        print("ERROR backend.telegram_bot.utils: TELEGRAM_BOT_TOKEN не настроен. Сообщение не будет отправлено.")
        return False

    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=message_text,
            parse_mode=parse_mode,
            disable_web_page_preview=disable_web_page_preview
        )
        print(f"Сообщение успешно отправлено на chat_id {chat_id}: \"{message_text[:50]}...\"")
        return True
    except Exception as e:
        print(f"Ошибка при отправке сообщения на chat_id {chat_id}: {e}")
        # Здесь можно добавить более детальное логирование или обработку специфических ошибок Telegram
        # Например, если пользователь заблокировал бота, Telegram API вернет ошибку Forbidden.
        # from telegram.error import Forbidden
        # if isinstance(e, Forbidden):
        #     print(f"Пользователь {chat_id} заблокировал бота или бот не может инициировать диалог.")
        #     # В этом случае можно пометить пользователя в БД как неактивного для уведомлений.
        #     # crud.deactivate_telegram_user(db, chat_id) # Пример
        return False


def escape_markdown_v2(text: str) -> str:
    """
    Экранирует специальные символы для использования в сообщениях Telegram с parse_mode=MarkdownV2.
    Обязательно используйте эту функцию для ЛЮБОГО пользовательского или динамического текста,
    который вы вставляете в MarkdownV2 сообщение, чтобы избежать ошибок парсинга или
    нежелательного форматирования.

    Args:
        text (str): Входная строка.

    Returns:
        str: Строка с экранированными символами.
    """
    if not isinstance(text, str):  # На случай, если передали не строку
        text = str(text)

    # Список символов, которые ОБЯЗАТЕЛЬНО нужно экранировать в MarkdownV2
    # Взято из официальной документации Telegram Bot API: https://core.telegram.org/bots/api#markdownv2-style
    escape_chars = r'_*[]()~`>#+-.=|{}!'

    # Заменяем каждый специальный символ на его экранированную версию (например, '.' на '\.')
    # Важно делать это в правильном порядке, если бы символы могли перекрываться,
    # но для этого набора порядок не критичен.
    # Простой способ - пройтись по строке и экранировать нужные символы.

    # Альтернативный, более явный способ для избежания двойного экранирования,
    # если бы \ был в escape_chars (но его там нет для MarkdownV2):
    # temp_text = text.replace('\\', '\\\\') # Сначала экранируем сам бэкслеш, если бы он был специальным
    # for char in escape_chars:
    #     temp_text = temp_text.replace(char, f'\\{char}')
    # return temp_text

    # Более простой и корректный способ для данного набора escape_chars:
    return "".join(f'\\{char}' if char in escape_chars else char for char in text)


def escape_html(text: str) -> str:
    """
    Экранирует специальные символы для использования в сообщениях Telegram с parse_mode=HTML.
    Нужно для символов <, > и &. Амперсанд & должен быть заменен на &.

    Args:
        text (str): Входная строка.

    Returns:
        str: Строка с экранированными символами для HTML.
    """
    if not isinstance(text, str):
        text = str(text)
    return text.replace("&", "&").replace("<", "<").replace(">", ">")

