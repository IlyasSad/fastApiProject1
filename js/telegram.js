

let telegramLinkedAccount = null; // Адрес кошелька, который связан с Telegram (если связан)
let telegramStatusCheckInterval = null; // Переменная для хранения ID интервала опроса

// Интервал опроса в миллисекундах (например, каждые 5 секунд)
const POLLING_INTERVAL_MS = 5000;

// Проверка статуса подключения Telegram для текущего аккаунта
async function checkTelegramStatus() {
    const account = wallet.getAccount(); // Получаем текущий аккаунт из wallet.js
    const currentChainId = wallet.getChainId(); // Получаем текущую сеть

    // Останавливаем опрос и сбрасываем UI, если кошелек отключен
    if (!account || !currentChainId) {
        resetState(); // Сбрасываем состояние Telegram UI (что также остановит опрос)
        return;
    }
     // TODO: Можно добавить проверку, что текущая сеть поддерживается для уведомлений, если это важно для бэкенда


    // ui.updateTelegramStatus("Проверка статуса Telegram..."); // Это может мерцать, лучше показывать только первый раз или при ошибке
    console.log(`Checking Telegram status for ${account}...`); // Логируем опрос

    try {
        const response = await utils.fetchData(`${BACKEND_URL}/api/telegram/status?address=${account}`);

        if (response.is_linked) {
            console.log("Telegram status check: Linked."); // Логируем успех
            ui.updateTelegramStatus(`Подключен к аккаунту @${response.telegram_username || utils.formatAddress(account)}`, true); // Используем отформатированный аккаунт как фолбэк для username
            telegramLinkedAccount = account; // Сохраняем, что текущий аккаунт связан
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
                 ui.updateTelegramStatus("Не подключен. Ожидание связывания...", false); // Обновить статус ожидания
                 // Кнопки Link/Unlink управляются через ui.updateUIState
             } else {
                 // Если инфо о коде не видно, значит, не в процессе связывания через запрос кода
                 ui.updateTelegramStatus("Не подключен.", false); // Показывать кнопку связывания
                  // Кнопки Link/Unlink управляются через ui.updateUIState
                  // Если не показываем код и статус "не подключен", останавливаем опрос, т.к. нет активного запроса
                  stopPolling(); // Останавливаем опрос, если нет активного запроса и не связан
             }
             telegramLinkedAccount = null;
        }
         ui.updateTelegramMessage(""); // Очистить предыдущие сообщения (кроме статуса)

         // Обновляем состояние UI кнопок через ui.updateUIState
         ui.updateUIState(!!account); // !!account будет true здесь

    } catch (error) {
        console.error("Error checking Telegram status:", error);
         let errorMessage = "Ошибка проверки статуса Telegram.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramStatus(errorMessage, false); // Показываем ошибку, статус "Не подключен", кнопка связывания активна
        telegramLinkedAccount = null;
         ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем инфо о коде при ошибке
         ui.updateTelegramMessage("Не удалось связаться с бэкендом для проверки статуса Telegram.");

          // При ошибке опроса, возможно, стоит остановиться или увеличить интервал/количество попыток
          stopPolling(); // Останавливаем опрос при ошибке
           // Обновляем состояние UI кнопок через ui.updateUIState
         ui.updateUIState(!!account); // !!account будет true здесь
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


    // Останавливаем любой текущий опрос перед запросом нового кода
    stopPolling();

    ui.updateTelegramMessage("Запрос кода связывания...");
     ui.elements.linkTelegramBtn.disabled = true; // Отключаем кнопку во время запроса
     ui.elements.unlinkTelegramBtn.disabled = true; // Отключаем кнопку отвязки
     ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрываем старое инфо о коде


    try {
        const response = await utils.postData(`${BACKEND_URL}/api/telegram/link/request`, { wallet_address: account });

        if (response.success) {
            ui.showTelegramLinkingCode(response.linking_code, response.bot_username);
             ui.updateTelegramMessage(`${response.message || 'Код создан.'} Отправьте его боту и ожидайте связывания.`);

             // Запускаем периодический опрос для проверки статуса связывания
             startPolling();

        } else {
             // success: false пришел с бэкенда (например, уже связан или pending)
            ui.updateTelegramMessage(`${response.message || 'Не удалось запросить код связывания.'}`);
             ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрыть инфо о коде
             // Если бэкенд ответил, что уже связан или pending, проверяем статус сразу,
             // чтобы обновить UI кнопок Link/Unlink корректно. checkTelegramStatus() также может запустить опрос.
             checkTelegramStatus();
        }
    } catch (error) {
        console.error("Error requesting linking code:", error);
         let errorMessage = "Ошибка при запросе кода связывания.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateTelegramMessage(errorMessage);
         ui.elements.telegramLinkingInfo.classList.add('d-none'); // Скрыть инфо о коде
          // При ошибке запроса кода, включаем кнопку "Подключить" обратно и выключаем отвязку
         ui.elements.linkTelegramBtn.disabled = false;
          ui.elements.unlinkTelegramBtn.disabled = true;
    } finally {
         // Кнопки будут включены/скрыты в checkTelegramStatus, который может быть вызван выше или вручную
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
        // checkTelegramStatus() уже вызывается при переключении на вкладку,
        // поэтому здесь можно только запустить setInterval
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
           ui.updateUIState(!!account); // Обновляем состояние кнопок
          return;
     }

     if (!confirm("Вы уверены, что хотите отключить Telegram уведомления для этого кошелька?")) {
         return; // Пользователь отменил
     }

     // Останавливаем опрос перед отменой связывания
     stopPolling();

    ui.updateTelegramMessage("Отключение Telegram...");
     ui.elements.unlinkTelegramBtn.disabled = true; // Отключаем кнопку во время запроса
     ui.elements.linkTelegramBtn.disabled = true; // Отключаем кнопку связывания


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
         // Обновляем состояние UI кнопок через ui.updateUIState
          ui.updateUIState(!!account); // !!account будет true здесь
    }
}

// Сброс состояния Telegram UI при отключении кошелька или смене вкладки
function resetState() {
     // Останавливаем опрос при сбросе состояния (например, при смене аккаунта или отключении кошелька)
     stopPolling();

     ui.updateTelegramStatus("Подключите кошелек, чтобы проверить статус Telegram.");
     ui.elements.telegramLinkingInfo.classList.add('d-none');
     ui.elements.unlinkTelegramBtn.classList.add('d-none'); // Скрываем кнопку отвязки
     ui.updateTelegramMessage("");
     telegramLinkedAccount = null; // Сбрасываем состояние связки
     ui.elements.linkTelegramBtn.disabled = false; // Убеждаемся, что кнопка связывания включена по умолчанию
     ui.elements.unlinkTelegramBtn.disabled = true; // Убеждаемся, что кнопка отвязки выключена

     // Обновляем состояние UI кнопок через ui.updateUIState
     const account = wallet.getAccount();
      ui.updateUIState(!!account); // Если аккаунт есть, включит форму, если нет - выключит

}

// Экспорт функций (делаем их доступными в глобальной области под объектом telegram)
window.telegram = {
    checkTelegramStatus, // Экспортируем для вызова при смене аккаунта/сети/вкладки
    requestLinkingCode,
    requestUnlinking,
    resetState, // Экспортируем для вызова из wallet.js и app.js
    startPolling, // Экспортируем, возможно, для ручного запуска опроса если нужно
    stopPolling, // Экспортируем, возможно, для ручной остановки если нужно
     telegramLinkedAccount: () => telegramLinkedAccount, // Геттер для состояния связки
};