// js/ui.js

const $ = (id) => document.getElementById(id); // Вспомогательная функция для получения элемента
const ui = {}; // Глобальный объект ui

let tokenPickerModalInstance = null;
let transactionStatusModalInstance = null;

// Функция для инициализации всех ссылок на UI элементы и модальных окон
// Эта функция будет вызвана из app.js ВНУТРИ DOMContentLoaded
ui.initializeUI = function() {
    console.log("ui.js: Initializing UI elements and modals...");
    ui.elements = {
        // Элементы кошелька в шапке
        connectWalletBtn: $('connect-wallet-btn'),
        disconnectWalletBtn: $('disconnect-wallet-btn'),
        walletAddress: $('wallet-address'),
        walletNetwork: $('wallet-network'),

        // Кнопки вкладок
        swapTabButton: $('swap-tab-button'),
        bridgeTabButton: $('bridge-tab-button'),
        telegramTabButton: $('telegram-tab-button'),

        // Содержимое вкладок (не обязательно здесь, если не используются для прямого манипулирования)
        // swapTab: $('swap-tab'),
        // bridgeTab: $('bridge-tab'),
        // telegramTab: $('telegram-tab'),

        // Swap элементы
        swapNetworkSelect: $('swap-network-select'), // Селектор сети для свапа
        swapFromAmount: $('swap-from-amount'),
        swapFromTokenBtn: $('swap-from-token-btn'),
        swapFromBalance: $('swap-from-balance'),
        swapToAmount: $('swap-to-amount'),
        swapToTokenBtn: $('swap-to-token-btn'),
        swapDetails: $('swap-details'),
        getSwapQuoteBtn: $('get-swap-quote-btn'),
        executeSwapBtn: $('execute-swap-btn'),
        swapStatus: $('swap-status'),

        // Bridge элементы
        bridgeFromNetworkSelect: $('bridge-from-network'),
        bridgeToNetworkSelect: $('bridge-to-network'),
        bridgeFromAmount: $('bridge-from-amount'),
        bridgeFromTokenBtn: $('bridge-from-token-btn'),
        bridgeFromBalance: $('bridge-from-balance'),
        bridgeToAmount: $('bridge-to-amount'),
        bridgeToTokenBtn: $('bridge-to-token-btn'),
        bridgeDetails: $('bridge-details'),
        getBridgeQuoteBtn: $('get-bridge-quote-btn'),
        executeBridgeBtn: $('execute-bridge-btn'),
        bridgeStatus: $('bridge-status'),

        // Telegram элементы
        telegramStatus: $('telegram-status'),
        linkTelegramBtn: $('link-telegram-btn'),
        unlinkTelegramBtn: $('unlink-telegram-btn'),
        telegramLinkingInfo: $('telegram-linking-info'),
        telegramLinkingCode: $('telegram-linking-code'),
        telegramBotLink: $('telegram-bot-link'),
        telegramMessage: $('telegram-message'),

        // Modals - ссылки на DOM-элементы модалок
        tokenPickerModal: $('token-picker-modal'),
        tokenSearchInput: $('token-search'),
        tokenListUl: $('token-list'),

        transactionStatusModal: $('transaction-status-modal'),
        transactionModalStatus: $('transaction-modal-status'),
        transactionModalHash: $('transaction-modal-hash'),
        transactionModalExplorerLink: $('transaction-modal-explorer-link'),
    };

    // Инициализация модальных окон Bootstrap
    const tokenPickerModalElement = ui.elements.tokenPickerModal;
    if (tokenPickerModalElement) {
        tokenPickerModalInstance = new bootstrap.Modal(tokenPickerModalElement);
        tokenPickerModalElement.addEventListener('hidden.bs.modal', () => {
            // Очистка полей при скрытии модалки
            if(ui.elements.tokenSearchInput) ui.elements.tokenSearchInput.value = '';
            if(ui.elements.tokenListUl) ui.elements.tokenListUl.innerHTML = '';
        });
     } else {
        console.warn("UI: Token Picker Modal element not found.");
     }

    const transactionStatusModalElement = ui.elements.transactionStatusModal;
    if (transactionStatusModalElement) {
         transactionStatusModalInstance = new bootstrap.Modal(transactionStatusModalElement);
     } else {
        console.warn("UI: Transaction Status Modal element not found.");
     }
     console.log("ui.js: UI elements and modals initialized.");
};


// --- Функции для обновления UI (остаются как были, но теперь они будут использовать ui.elements, инициализированный выше) ---

ui.updateWalletStatus = function(account, networkName, chainId) {
    if (!ui.elements) { console.error("ui.elements not initialized in updateWalletStatus"); return; }
    if (account) {
        // ... (логика как была, используя ui.elements.connectWalletBtn и т.д.)
        if(ui.elements.connectWalletBtn) ui.elements.connectWalletBtn.classList.add('d-none');
        if(ui.elements.walletAddress) {
            ui.elements.walletAddress.textContent = `Адрес: ${utils.formatAddress(account)}`;
            ui.elements.walletAddress.classList.remove('d-none');
        }
        if(ui.elements.walletNetwork) {
            ui.elements.walletNetwork.textContent = `Сеть: ${networkName || 'Неизвестно'} (ID: ${chainId || 'N/A'})`;
            ui.elements.walletNetwork.classList.remove('d-none');
        }
        if(ui.elements.disconnectWalletBtn) ui.elements.disconnectWalletBtn.classList.remove('d-none');
    } else {
        if(ui.elements.connectWalletBtn) ui.elements.connectWalletBtn.classList.remove('d-none');
        if(ui.elements.walletAddress) ui.elements.walletAddress.classList.add('d-none');
        if(ui.elements.walletNetwork) ui.elements.walletNetwork.classList.add('d-none');
        if(ui.elements.disconnectWalletBtn) ui.elements.disconnectWalletBtn.classList.add('d-none');
    }
    // ui.updateUIState(!!account); // Вызывать updateUIState лучше после полной инициализации и определения сети
};

ui.updateUIState = function(isConnectedAndSupported) { // Переименовал параметр для ясности
    if (!ui.elements) { console.error("ui.elements not initialized in updateUIState"); return; }
    const formSections = document.querySelectorAll('.form-section');
    formSections.forEach(section => {
         const interactiveElements = section.querySelectorAll('input, button, select');
         interactiveElements.forEach(el => {
             if (el.id !== 'connect-wallet-btn' && el.id !== 'disconnect-wallet-btn') {
                  el.disabled = !isConnectedAndSupported;
             }
         });
    });
    // Специальная логика для кнопок Telegram
    if (ui.elements.linkTelegramBtn) {
        ui.elements.linkTelegramBtn.disabled = !wallet.getAccount(); // Активна если кошелек подключен, но не связана
        // Более сложная логика для link/unlink в telegram.js updateTelegramStatus
    }
    if (ui.elements.unlinkTelegramBtn) {
         // Логика активности этой кнопки в telegram.js ui.updateTelegramStatus
    }
};

ui.showTokenPickerModal = function(tokenList) {
    if (!ui.elements || !ui.elements.tokenListUl) { console.error("Token picker UI not ready."); return; }
    ui.elements.tokenListUl.innerHTML = '';
    tokenList.forEach(token => {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'list-group-item-action', 'd-flex', 'align-items-center'); // Добавил flex для выравнивания
        li.dataset.address = token.address;
        li.dataset.symbol = token.symbol;
        li.dataset.decimals = token.decimals;
        li.dataset.chainId = token.chain_id;
        const imgSrc = (token.logo_uri && typeof token.logo_uri === 'string' && token.logo_uri.startsWith('http')) ||
                       (token.logo_uri && typeof token.logo_uri === 'string' && token.logo_uri.startsWith('/static/'))
                      ? token.logo_uri
                      : `https://via.placeholder.com/24/777/fff?text=${token.symbol ? token.symbol[0].toUpperCase() : '?'}`;
        li.innerHTML = `<img src="${imgSrc}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 24px; height: 24px; object-fit: cover;"> 
                        <span class="flex-grow-1">${token.symbol} - ${token.name}</span>
                        <small class="text-muted">Chain: ${token.chain_id}</small>`; // Показываем chainId для отладки
        ui.elements.tokenListUl.appendChild(li);
    });
    if (tokenPickerModalInstance) tokenPickerModalInstance.show();
};

ui.hideTokenPickerModal = function() {
    if (tokenPickerModalInstance) tokenPickerModalInstance.hide();
};

ui.filterTokenList = function(searchText) {
    if (!ui.elements || !ui.elements.tokenListUl) return;
    const filter = searchText.toUpperCase();
    const listItems = ui.elements.tokenListUl.getElementsByTagName('li');
    for (let i = 0; i < listItems.length; i++) {
        const text = listItems[i].textContent || listItems[i].innerText;
        listItems[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
};

ui.updateTokenBalanceDisplay = function(elementId, balance, decimals) {
    if (!ui.elements) return; // Элементы еще могут быть не готовы
    const balanceSpan = $(elementId); // Используем $() так как ui.elements[elementId] может не быть
    if (balanceSpan) {
        const formattedBalance = (balance !== undefined && balance !== null && balance !== 'Загрузка...')
            ? utils.formatTokenAmount(balance, decimals, 6)
            : (balance === 'Загрузка...' ? balance : 'N/A');
        balanceSpan.textContent = `Баланс: ${formattedBalance}`;
    }
};

ui.updateSwapDetails = function(quoteData, fromToken, toToken) {
    if (!ui.elements || !ui.elements.swapDetails) return;
    const swapDetailsElement = ui.elements.swapDetails;
    // ... (логика как была, используя ui.elements.swapDetails) ...
    if (!quoteData || !fromToken || !toToken) {
        swapDetailsElement.innerHTML = '';
        swapDetailsElement.classList.add('d-none');
        return;
    }
    swapDetailsElement.classList.remove('d-none');
    let detailsHtml = `<p class="mb-1">Обмен ${fromToken.symbol} → ${toToken.symbol}</p>`;
    if (quoteData.quote?.routeSummary?.length) {
        detailsHtml += `<p class="mb-1">Маршрут: ${quoteData.quote.routeSummary.join(' → ')}</p>`;
    } else if (quoteData.steps?.length) {
        const protocols = quoteData.steps.map(step => step.tool || step.id).filter(Boolean).join(', ');
        if (protocols) detailsHtml += `<p class="mb-1">Через: ${protocols}</p>`;
    }
    if (quoteData.quote?.estimatedDuration) {
        detailsHtml += `<p class="mb-0">Время: ~${Math.ceil(quoteData.quote.estimatedDuration / 60)} мин</p>`;
    }
    swapDetailsElement.innerHTML = detailsHtml;
};

ui.updateSwapStatus = function(message) {
    if (ui.elements && ui.elements.swapStatus) {
        ui.elements.swapStatus.textContent = message;
    }
};

ui.populateNetworkSelect = function(selectElementId, networks, selectedChainId = null) {
    // Эта функция вызывается из bridge.js и swap.js, ui.elements может быть еще не готов при первом вызове из app.js
    // Поэтому используем document.getElementById напрямую
    const selectElement = document.getElementById(selectElementId); // Используем document.getElementById
    if (!selectElement) {
        console.warn(`populateNetworkSelect: Element with ID '${selectElementId}' not found.`);
        return;
    }
    // ... (логика как была) ...
    selectElement.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "-- Выберите сеть --";
    // defaultOption.disabled = true; // Не делаем disabled, чтобы можно было выбрать "ничего"
    defaultOption.selected = selectedChainId === null; // Выбираем, если нет selectedChainId
    selectElement.appendChild(defaultOption);

    if (networks && networks.length > 0) {
        networks.forEach(network => {
            const option = document.createElement('option');
            option.value = network.chainId;
            option.textContent = `${network.name} (ID: ${network.chainId})`;
            if (selectedChainId !== null && network.chainId === selectedChainId) {
                option.selected = true;
                defaultOption.selected = false;
            }
            selectElement.appendChild(option);
        });
    } else {
        // Если нет сетей, можно добавить сообщение
        const noNetOption = document.createElement('option');
        noNetOption.textContent = "Сети не загружены";
        noNetOption.disabled = true;
        selectElement.appendChild(noNetOption);
    }
    // Триггер 'change' не нужен здесь, он вызовется при выборе пользователем или программной смене value
};

ui.updateBridgeDetails = function(quoteData, fromChain, toChain, fromToken, toToken) {
    if (!ui.elements || !ui.elements.bridgeDetails) return;
    const bridgeDetailsElement = ui.elements.bridgeDetails;
    // ... (логика как была) ...
    if (!quoteData || !fromChain || !toChain || !fromToken || !toToken) {
        bridgeDetailsElement.innerHTML = '';
        bridgeDetailsElement.classList.add('d-none');
        return;
    }
    bridgeDetailsElement.classList.remove('d-none');
    let detailsHtml = `<p class="mb-1">Путь: ${fromToken.symbol} (${fromChain.name}) → ${toToken.symbol} (${toChain.name})</p>`;
     if (quoteData.quote?.routeSummary?.length) {
        detailsHtml += `<p class="mb-1">Маршрут: ${quoteData.quote.routeSummary.join(' → ')}</p>`;
    }
    if (quoteData.quote?.estimatedDuration) {
        detailsHtml += `<p class="mb-0">Время: ~${Math.ceil(quoteData.quote.estimatedDuration / 60)} мин</p>`;
    }
    bridgeDetailsElement.innerHTML = detailsHtml;
};

ui.updateBridgeStatus = function(message) {
    if (ui.elements && ui.elements.bridgeStatus) {
        ui.elements.bridgeStatus.textContent = message;
    }
};

ui.updateTelegramStatus = function(message, isLinked = false) {
    if (!ui.elements) return;
    // ... (логика как была, используя ui.elements...) ...
    if(ui.elements.telegramStatus) ui.elements.telegramStatus.textContent = `Статус: ${message}`;
    if(ui.elements.linkTelegramBtn) ui.elements.linkTelegramBtn.classList.toggle('d-none', isLinked);
    if(ui.elements.unlinkTelegramBtn) {
        ui.elements.unlinkTelegramBtn.classList.toggle('d-none', !isLinked);
        ui.elements.unlinkTelegramBtn.disabled = !isLinked; // Дополнительно
    }
};

ui.showTelegramLinkingCode = function(code, botUsername) {
    if (!ui.elements) return;
    // ... (логика как была) ...
    if(ui.elements.telegramLinkingCode) ui.elements.telegramLinkingCode.textContent = code;
    if(ui.elements.telegramBotLink) {
        ui.elements.telegramBotLink.textContent = `@${botUsername}`;
        ui.elements.telegramBotLink.href = `https://t.me/${botUsername}`;
    }
    if(ui.elements.telegramLinkingInfo) ui.elements.telegramLinkingInfo.classList.remove('d-none');
    if(ui.elements.telegramMessage) ui.elements.telegramMessage.textContent = "";
};

ui.updateTelegramMessage = function(message) {
    if (ui.elements && ui.elements.telegramMessage) {
        ui.elements.telegramMessage.textContent = message;
    }
};

ui.showTransactionStatusModal = function(statusText, transactionHash, explorerUrl = null) {
    if (!ui.elements) return;
    // ... (логика как была) ...
    if(ui.elements.transactionModalStatus) ui.elements.transactionModalStatus.textContent = `Статус: ${statusText}`;
    if(ui.elements.transactionModalHash) ui.elements.transactionModalHash.textContent = transactionHash ? `Хэш: ${utils.formatAddress(transactionHash)}` : '';
    if(ui.elements.transactionModalExplorerLink) {
        if (explorerUrl) {
            ui.elements.transactionModalExplorerLink.href = explorerUrl;
            ui.elements.transactionModalExplorerLink.classList.remove('d-none');
        } else {
            ui.elements.transactionModalExplorerLink.classList.add('d-none');
        }
    }
    if (transactionStatusModalInstance && (!transactionStatusModalInstance._isShown && transactionStatusModalInstance._element && !transactionStatusModalInstance._element.classList.contains('show'))) {
        transactionStatusModalInstance.show();
    } else if (!transactionStatusModalInstance) {
        console.warn("Transaction status modal instance not available yet in showTransactionStatusModal.");
    }
};

ui.hideTransactionStatusModal = function() {
    if (transactionStatusModalInstance && transactionStatusModalInstance._isShown) { // Проверяем, показана ли модалка
        transactionStatusModalInstance.hide();
    }
};

// Экспортируем ui объект, чтобы он был доступен глобально
window.ui = ui;