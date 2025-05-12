let telegramLinkedAccount = null;
let telegramStatusCheckInterval = null; // Переменная для хранения ID интервала

// Интервал опроса в миллисекундах (например, каждые 5 секунд)
const POLLING_INTERVAL_MS = 5000;

// Проверка статуса подключения Telegram для текущего аккаунта
async function checkTelegramStatus() {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId();

    // Останавливаем опрос, если кошелек отключен
    if (!account || !currentChainId) {
        stopPolling(); // Останавливаем опрос, если нет аккаунта
        ui.updateTelegramStatus("Подключите кошелек, чтобы проверить статус Telegram.");
         ui.elements.unlinkTelegramBtn.classList.add('d-none');
         ui.elements.telegramLinkingInfo.classList.add('d-none');
         ui.updateTelegramMessage("");
         telegramLinkedAccount = null;
        return;
    }

    // Не обновляем UI во время каждого опроса, только статус запроса
    // ui.updateTelegramStatus("Проверка статуса Telegram..."); // Это может мерцать, лучше показывать только первый раз или при ошибке
    console.log(`Checking Telegram status for ${account}...`); // Логируем опрос

    try {
        const response = await utils.fetchData(`${BACKEND_URL}/api/telegram/status?address=${account}`);

        if (response.is_linked) {
            console.log("Telegram status check: Linked."); // Логируем успех
            ui.updateTelegramStatus(`Подключен к аккаунту @${response.telegram_username}`, true);
            telegramLinkedAccount = account;
             ui.elements.unlinkTelegramBtn.disabled = false; // Включаем кнопку отвязки
             // Связывание успешно, останавливаем опрос
             stopPolling();
             ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем инфо о коде


        } else {
             console.log("Telegram status check: Not linked."); // Логируем статус
             // Если статус все еще "не подключен" И мы находимся в процессе связывания (например, показываем код),
             // оставляем UI в состоянии ожидания и продолжаем опрос.
             // Если мы не показываем код, значит, связывание не инициировано или неактивно.
             if (!ui.elements.telegramLinkingInfo.classList.contains('d-none')) {
                 // Если инфо о коде видимо, значит, ждем связывания - продолжаем опрос
                 ui.updateTelegramStatus("Не подключен. Ожидание связывания..."); // Обновить статус ожидания
                 ui.elements.linkTelegramBtn.classList.add('d-none'); // Скрываем кнопку связывания
                 ui.elements.unlinkTelegramBtn.classList.add('d-none'); // Скрываем кнопку отвязки
             } else {
                 // Если инфо о коде не видно, значит, не в процессе связывания
                 ui.updateTelegramStatus("Не подключен.", false); // Показывать кнопку связывания
                  ui.elements.linkTelegramBtn.disabled = false;
                  ui.elements.unlinkTelegramBtn.classList.add('d-none');
                  // Если не показываем код и статус "не подключен", останавливаем опрос, т.к. нет активного запроса
                  stopPolling();
             }
             telegramLinkedAccount = null;
        }
         ui.updateTelegramMessage(""); // Очистить предыдущие сообщения (кроме статуса)

    } catch (error) {
        console.error("Error checking Telegram status:", error);
         let errorMessage = "Ошибка проверки статуса Telegram.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramStatus(errorMessage, false);
        telegramLinkedAccount = null;
         ui.elements.unlinkTelegramBtn.classList.add('d-none');
         ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем инфо о коде при ошибке
         ui.updateTelegramMessage("Не удалось связаться с бэкендом для проверки статуса Telegram.");

          ui.elements.linkTelegramBtn.disabled = false;
          // При ошибке опроса, возможно, стоит остановиться или увеличить интервал/количество попыток
          stopPolling(); // Останавливаем опрос при ошибке
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

    // Останавливаем любой текущий опрос перед запросом нового кода
    stopPolling();

    ui.updateTelegramMessage("Запрос кода связывания...");
     ui.elements.linkTelegramBtn.disabled = true;
     ui.elements.unlinkTelegramBtn.disabled = true; // Отключаем обе кнопки
     ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем старое инфо


    try {
        const response = await utils.postData(`${BACKEND_URL}/api/telegram/link/request`, { wallet_address: account });

        if (response.success) {
            ui.showTelegramLinkingCode(response.linking_code, response.bot_username);
             ui.updateTelegramMessage(`${response.message || 'Код создан.'} Отправьте его боту и ожидайте связывания.`);

             // Запускаем периодический опрос для проверки статуса
             startPolling();

        } else {
             // success: false пришел с бэкенда (например, уже связан)
            ui.updateTelegramMessage(`${response.message || 'Не удалось запросить код связывания.'}`);
             ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрыть инфо о коде
             // Если уже связан, статус обновится при следующем заходе на вкладку или при checkTelegramStatus
             checkTelegramStatus(); // Проверяем статус сразу после ответа об ошибке
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
         // Кнопки будут включены/скрыты в checkTelegramStatus
         // ui.elements.linkTelegramBtn.disabled = false;
         // ui.elements.unlinkTelegramBtn.disabled = true;
    }
}

// Запуск периодического опроса
function startPolling() {
    // Убеждаемся, что интервал еще не запущен
    if (telegramStatusCheckInterval === null) {
        console.log(`Starting Telegram status polling every ${POLLING_INTERVAL_MS}ms.`);
        // Вызываем checkTelegramStatus сразу, а затем по интервалу
        checkTelegramStatus();
        telegramStatusCheckInterval = setInterval(checkTelegramStatus, POLLING_INTERVAL_MS);
    }
}

// Остановка периодического опроса
function stopPolling() {
    if (telegramStatusCheckInterval !== null) {
        console.log("Stopping Telegram status polling.");
        clearInterval(telegramStatusCheckInterval);
        telegramStatusCheckInterval = null;
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

     if (!confirm("Вы уверены, что хотите отключить Telegram уведомления для этого кошелька?")) {
         return; // Пользователь отменил
     }

     // Останавливаем опрос перед отменой связывания
     stopPolling();

    ui.updateTelegramMessage("Отключение Telegram...");
     ui.elements.unlinkTelegramBtn.disabled = true;
     ui.elements.linkTelegramBtn.disabled = true; // Отключаем обе кнопки


    try {
        const response = await utils.postData(`${BACKEND_URL}/api/telegram/unlink`, { wallet_address: account });

        if (response.success) {
            ui.updateTelegramMessage(`${response.message || 'Telegram успешно отключен.'}`);
             ui.updateTelegramStatus("Не подключен.", false); // Обновить UI статус
             telegramLinkedAccount = null; // Сбрасываем состояние связки
             ui.elements.linkTelegramBtn.disabled = false; // Включаем кнопку связывания
        } else {
             // success: false пришел с бэкенда (например, связка не найдена)
            ui.updateTelegramMessage(`${response.message || 'Не удалось отключить Telegram.'}`);
             // Включаем кнопку отвязки обратно, если не удалось отвязать
             ui.elements.unlinkTelegramBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error unlinking Telegram:", error);
         let errorMessage = "Ошибка при отключении Telegram.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramMessage(errorMessage);
         // Включаем кнопку отвязки обратно при ошибке
         ui.elements.unlinkTelegramBtn.disabled = false;

    } finally {
         // Проверяем статус после попытки отвязки, чтобы обновить состояние кнопок Link/Unlink
         // checkTelegramStatus(); // Эту проверку теперь можно не делать здесь, т.к. статус обрабатывается выше
    }
}

// Сброс состояния Telegram UI при отключении кошелька
function resetState() {
     // Останавливаем опрос при сбросе состояния (например, при смене аккаунта или отключении кошелька)
     stopPolling();

     ui.updateTelegramStatus("Подключите кошелек, чтобы проверить статус Telegram.");
     ui.elements.telegramLinkingInfo.classList.add('d-none');
     ui.elements.unlinkTelegramBtn.classList.add('d-none');
     ui.updateTelegramMessage("");
     telegramLinkedAccount = null;
     ui.elements.linkTelegramBtn.disabled = false; // Убеждаемся, что кнопка связывания включена по умолчанию
     ui.elements.unlinkTelegramBtn.disabled = true; // Убеждаемся, что кнопка отвязки выключена
}

// Экспорт функций
window.telegram = {
    checkTelegramStatus, // Экспортируем для вызова при смене аккаунта/сети/вкладки
    requestLinkingCode,
    requestUnlinking,
    resetState, // Экспортируем для вызова из wallet.js и app.js
    startPolling, // Экспортируем, возможно, для ручного запуска опроса если нужно
    stopPolling, // Экспортируем, возможно, для ручной остановки если нужно
     telegramLinkedAccount: () => telegramLinkedAccount,
};