// URL вашего Python бэкенда берем из utils
const BACKEND_URL = utils.BACKEND_URL;

let telegramLinkedAccount = null; // Адрес кошелька, который связан с Telegram (если связан)

// Проверка статуса подключения Telegram для текущего аккаунта
async function checkTelegramStatus() {
    const account = wallet.getAccount(); // Получаем текущий аккаунт из wallet.js
    const currentChainId = wallet.getChainId(); // Получаем текущую сеть

    if (!account || !currentChainId) {
        ui.updateTelegramStatus("Подключите кошелек, чтобы проверить статус Telegram.");
         ui.elements.unlinkTelegramBtn.classList.add('d-none'); // Скрываем кнопку отвязки
         ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем инфо о коде
         ui.updateTelegramMessage(""); // Очищаем сообщения
         telegramLinkedAccount = null; // Сбрасываем состояние связки
        return;
    }
     // TODO: Можно добавить проверку, что текущая сеть поддерживается для уведомлений, если это важно для бэкенда


    ui.updateTelegramStatus("Проверка статуса Telegram...");
     ui.elements.linkTelegramBtn.disabled = true; // Отключаем кнопки пока идет проверка
     ui.elements.unlinkTelegramBtn.disabled = true;


    try {
        const response = await utils.fetchData(`${BACKEND_URL}/api/telegram/status?address=${account}`);

        if (response.is_linked) {
            ui.updateTelegramStatus(`Подключен к аккаунту @${response.telegram_username}`, true); // true для показа кнопки отвязки
            telegramLinkedAccount = account; // Сохраняем, что текущий аккаунт связан
             ui.elements.unlinkTelegramBtn.disabled = false; // Включаем кнопку отвязки
        } else {
            ui.updateTelegramStatus("Не подключен.", false); // false для показа кнопки связывания
            telegramLinkedAccount = null; // Аккаунт не связан
             ui.elements.linkTelegramBtn.disabled = false; // Включаем кнопку связывания
        }
         ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем инфо о коде, если оно было
         ui.updateTelegramMessage(""); // Очистить предыдущие сообщения

    } catch (error) {
        console.error("Error checking Telegram status:", error);
         let errorMessage = "Ошибка проверки статуса Telegram.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramStatus(errorMessage, false); // Показываем ошибку, оставляем кнопку связывания
        telegramLinkedAccount = null;
         ui.elements.unlinkTelegramBtn.classList.add('d-none');
         ui.elements.telegramLinkingInfo.classList.add('d-none');
         ui.updateTelegramMessage("Не удалось связаться с бэкендом для проверки статуса Telegram.");

          ui.elements.linkTelegramBtn.disabled = false; // Включаем кнопку связывания, чтобы можно было попробовать еще раз

    }
}

// Запрос на бэкенд для генерации кода связывания
async function requestLinkingCode() {
     const account = wallet.getAccount();
     const currentChainId = wallet.getChainId();

    if (!account || !currentChainId) {
        ui.updateTelegramMessage("Подключите кошелек сначала.");
        return;
    }
     // TODO: Можно добавить проверку, что текущая сеть поддерживается


    ui.updateTelegramMessage("Запрос кода связывания...");
     ui.elements.linkTelegramBtn.disabled = true; // Отключаем кнопку во время запроса
     ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем старое инфо


    try {
        const response = await utils.postData(`${BACKEND_URL}/api/telegram/link/request`, { wallet_address: account });

        if (response.success) {
            ui.showTelegramLinkingCode(response.linking_code, response.bot_username);
             ui.updateTelegramMessage(`${response.message || 'Код создан.'} Ждем подтверждения в Telegram...`);

             // TODO: Опционально: запустить периодический опрос бэкенда или использовать WebSockets
             // чтобы узнать, когда пользователь отправит код боту и связка произойдет.
             // Например: setInterval(checkTelegramStatus, 5000); // Опрашивать статус каждые 5 секунд
             // Не забудьте очистить интервал, когда статус станет linked или пользователь уйдет с вкладки.

        } else {
             // success: false пришел с бэкенда (например, уже связан)
            ui.updateTelegramMessage(`${response.message || 'Не удалось запросить код связывания.'}`);
             ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрыть инфо о коде
        }
    } catch (error) {
        console.error("Error requesting linking code:", error);
         let errorMessage = "Ошибка при запросе кода связывания.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramMessage(errorMessage);
         ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрыть инфо о коде
    } finally {
         ui.elements.linkTelegramBtn.disabled = false; // Включаем кнопку обратно
    }
}

// Запрос на бэкенд для отмены связывания
async function requestUnlinking() {
     const account = wallet.getAccount();
     const currentChainId = wallet.getChainId();

    if (!account || !currentChainId) {
        ui.updateTelegramMessage("Подключите кошелек сначала.");
        return;
    }
     // Проверяем, что текущий аккаунт действительно связан (фронтенд проверка)
     if (telegramLinkedAccount !== account) {
          ui.updateTelegramMessage("Текущий кошелек не связан с Telegram.");
          ui.updateTelegramStatus("Не подключен.", false);
          return;
     }
     // TODO: Можно добавить проверку, что текущая сеть поддерживается


     // TODO: В идеале, перед отменой связывания, нужно подтверждение пользователя
     // Например, отправить код подтверждения в Telegram или запросить подпись транзакции (более сложно)
     // Для простоты курсовой, сделаем прямую отмену через бэкенд.
     if (!confirm("Вы уверены, что хотите отключить Telegram уведомления для этого кошелька?")) {
         return; // Пользователь отменил
     }


    ui.updateTelegramMessage("Отключение Telegram...");
     ui.elements.unlinkTelegramBtn.disabled = true; // Отключаем кнопку во время запроса


    try {
        const response = await utils.postData(`${BACKEND_URL}/api/telegram/unlink`, { wallet_address: account });

        if (response.success) {
            ui.updateTelegramMessage(`${response.message || 'Telegram успешно отключен.'}`);
             ui.updateTelegramStatus("Не подключен.", false); // Обновить UI статус
             telegramLinkedAccount = null; // Сбрасываем состояние связки
        } else {
             // success: false пришел с бэкенда (например, связка не найдена)
            ui.updateTelegramMessage(`${response.message || 'Не удалось отключить Telegram.'}`);
        }
    } catch (error) {
        console.error("Error unlinking Telegram:", error);
         let errorMessage = "Ошибка при отключении Telegram.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramMessage(errorMessage);
    } finally {
         ui.elements.unlinkTelegramBtn.disabled = false; // Включаем кнопку обратно
         // После попытки отвязки, снова проверяем статус, чтобы обновить состояние кнопок Link/Unlink
         checkTelegramStatus();
    }
}

// Сброс состояния Telegram UI при отключении кошелька
function resetState() {
     ui.updateTelegramStatus("Подключите кошелек, чтобы проверить статус Telegram.");
     ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем инфо о коде
     ui.elements.unlinkTelegramBtn.classList.add('d-none'); // Скрываем кнопку отвязки
     ui.updateTelegramMessage(""); // Очищаем сообщения
     telegramLinkedAccount = null; // Сбрасываем состояние связки
     ui.elements.linkTelegramBtn.disabled = false; // Убеждаемся, что кнопка связывания включена по умолчанию
     ui.elements.unlinkTelegramBtn.disabled = true; // Убеждаемся, что кнопка отвязки выключена
}


// Экспорт функций (делаем их доступными в глобальной области под объектом telegram)
window.telegram = {
    checkTelegramStatus, // Экспортируем для вызова при смене аккаунта/сети/вкладки
    requestLinkingCode,
    requestUnlinking,
    resetState, // Экспортируем для вызова из wallet.js и app.js

     // Опционально: экспортировать переменные состояния
     telegramLinkedAccount: () => telegramLinkedAccount,
};