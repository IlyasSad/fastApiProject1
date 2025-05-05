// В js/app.js

document.addEventListener('DOMContentLoaded', () => {

    console.log("App loaded. Initializing...");

    // Инициализация модальных окон Bootstrap перенесена в ui.js в DOMContentLoaded

    // Установить обработчики для кнопок подключения/отключения кошелька
    ui.elements.connectWalletBtn.addEventListener('click', wallet.connectWallet);
    ui.elements.disconnectWalletBtn.addEventListener('click', wallet.disconnectWallet);

    // Установить обработчики для переключения вкладок Bootstrap
    // Используем событие 'shown.bs.tab' которое срабатывает ПОСЛЕ того, как вкладка стала активной
    document.querySelectorAll('.nav-link').forEach(button => {
        button.addEventListener('shown.bs.tab', (event) => {
             const tabName = event.target.dataset.bsTarget.substring(1); // Получаем ID вкладки без #

             const account = wallet.getAccount();
             if (account) {
                 if (tabName === 'swap') {
                     swap.updateCurrentBalances();
                      // Обновить статус UI в зависимости от выбранных токенов
                      ui.updateSwapStatus(selectedFromToken && selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму"); // selectedFromToken, selectedToToken должны быть доступны в глобальной области или импортированы
                 } else if (tabName === 'bridge') {
                     bridge.populateNetworkSelects(); // Перезаполнить, т.к. текущая сеть могла измениться
                     bridge.updateCurrentBalances(); // Обновить балансы для bridge
                      // Обновить статус UI
                      ui.updateBridgeStatus(selectedFromTokenBridge && selectedToTokenBridge ? "Нажмите 'Найти лучший путь'" : "Выберите сети и токены"); // selectedFromTokenBridge, selectedToTokenBridge должны быть доступны
                 } else if (tabName === 'telegram') {
                     telegram.checkTelegramStatus(); // Проверить статус телеграм для текущего аккаунта
                 }
             } else {
                 // Если кошелек не подключен, сбросить UI вкладок
                 if (tabName === 'swap') swap.resetState();
                 if (tabName === 'bridge') bridge.resetState();
                 if (tabName === 'telegram') telegram.resetState();
             }
        });
    });


    // === Обработчики для Свапа ===
     // ... (остается прежним)
    ui.elements.swapFromTokenBtn.addEventListener('click', () => swap.handleTokenSelectClick('from'));
    ui.elements.swapToTokenBtn.addEventListener('click', () => swap.handleTokenSelectClick('to'));
    ui.elements.getSwapQuoteBtn.addEventListener('click', swap.handleGetSwapQuote);
    ui.elements.approveSwapBtn.addEventListener('click', swap.handleApproveSwap);
    ui.elements.executeSwapBtn.addEventListener('click', swap.handleExecuteSwap);

     ui.elements.swapFromAmount.addEventListener('input', () => {
          ui.elements.swapToAmount.value = '';
          ui.updateSwapDetails(null);
          ui.elements.approveSwapBtn.classList.add('d-none'); // Скрываем кнопку апрува
          ui.elements.executeSwapBtn.classList.add('d-none'); // Скрываем кнопку свапа
           // Предполагаем, что selectedFromToken и selectedToToken доступны в глобальной области или импортированы
           if (swap.selectedFromToken && swap.selectedToToken) {
                ui.updateSwapStatus("Нажмите 'Получить курс'");
           } else {
                ui.updateSwapStatus("Выберите токены и сумму");
           }
     });


    // === Обработчики для Моста ===
     // ... (остается прежним)
     ui.elements.bridgeFromNetworkSelect.addEventListener('change', (event) => bridge.handleNetworkChange('from', event.target));
     ui.elements.bridgeToNetworkSelect.addEventListener('change', (event) => bridge.handleNetworkChange('to', event.target));
     ui.elements.bridgeFromTokenBtn.addEventListener('click', () => bridge.handleTokenSelectClickBridge('from'));
     ui.elements.bridgeToTokenBtn.addEventListener('click', () => bridge.handleTokenSelectClickBridge('to'));
     ui.elements.getBridgeQuoteBtn.addEventListener('click', bridge.handleGetBridgeQuote);
     ui.elements.approveBridgeBtn.addEventListener('click', bridge.handleApproveBridge);
     ui.elements.executeBridgeBtn.addEventListener('click', bridge.handleExecuteBridge);

      ui.elements.bridgeFromAmount.addEventListener('input', () => {
          ui.elements.bridgeToAmount.value = '';
          ui.updateBridgeDetails(null);
          ui.elements.approveBridgeBtn.classList.add('d-none');
          ui.elements.executeBridgeBtn.classList.add('d-none');
           // Предполагаем, что selectedFromTokenBridge и selectedToTokenBridge доступны
           if (bridge.selectedFromTokenBridge && bridge.selectedToTokenBridge) {
               ui.updateBridgeStatus("Нажмите 'Найти лучший путь'");
           } else {
                ui.updateBridgeStatus("Выберите сети и токены");
           }
      });


    // === Обработчики для Telegram ===
     ui.elements.linkTelegramBtn.addEventListener('click', telegram.requestLinkingCode);
     ui.elements.unlinkTelegramBtn.addEventListener('click', telegram.requestUnlinking);


    // === Обработчики для Модальных Окон ===
    // Обработчики закрытия модалок теперь обрабатываются Bootstrap JS

    // Обработчик поиска в модалке токенов
    ui.elements.tokenSearchInput.addEventListener('input', (event) => {
        ui.filterTokenList(event.target.value);
    });


    // === Начальное состояние UI ===
    ui.updateWalletStatus(null); // Установить начальный статус "Не подключен"
    ui.updateUIState(false); // Отключить формы по умолчанию
     // Изначально активируем вкладку 'swap' через Bootstrap
     const triggerTab = document.querySelector('#swap-tab-button');
     if (triggerTab) {
         new bootstrap.Tab(triggerTab).show();
     }
     bridge.populateNetworkSelects(); // Заполнить списки сетей моста при загрузке

     // Проверить статус кошелька при загрузке страницы
     // (Если пользователь уже подключен к сайту через MetaMask)
     wallet.connectWallet(); // Попробуем подключиться сразу, если провайдер есть и разрешен


});