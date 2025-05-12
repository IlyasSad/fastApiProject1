// js/app.js

document.addEventListener('DOMContentLoaded', () => {

    console.log("App loaded. Initializing...");

    // --- Инициализация ---

    // Обработчики подключения/отключения кошелька
    ui.elements.connectWalletBtn.addEventListener('click', wallet.connectWallet);
    ui.elements.disconnectWalletBtn.addEventListener('click', wallet.disconnectWallet);

    // Обработчики переключения вкладок Bootstrap
    document.querySelectorAll('.nav-link').forEach(button => {
        button.addEventListener('shown.bs.tab', async (event) => {
             const tabId = event.target.dataset.bsTarget.substring(1);

             const account = wallet.getAccount();
             const currentChainId = wallet.getChainId();

             // Сбросить статусы других вкладок при переключении (добавляем проверки)
             if (tabId !== 'swap' && window.swap && typeof window.swap.resetState === 'function') swap.resetState();
             if (tabId !== 'bridge' && window.bridge && typeof window.bridge.resetState === 'function') bridge.resetState();
             if (tabId !== 'telegram' && window.telegram && typeof window.telegram.resetState === 'function') telegram.resetState();

             if (account && currentChainId) {
                 const isNetworkSupported = !!wallet.getSupportedNetworks().find(net => net.chainId === currentChainId);

                 if (isNetworkSupported) {
                     // Вызываем обновление только если сеть поддерживается и соответствующий модуль загружен
                     if (tabId === 'swap' && window.swap && typeof window.swap.updateCurrentBalances === 'function') {
                         swap.updateCurrentBalances();
                          ui.updateSwapStatus(swap.selectedFromToken() && swap.selectedToToken() ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
                     } else if (tabId === 'bridge' && window.bridge && typeof window.bridge.updateCurrentBalances === 'function') {
                          // populateNetworkSelects вызывается в bridge.resetState()
                          bridge.updateCurrentBalances();
                           ui.updateBridgeStatus(bridge.selectedFromTokenBridge() && bridge.selectedToTokenBridge() ? "Нажмите 'Найти лучший путь'" : "Выберите сети и токены");
                     } else if (tabId === 'telegram' && window.telegram && typeof window.telegram.checkTelegramStatus === 'function') {
                          await telegram.checkTelegramStatus();
                     }
                 } else {
                     // Сеть не поддерживается, UI уже заблокирован
                      console.warn(`Switched to tab '${tabId}', but wallet network ID ${currentChainId} is not supported.`);
                      if (tabId === 'swap') ui.updateSwapStatus(`Текущая сеть (ID ${currentChainId}) не поддерживается для свапов.`);
                      if (tabId === 'bridge') ui.updateBridgeStatus(`Текущая сеть (ID ${currentChainId}) не поддерживается для мостов.`);
                      if (tabId === 'telegram') ui.updateTelegramStatus(`Текущая сеть (ID ${currentChainId}) не поддерживается.`);
                 }
             } else {
                 // Кошелек не подключен, UI заблокирован
                  console.log(`Switched to tab '${tabId}', but wallet is not connected.`);
                  if (tabId === 'swap') ui.updateSwapStatus("Подключите кошелек.");
                  if (tabId === 'bridge') ui.updateBridgeStatus("Подключите кошелек.");
                  if (tabId === 'telegram') ui.updateTelegramStatus("Подключите кошелек, чтобы проверить статус Telegram.");
             }
        });
    });

    // === Обработчики для Свапа ===
    ui.elements.swapFromTokenBtn.addEventListener('click', () => swap.handleTokenSelectClick('from'));
    ui.elements.swapToTokenBtn.addEventListener('click', () => swap.handleTokenSelectClick('to'));
    ui.elements.getSwapQuoteBtn.addEventListener('click', swap.handleGetSwapQuote);
    ui.elements.approveSwapBtn.addEventListener('click', swap.handleApproveSwap);
    ui.elements.executeSwapBtn.addEventListener('click', swap.handleExecuteSwap);

     ui.elements.swapFromAmount.addEventListener('input', () => {
          ui.elements.swapToAmount.value = '';
          ui.updateSwapDetails(null);
          ui.elements.approveSwapBtn.classList.add('d-none');
          ui.elements.executeSwapBtn.classList.add('d-none');
          // Проверяем существование swap перед вызовом его геттеров
          if (window.swap && swap.selectedFromToken() && swap.selectedToToken()) {
               ui.updateSwapStatus("Нажмите 'Получить курс'");
          } else {
               ui.updateSwapStatus("Выберите токены и сумму");
          }
     });

    // === Обработчики для Моста ===
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
           // Проверяем существование bridge перед вызовом его геттеров
           if (window.bridge && bridge.selectedFromTokenBridge() && bridge.selectedToTokenBridge()) {
               ui.updateBridgeStatus("Нажмите 'Найти лучший путь'");
           } else {
                ui.updateBridgeStatus("Выберите сети и токены");
           }
      });

    // === Обработчики для Telegram ===
     ui.elements.linkTelegramBtn.addEventListener('click', () => telegram.requestLinkingCode()); // Добавил вызов функции
     ui.elements.unlinkTelegramBtn.addEventListener('click', () => telegram.requestUnlinking()); // Добавил вызов функции


    // === Обработчики для Модальных Окон ===
    // Обработчики закрытия модалок через крестик или клик вне модалки обрабатываются Bootstrap JS

    // Обработчик поиска в модалке токенов
    ui.elements.tokenSearchInput.addEventListener('input', (event) => {
        ui.filterTokenList(event.target.value);
    });


    // === Начальное состояние UI при загрузке страницы ===
    ui.updateWalletStatus(null);
    ui.updateUIState(false);

     // Изначально активируем первую вкладку ('swap') с помощью Bootstrap JS
     // Событие 'shown.bs.tab' для этой вкладки запустит соответствующую логику инициализации
     const triggerTab = document.querySelector('#swap-tab-button');
     if (triggerTab) {
         const bsTab = new bootstrap.Tab(triggerTab);
         bsTab.show();
     }

     // Заполнить списки сетей моста при загрузке (даже без кошелька)
     // populateNetworkSelects вызывается в bridge.resetState, которое вызывается в tab handler'е
     // Если нужна инициализация до выбора вкладки, вызвать здесь явно:
     // if(window.bridge) bridge.populateNetworkSelects();


     // Попробуем подключиться к кошельку автоматически при загрузке страницы
     // Это сработает, если пользователь ранее уже дал разрешение сайту в MetaMask
     // Вызов connectWallet запустит event listeners в wallet.js, которые обновят UI и вызовут resetState/updateCurrentBalances
     // в соответствующих модулях (swap, bridge, telegram), благодаря проверкам на существование window.*
     wallet.connectWallet();


});