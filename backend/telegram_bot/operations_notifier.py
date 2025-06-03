# В твоем файле, где происходит логика уведомлений на бэкенде
# (например, backend/api/operations_notifier.py или внутри routers/swap.py, routers/bridge.py)

from sqlalchemy.orm import Session
from backend import crud  # Где у тебя CRUD-операции для TelegramLink
from backend.api.telegram import validate_and_checksum_address
from backend.telegram_bot.utils import send_telegram_message, escape_markdown_v2


# Эта функция вызывается, когда фронтенд сообщает об успешном свапе
async def process_swap_notification(
        db: Session,
        wallet_address: str,
        from_token_symbol: str,
        to_token_symbol: str,
        from_amount_str: str,  # Сумма в человекочитаемом формате
        to_amount_str: str,  # Сумма в человекочитаемом формате
        network_name: str,
        transaction_hash: str,
        explorer_url_base: str  # Базовый URL эксплорера для сети, например, "https://etherscan.io/tx/"
):
    print(f"Processing swap notification for wallet {wallet_address}, tx: {transaction_hash}")
    checksum_address = validate_and_checksum_address(wallet_address)
    print(checksum_address)
    telegram_link = crud.get_telegram_link_by_wallet(db, checksum_address)
    print(telegram_link)

    if telegram_link and telegram_link.status == "linked":
        esc_from_token = escape_markdown_v2(from_token_symbol)
        esc_to_token = escape_markdown_v2(to_token_symbol)
        esc_from_amount = escape_markdown_v2(from_amount_str)
        esc_to_amount = escape_markdown_v2(to_amount_str)
        esc_network = escape_markdown_v2(network_name)

        # Убедимся, что explorer_url_base заканчивается на /
        if not explorer_url_base.endswith('/'):
            explorer_url_base += '/'
        explorer_link = f"{explorer_url_base}{transaction_hash}"

        message_lines = [
            f"✅ *Успешный Обмен в сети {esc_network}*",
            f"Обменяли: `{esc_from_amount} {esc_from_token}`",
            f"Получили: `{esc_to_amount} {esc_to_token}`",
            f"Хэш транзакции: `{escape_markdown_v2(transaction_hash[:10])}\\.\\.\\.{escape_markdown_v2(transaction_hash[-8:])}`",
            f"[🔍 Посмотреть в эксплорере]({escape_markdown_v2(explorer_link)})"
        ]
        message = "\n\n".join(message_lines)

        await send_telegram_message(chat_id=telegram_link.telegram_chat_id, message_text=message)
    else:
        print(f"Для кошелька {wallet_address} не найдена активная Telegram-связка для уведомления о свапе.")


# Эта функция вызывается, когда фронтенд сообщает об инициированном мосте
async def process_bridge_notification(
        db: Session,
        wallet_address: str,
        from_token_symbol: str,
        to_token_symbol: str,
        from_amount_str: str,
        to_amount_str: str,  # Приблизительная сумма получения
        from_network_name: str,
        to_network_name: str,
        transaction_hash_from: str,  # Хэш транзакции в исходной сети
        explorer_url_base_from: str,
):
    print(f"Processing bridge initiated notification for wallet {wallet_address}, tx_from: {transaction_hash_from}")
    telegram_link = crud.get_telegram_link_by_wallet(db, wallet_address)

    if telegram_link and telegram_link.status == "linked":
        esc_from_token = escape_markdown_v2(from_token_symbol)
        esc_to_token = escape_markdown_v2(to_token_symbol)
        esc_from_amount = escape_markdown_v2(from_amount_str)
        esc_to_amount = escape_markdown_v2(to_amount_str)  # Приблизительно
        esc_from_network = escape_markdown_v2(from_network_name)
        esc_to_network = escape_markdown_v2(to_network_name)

        if not explorer_url_base_from.endswith('/'):
            explorer_url_base_from += '/'
        explorer_link_from = f"{explorer_url_base_from}{transaction_hash_from}"

        message_lines = [
            f"⏳ *Мост Инициирован*",
            f"Из: `{esc_from_amount} {esc_from_token}` \\({esc_from_network}\\)",
            f"В: Приблизительно `{esc_to_amount} {esc_to_token}` \\({esc_to_network}\\)",
            f"Хэш в исходной сети: `{escape_markdown_v2(transaction_hash_from[:10])}\\.\\.\\.{escape_markdown_v2(transaction_hash_from[-8:])}`",
            f"[🔍 Отследить в {esc_from_network}]({escape_markdown_v2(explorer_link_from)})",
            f"_Ожидайте поступления средств в сети {esc_to_network}\\. Это может занять некоторое время\\._"
        ]
        message = "\n\n".join(message_lines)

        await send_telegram_message(chat_id=telegram_link.telegram_chat_id, message_text=message)
    else:
        print(f"Для кошелька {wallet_address} не найдена активная Telegram-связка для уведомления о мосте.")