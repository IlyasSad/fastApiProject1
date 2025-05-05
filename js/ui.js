// js/ui.js

// Вспомогательная функция для получения элемента по ID
const $ = (id) => document.getElementById(id);

// Получаем экземпляры модальных окон Bootstrap
let tokenPickerModalInstance = null;
let transactionStatusModalInstance = null;

// Добавляем слушатель для инициализации модальных окон после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const tokenPickerModalElement = $('token-picker-modal');
    if (tokenPickerModalElement) {
         // Инициализируем модальное окно Bootstrap
        tokenPickerModalInstance = new bootstrap.Modal(tokenPickerModalElement);
        // Добавляем обработчик на событие скрытия модалки
        tokenPickerModalElement.addEventListener('hidden.bs.modal', () => {
            ui.elements.tokenSearchInput.value = ''; // Очистить поиск при закрытии
            ui.elements.tokenListUl.innerHTML = ''; // Очистить список
        });
     }

    const transactionStatusModalElement = $('transaction-status-modal');
    if (transactionStatusModalElement) {
         // Инициализируем модальное окно Bootstrap
         transactionStatusModalInstance = new bootstrap.Modal(transactionStatusModalElement);
     }

     // Обработчики закрытия модалок через крестик или клик вне модалки теперь обрабатываются Bootstrap
});


const ui = {
    elements: {
        // Элементы кошелька в шапке
        connectWalletBtn: $('connect-wallet-btn'),
        disconnectWalletBtn: $('disconnect-wallet-btn'),
        walletAddress: $('wallet-address'),
        walletNetwork: $('wallet-network'),

        // Кнопки вкладок (используются для получения элементов, переключение делает Bootstrap)
        swapTabButton: $('swap-tab-button'),
        bridgeTabButton: $('bridge-tab-button'),
        telegramTabButton: $('telegram-tab-button'),

        // Содержимое вкладок (используется для получения элементов внутри)
        swapTab: $('swap-tab'),
        bridgeTab: $('bridge-tab'),
        telegramTab: $('telegram-tab'),


        // Swap элементы
        swapFromAmount: $('swap-from-amount'),
        swapFromTokenBtn: $('swap-from-token-btn'),
        swapFromBalance: $('swap-from-balance'),
        swapToAmount: $('swap-to-amount'),
        swapToTokenBtn: $('swap-to-token-btn'),
        // swapToBalance - обычно не показывается для свапа на UI
        swapDetails: $('swap-details'), // Bootstrap Alert
        getSwapQuoteBtn: $('get-swap-quote-btn'),
        approveSwapBtn: $('approve-swap-btn'),
        executeSwapBtn: $('execute-swap-btn'),
        swapStatus: $('swap-status'), // <p> для статуса

        // Bridge элементы
        bridgeFromNetworkSelect: $('bridge-from-network'),
        bridgeToNetworkSelect: $('bridge-to-network'),
        bridgeFromAmount: $('bridge-from-amount'),
        bridgeFromTokenBtn: $('bridge-from-token-btn'),
        bridgeFromBalance: $('bridge-from-balance'),
        bridgeToAmount: $('bridge-to-amount'),
        bridgeToTokenBtn: $('bridge-to-token-btn'),
        bridgeDetails: $('bridge-details'), // Bootstrap Alert
        getBridgeQuoteBtn: $('get-bridge-quote-btn'),
        approveBridgeBtn: $('approve-bridge-btn'),
        executeBridgeBtn: $('execute-bridge-btn'),
        bridgeStatus: $('bridge-status'), // <p> для статуса

        // Telegram элементы
        telegramStatus: $('telegram-status'), // <p> Lead
        linkTelegramBtn: $('link-telegram-btn'), // Bootstrap Button
        unlinkTelegramBtn: $('unlink-telegram-btn'), // Bootstrap Button
        telegramLinkingInfo: $('telegram-linking-info'), // Bootstrap Alert
        telegramLinkingCode: $('telegram-linking-code'), // <strong><span> для кода
        telegramBotLink: $('telegram-bot-link'), // <a> для ссылки на бота
        telegramMessage: $('telegram-message'), // <p> для сообщений

        // Modals - ссылки на DOM-элементы модалок (div)
        tokenPickerModal: $('token-picker-modal'),
        tokenSearchInput: $('token-search'),
        tokenListUl: $('token-list'), // <ul> для списка токенов

        transactionStatusModal: $('transaction-status-modal'),
        transactionModalStatus: $('transaction-modal-status'),
        transactionModalHash: $('transaction-modal-hash'),
        transactionModalExplorerLink: $('transaction-modal-explorer-link'), // <a> для ссылки

    },

    // Обновление статуса кошелька в шапке (используем классы d-none из Bootstrap)
    updateWalletStatus(account, networkName, chainId) {
        if (account) {
            ui.elements.connectWalletBtn.classList.add('d-none');
            ui.elements.walletAddress.textContent = `Адрес: ${utils.formatAddress(account)}`;
            ui.elements.walletNetwork.textContent = `Сеть: ${networkName || 'Неизвестно'} (ID: ${chainId})`;
            ui.elements.walletAddress.classList.remove('d-none');
            ui.elements.walletNetwork.classList.remove('d-none');
            ui.elements.disconnectWalletBtn.classList.remove('d-none');
        } else {
            ui.elements.connectWalletBtn.classList.remove('d-none');
            ui.elements.walletAddress.classList.add('d-none');
            ui.elements.walletNetwork.classList.add('d-none');
            ui.elements.disconnectWalletBtn.classList.add('d-none');
        }
         ui.updateUIState(!!account); // Обновить состояние форм в зависимости от подключения
    },

    // Переключение вкладок (опираемся на Bootstrap JS)
    // Эта функция может быть использована программно, чтобы переключить вкладку
    switchTab(tabName) {
         const tabButton = document.querySelector(`.nav-link[data-bs-target="#${tabName}-tab"]`);
         if (tabButton) {
             const bsTab = new bootstrap.Tab(tabButton);
             bsTab.show(); // Переключает вкладку с помощью Bootstrap JS
         }
    },

    // Обновление состояния UI (блокировка/разблокировка элементов формы)
    updateUIState(isConnected) {
        const formSections = document.querySelectorAll('.form-section');
        formSections.forEach(section => {
             // Отключаем интерактивные элементы внутри секции
             const interactiveElements = section.querySelectorAll('input, button, select');
             interactiveElements.forEach(el => {
                 // Исключаем кнопки подключения/отключения кошелька, так как они всегда активны или скрыты Bootstrap классами
                 if (el.id !== 'connect-wallet-btn' && el.id !== 'disconnect-wallet-btn') {
                      el.disabled = !isConnected;
                 }
             });
             // Кнопка подключения Telegram всегда активна, если не подключен кошелек
             // (логика в telegram.js будет проверять наличие аккаунта перед запросом кода)
             ui.elements.linkTelegramBtn.disabled = false;
             // Кнопка отключения Telegram активна только если кошелек подключен И аккаунт связан (логика в telegram.js)
             // Здесь просто отключаем, если кошелек не подключен
              ui.elements.unlinkTelegramBtn.disabled = !isConnected;
        });

         // Отдельно управляем доступностью кнопок "Разрешить" и "Выполнить" в Swap/Bridge
         // Они изначально скрыты и включаются/отключаются логикой swap.js и bridge.js
    },


    // Модальное окно выбора токена (используем Bootstrap Modal JS)
    showTokenPickerModal(tokenList, currentChainId) {
        ui.elements.tokenListUl.innerHTML = ''; // Очистить список

        tokenList.forEach(token => {
            const li = document.createElement('li');
            // Используем классы Bootstrap list-group
            li.classList.add('list-group-item', 'list-group-item-action');
            li.dataset.address = token.address;
            li.dataset.symbol = token.symbol;
            li.dataset.decimals = token.decimals;
            li.dataset.chainId = token.chain_id; // Используем chain_id токена из бэкенда
            li.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol} - ${token.name}`; // Bootstrap классы для картинки
            ui.elements.tokenListUl.appendChild(li);
        });

         // Показываем модалку через Bootstrap JS
        if (tokenPickerModalInstance) {
            tokenPickerModalInstance.show();
        }
    },

    hideTokenPickerModal() {
         // Скрываем модалку через Bootstrap JS
        if (tokenPickerModalInstance) {
            tokenPickerModalInstance.hide();
        }
         // Очистка полей перенесена в обработчик события 'hidden.bs.modal' в DOMContentLoaded
    },

    // Фильтрация списка токенов в модалке
    filterTokenList(searchText) {
        const filter = searchText.toUpperCase();
        const listItems = ui.elements.tokenListUl.getElementsByTagName('li');
        for (let i = 0; i < listItems.length; i++) {
            const text = listItems[i].textContent || listItems[i].innerText;
            if (text.toUpperCase().indexOf(filter) > -1) {
                listItems[i].style.display = "";
            } else {
                listItems[i].style.display = "none";
            }
        }
    },

     // Обновление отображения баланса токена (используется <small class="form-text">)
     updateTokenBalanceDisplay(elementId, balance, decimals) {
         const balanceSpan = $(elementId);
         if (balanceSpan) {
              // Проверяем, что balance не null или undefined перед форматированием
              const formattedBalance = (balance !== undefined && balance !== null)
                  ? utils.formatTokenAmount(balance, decimals, 6) // Показать больше знаков для баланса
                  : 'N/A';
              balanceSpan.textContent = `Баланс: ${formattedBalance}`;
         }
     },


    // Обновление деталей свапа (используем Bootstrap Alert)
    updateSwapDetails(details) {
        const swapDetailsElement = ui.elements.swapDetails;
        if (!details) {
            swapDetailsElement.innerHTML = '';
            swapDetailsElement.classList.add('d-none'); // Скрываем alert
            return;
        }
         swapDetailsElement.classList.remove('d-none'); // Показываем alert
        swapDetailsElement.innerHTML = `
            <p class="mb-1">Получить: ~${utils.formatTokenAmount(details.toAmount, details.toToken.decimals, 6)} ${details.toToken.symbol}</p>
            <p class="mb-1">Протокол: ${details.protocol || 'Агрегатор'}</p>
            <p class="mb-0">Примерная комиссия сети: ${utils.formatTokenAmount(details.gasCost?.amount, details.gasCost?.decimals, 6)} ${details.gasCost?.token.symbol || 'ETH/MATIC'}</p>
            <!-- Добавьте другие детали по необходимости -->
        `;
    },

    // Обновление статуса свапа (используется <p>)
    updateSwapStatus(message) {
        ui.elements.swapStatus.textContent = message;
    },

     // Обновление списка сетей для моста (используется <select>)
    populateNetworkSelect(selectElementId, networks, selectedChainId = null) {
        const selectElement = $(selectElementId);
        if (!selectElement) return;
        selectElement.innerHTML = ''; // Очистить

         // Добавляем пустую опцию или опцию по умолчанию
         const defaultOption = document.createElement('option');
         defaultOption.value = "";
         defaultOption.textContent = "-- Выберите сеть --";
         defaultOption.disabled = true;
         defaultOption.selected = (selectedChainId === null || selectedChainId === undefined); // Выбираем по умолчанию, если selectedChainId не указан
         selectElement.appendChild(defaultOption);


        networks.forEach(network => {
            const option = document.createElement('option');
            option.value = network.chainId;
            option.textContent = network.name;
            if (selectedChainId !== null && network.chainId === selectedChainId) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
         // Триггернуть событие change, если был выбран элемент по умолчанию или установлен selectedChainId
         if (selectedChainId !== null || networks.length > 0) {
              selectElement.dispatchEvent(new Event('change'));
         }
    },


    // Обновление деталей моста (используем Bootstrap Alert)
    updateBridgeDetails(details) {
         const bridgeDetailsElement = ui.elements.bridgeDetails;
         if (!details) {
             bridgeDetailsElement.innerHTML = '';
             bridgeDetailsElement.classList.add('d-none'); // Скрываем alert
             return;
         }
         bridgeDetailsElement.classList.remove('d-none'); // Показываем alert
         // Пример, структура деталей зависит от выбранного агрегатора/моста
         bridgeDetailsElement.innerHTML = `
             <p class="mb-1">Путь: ${details.fromToken.symbol} на ${details.fromChain.name} → ${details.toToken.symbol} на ${details.toChain.name}</p>
             <p class="mb-1">Ожидаемое получение: ~${utils.formatTokenAmount(details.toAmount, details.toToken.decimals, 6)} ${details.toToken.symbol}</p>
             <p class="mb-1">Протокол: ${details.protocol || 'Агрегатор'}</p>
             <p class="mb-1">Примерное время: ${details.estimatedTime || 'N/A'}</p>
              <p class="mb-0">Примерная комиссия сети: ${utils.formatTokenAmount(details.gasCost?.amount, details.gasCost?.decimals, 6)} ${details.gasCost?.token.symbol || 'ETH/MATIC'}</p>
              <!-- Добавьте другие детали по необходимости -->
         `;
    },

    // Обновление статуса моста (используется <p>)
    updateBridgeStatus(message) {
         ui.elements.bridgeStatus.textContent = message;
    },

    // Обновление статуса Telegram (используем <p lead> и Bootstrap Alert)
    updateTelegramStatus(message, isLinked = false) {
        ui.elements.telegramStatus.textContent = `Статус: ${message}`;
         if (isLinked) {
            ui.elements.linkTelegramBtn.classList.add('d-none');
             ui.elements.unlinkTelegramBtn.classList.remove('d-none');
         } else {
             ui.elements.linkTelegramBtn.classList.remove('d-none');
             ui.elements.unlinkTelegramBtn.classList.add('d-none');
         }
    },

    showTelegramLinkingCode(code, botUsername) {
        ui.elements.telegramLinkingCode.textContent = code;
        ui.elements.telegramBotLink.textContent = `@${botUsername}`;
        ui.elements.telegramBotLink.href = `https://t.me/${botUsername}`; // Ссылка на бота
        ui.elements.telegramLinkingInfo.classList.remove('d-none'); // Показываем alert
         ui.updateTelegramMessage(""); // Очистить предыдущие сообщения
    },

    updateTelegramMessage(message) {
         ui.elements.telegramMessage.textContent = message;
    },


     // Модальное окно статуса транзакции (используем Bootstrap Modal JS)
     showTransactionStatusModal(statusText, transactionHash, explorerUrl = null) {
        ui.elements.transactionModalStatus.textContent = `Статус: ${statusText}`;
        if (transactionHash) {
             ui.elements.transactionModalHash.textContent = `Хэш: ${utils.formatAddress(transactionHash)}`;
             if (explorerUrl) {
                 ui.elements.transactionModalExplorerLink.href = explorerUrl;
                 ui.elements.transactionModalExplorerLink.classList.remove('d-none');
             } else {
                 ui.elements.transactionModalExplorerLink.classList.add('d-none');
             }
        } else {
            ui.elements.transactionModalHash.textContent = '';
            ui.elements.transactionModalExplorerLink.classList.add('d-none');
        }
         // Показываем модалку через Bootstrap JS
        if (transactionStatusModalInstance) {
            transactionStatusModalInstance.show();
        }
     },

     hideTransactionStatusModal() {
          // Скрываем модалку через Bootstrap JS
         if (transactionStatusModalInstance) {
             transactionStatusModalInstance.hide();
         }
     }

};

// Экспорт ui объекта (делаем его глобальным для простоты Vanilla JS)
window.ui = ui;