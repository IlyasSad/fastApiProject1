// js/app.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App loaded. DOMContentLoaded triggered for app.js.");

    // 1. Первым делом инициализируем UI элементы!
    if (window.ui && typeof window.ui.initializeUI === 'function') {
        window.ui.initializeUI(); // Это заполнит ui.elements и инициализирует модалки
    } else {
        console.error("CRITICAL: ui.initializeUI function is not available! UI dependent features will fail.");
        // Можно показать пользователю сообщение об ошибке или заблокировать приложение
        document.body.innerHTML = '<div class="alert alert-danger m-5" role="alert">Ошибка инициализации приложения. Пожалуйста, обновите страницу или попробуйте позже.</div>';
        return; // Прерываем выполнение, если UI не может быть инициализирован
    }

    // 2. Затем загружаем конфигурацию сетей с бэкенда
    console.log("app.js: Loading supported networks...");
    if (window.wallet && typeof window.wallet.loadSupportedNetworks === 'function') {
        await window.wallet.loadSupportedNetworks();
        console.log("app.js: Supported networks loading attempt finished.");

        // 3. Теперь, когда ui.elements и supportedNetworks (потенциально) доступны,
        // инициализируем селекторы моста. Селектор свапа инициализируется при активации вкладки.
        if (window.bridge && typeof window.bridge.populateNetworkSelects === 'function') {
            console.log("app.js: Populating bridge network selects...");
            window.bridge.populateNetworkSelects();
        } else {
            console.warn("app.js: bridge.populateNetworkSelects not available.");
        }
    } else {
        console.error("app.js: wallet.loadSupportedNetworks function is not available. Network-dependent UI might not initialize correctly.");
    }

    // 4. Устанавливаем слушатели и остальную логику приложения
    console.log("app.js: Setting up event listeners and main application logic...");

    // Проверяем ui.elements перед добавлением слушателей
    if (ui.elements && ui.elements.connectWalletBtn) {
        ui.elements.connectWalletBtn.addEventListener('click', wallet.connectWallet);
    } else { console.warn("app.js: Connect wallet button not found."); }

    if (ui.elements && ui.elements.disconnectWalletBtn) {
        ui.elements.disconnectWalletBtn.addEventListener('click', wallet.disconnectWallet);
    } else { console.warn("app.js: Disconnect wallet button not found."); }


    // Обработчики для переключения вкладок Bootstrap
    document.querySelectorAll('.nav-link[data-bs-toggle="tab"]').forEach(button => {
        button.addEventListener('shown.bs.tab', async (event) => {
            const tabId = event.target.dataset.bsTarget.substring(1).replace('-tab','');
            const account = wallet.getAccount();
            const currentWalletChainId = wallet.getChainId();
            console.log(`App.js: Switched to tab: ${tabId}`);

            if (tabId !== 'telegram' && window.telegram?.resetState) window.telegram.resetState();
            if (tabId !== 'swap' && window.swap?.resetState) await window.swap.resetState();
            if (tabId !== 'bridge' && window.bridge?.resetState) await window.bridge.resetState();

            if (account && currentWalletChainId !== null) { // Убедимся, что currentWalletChainId определен
                const isNetworkSupportedByApp = !!wallet.getSupportedNetworks().find(net => net.chainId === currentWalletChainId);
                if (isNetworkSupportedByApp) {
                    if (tabId === 'swap' && window.swap?.initializeSwapNetworkSelector) await window.swap.initializeSwapNetworkSelector();
                    else if (tabId === 'bridge') {
                        if(window.bridge?.populateNetworkSelects) window.bridge.populateNetworkSelects();
                        if(window.bridge?.updateCurrentBalances) await window.bridge.updateCurrentBalances();
                        // Обновление статуса моста
                        const fromChainB = window.bridge?.selectedFromChainId?.();
                        const toChainB = window.bridge?.selectedToChainId?.();
                        const fromTokenB = window.bridge?.selectedFromTokenBridge?.();
                        const toTokenB = window.bridge?.selectedToTokenBridge?.();
                        if(ui.updateBridgeStatus) ui.updateBridgeStatus(fromChainB && toChainB && fromTokenB && toTokenB ? "Найти лучший путь" : "Выберите сети и токены");

                    } else if (tabId === 'telegram' && window.telegram?.checkTelegramStatus) {
                        await telegram.checkTelegramStatus();
                        if(telegram.startPolling) telegram.startPolling();
                    }
                } else { // Сеть кошелька не поддерживается приложением
                    const networkName = wallet.getNetworkName() || `ID ${currentWalletChainId}`;
                    if (tabId === 'swap') {
                        if(window.swap?.initializeSwapNetworkSelector) await window.swap.initializeSwapNetworkSelector(); // Селектор все равно инициализировать
                        if(ui.updateSwapStatus) ui.updateSwapStatus(`Кошелек на неподдерживаемой сети "${networkName}". Выберите другую сеть для свапа.`);
                    }
                    if (tabId === 'bridge') {
                        if(window.bridge?.populateNetworkSelects) window.bridge.populateNetworkSelects();
                        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Кошелек на неподдерживаемой сети "${networkName}".`);
                    }
                    if (tabId === 'telegram' && window.telegram) {
                        if(ui.updateTelegramStatus) ui.updateTelegramStatus(`Кошелек на неподдерживаемой сети "${networkName}".`);
                        if(telegram.stopPolling) telegram.stopPolling();
                    }
                }
            } else { // Кошелек не подключен или chainId еще не определен
                if (tabId === 'swap') {
                    if(window.swap?.initializeSwapNetworkSelector) await window.swap.initializeSwapNetworkSelector();
                    if(ui.updateSwapStatus) ui.updateSwapStatus("Подключите кошелек.");
                }
                if (tabId === 'bridge') {
                    if(window.bridge?.populateNetworkSelects) window.bridge.populateNetworkSelects();
                    if(ui.updateBridgeStatus) ui.updateBridgeStatus("Подключите кошелек.");
                }
                if (tabId === 'telegram' && ui.updateTelegramStatus) {
                    ui.updateTelegramStatus("Подключите кошелек для проверки статуса Telegram.");
                }
            }
        });
    });

    // === Обработчики для Свапа ===
    if (ui.elements?.swapNetworkSelect && window.swap?.handleSwapNetworkChange) { // Добавил проверку
        ui.elements.swapNetworkSelect.addEventListener('change', swap.handleSwapNetworkChange);
    } else { console.warn("app.js: Swap network select or its handler not found."); }
    // ... (остальные слушатели для Свапа, Моста, Telegram, Модалок с аналогичными проверками ui.elements.X)

    if (ui.elements?.swapFromTokenBtn && swap?.handleTokenSelectClick) ui.elements.swapFromTokenBtn.addEventListener('click', () => swap.handleTokenSelectClick('from'));
    if (ui.elements?.swapToTokenBtn && swap?.handleTokenSelectClick) ui.elements.swapToTokenBtn.addEventListener('click', () => swap.handleTokenSelectClick('to'));
    if (ui.elements?.getSwapQuoteBtn && swap?.handleGetSwapQuote) ui.elements.getSwapQuoteBtn.addEventListener('click', swap.handleGetSwapQuote);
    if (ui.elements?.executeSwapBtn && swap?.handleExecuteSwap) ui.elements.executeSwapBtn.addEventListener('click', swap.handleExecuteSwap);
    if (ui.elements?.swapFromAmount) {
        ui.elements.swapFromAmount.addEventListener('input', () => {
            if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = '';
            if(ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);
            if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
            if(ui.elements.getSwapQuoteBtn) ui.elements.getSwapQuoteBtn.disabled = false;
            const swapNetId = window.swap?.selectedSwapNetworkId?.();
            const fromToken = window.swap?.selectedFromToken?.();
            const toToken = window.swap?.selectedToToken?.();
            if(ui.updateSwapStatus) {
                if (!swapNetId) ui.updateSwapStatus("Выберите сеть для свапа.");
                else if (fromToken && toToken) ui.updateSwapStatus("Нажмите 'Получить курс'");
                else ui.updateSwapStatus("Выберите токены и сумму");
            }
        });
    }

    // === Обработчики для Моста ===
    if (ui.elements?.bridgeFromNetworkSelect && bridge?.handleNetworkChange) ui.elements.bridgeFromNetworkSelect.addEventListener('change', (event) => bridge.handleNetworkChange('from', event.target));
    if (ui.elements?.bridgeToNetworkSelect && bridge?.handleNetworkChange) ui.elements.bridgeToNetworkSelect.addEventListener('change', (event) => bridge.handleNetworkChange('to', event.target));
    if (ui.elements?.bridgeFromTokenBtn && bridge?.handleTokenSelectClickBridge) ui.elements.bridgeFromTokenBtn.addEventListener('click', () => bridge.handleTokenSelectClickBridge('from'));
    if (ui.elements?.bridgeToTokenBtn && bridge?.handleTokenSelectClickBridge) ui.elements.bridgeToTokenBtn.addEventListener('click', () => bridge.handleTokenSelectClickBridge('to'));
    if (ui.elements?.getBridgeQuoteBtn && bridge?.handleGetBridgeQuote) ui.elements.getBridgeQuoteBtn.addEventListener('click', bridge.handleGetBridgeQuote);
    if (ui.elements?.executeBridgeBtn && bridge?.handleExecuteBridge) ui.elements.executeBridgeBtn.addEventListener('click', bridge.handleExecuteBridge);
    if (ui.elements?.bridgeFromAmount) {
        ui.elements.bridgeFromAmount.addEventListener('input', () => {
            if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = '';
            if(ui.updateBridgeDetails) ui.updateBridgeDetails(null, null, null, null, null);
            if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
            if(ui.elements.getBridgeQuoteBtn) ui.elements.getBridgeQuoteBtn.disabled = false;
            // ... (обновление статуса bridge)
        });
    }

    // === Обработчики для Telegram ===
    if (ui.elements?.linkTelegramBtn && telegram?.requestLinkingCode) ui.elements.linkTelegramBtn.addEventListener('click', telegram.requestLinkingCode);
    if (ui.elements?.unlinkTelegramBtn && telegram?.requestUnlinking) ui.elements.unlinkTelegramBtn.addEventListener('click', telegram.requestUnlinking);

    // === Обработчики для Модальных Окон ===
    if (ui.elements?.tokenSearchInput && ui.filterTokenList) ui.elements.tokenSearchInput.addEventListener('input', (event) => ui.filterTokenList(event.target.value));


    // === Начальное состояние UI (вызывается перед подключением кошелька) ===
    if (ui.updateWalletStatus) ui.updateWalletStatus(null);
    if (ui.updateUIState) ui.updateUIState(false); // Блокируем формы, если кошелек не подключен

    // Изначально активируем первую вкладку ('swap')
    const initialActiveTabButton = document.querySelector('#swap-tab-button');
    if (initialActiveTabButton) {
        setTimeout(async () => { // setTimeout 0 для выполнения после текущего стека вызовов
            const bsTab = new bootstrap.Tab(initialActiveTabButton);
            bsTab.show(); // Это вызовет событие 'shown.bs.tab'
        }, 0);
    } else {
        console.error("app.js: Initial active tab button (swap-tab-button) not found!");
    }

    // Попытка автоподключения кошелька
    if (wallet.connectWallet) {
        await wallet.connectWallet(); // Сделаем await, если connectWallet асинхронный
    }
    console.log("app.js: Application initialization sequence complete.");
});

// Глобальные обработчики ошибок
window.addEventListener('error', (event) => {
    console.error("Uncaught Global error in window:", event.error || event.message, event);
});
window.addEventListener('unhandledrejection', (event) => {
    console.error("Unhandled Global promise rejection in window:", event.reason, event);
});