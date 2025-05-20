// js/wallet.js

let provider = null;
let signer = null;
let currentAccount = null;
let currentChainId = null; // Хранит ID текущей сети, к которой ПОДКЛЮЧЕН кошелек
let currentNetworkName = null; // Имя этой сети
let supportedNetworks = []; // Загружается с бэкенда

/**
 * Загружает список поддерживаемых сетей с бэкенда.
 * Если сети уже загружены, ничего не делает.
 */
async function loadSupportedNetworks() {
    // Проверяем, есть ли уже валидные данные (не просто пустой массив)
    if (supportedNetworks.length > 0 && typeof supportedNetworks[0]?.chainId === 'number') {
        return;
    }
    console.log("wallet.js: Loading supported networks from backend...");
    try {
        const networksFromBackend = await utils.fetchData(`${utils.BACKEND_URL}/api/networks`);
        if (networksFromBackend && Array.isArray(networksFromBackend) && networksFromBackend.length > 0) {
            // Убедимся, что chainId это числа
            supportedNetworks = networksFromBackend.map(n => ({
                ...n,
                chainId: parseInt(n.chainId, 10)
            }));
            console.log("wallet.js: Supported networks loaded:", supportedNetworks);
        } else {
            console.error("wallet.js: Failed to load supported networks or list is empty. Using a minimal fallback.");
            // Минимальный фоллбэк, чтобы приложение не падало полностью
            supportedNetworks = [{ chainId: 1, name: 'Ethereum (Fallback)', explorerUrl: 'https://etherscan.io/tx/' }];
        }
    } catch (error) {
        console.error("wallet.js: Error loading supported networks from backend:", error);
        supportedNetworks = [{ chainId: 1, name: 'Ethereum (Error Fallback)', explorerUrl: 'https://etherscan.io/tx/' }];
    }
}

/**
 * Возвращает URL эксплорера для указанного chainId.
 */
function getExplorerUrl(chainId) {
    if (supportedNetworks.length === 0) { // На случай, если сети не загрузились
        console.warn("wallet.js: getExplorerUrl called before supportedNetworks loaded. Using default.");
        return `https://etherscan.io/tx/`; // Общий дефолт
    }
    const numericChainId = parseInt(chainId, 10);
    const network = supportedNetworks.find(n => n.chainId === numericChainId);
    return network ? network.explorerUrl : `https://etherscan.io/tx/`; // Дефолт, если сеть не найдена в списке
}

/**
 * Обновляет отображение балансов для текущей активной вкладки.
 * Вызывается при смене аккаунта, сети или после транзакций.
 */
async function updateCurrentBalances() {
    console.log("wallet.js: Attempting to update balances for the active tab...");
    const activeTabElement = document.querySelector('.tab-pane.active');
    if (!activeTabElement) {
        console.log("wallet.js: No active tab found to update balances.");
        return;
    }
    const tabId = activeTabElement.id.replace('-tab', '');
    const account = wallet.getAccount(); // Используем геттер
    const walletChainId = wallet.getChainId(); // Используем геттер

    if (!account || walletChainId === null) {
        console.log("wallet.js: Cannot update balances - wallet not fully connected or chainId missing.");
        // Если кошелек отключается, модули должны сбросить свои балансы
        if (window.swap?.updateCurrentBalances) window.swap.updateCurrentBalances();
        if (window.bridge?.updateCurrentBalances) window.bridge.updateCurrentBalances();
        return;
    }

    console.log(`wallet.js: Updating balances for tab: '${tabId}', account: ${utils.formatAddress(account)}, walletChainId: ${walletChainId}`);
    if (tabId === 'swap' && window.swap?.updateCurrentBalances) {
        await window.swap.updateCurrentBalances();
    } else if (tabId === 'bridge' && window.bridge?.updateCurrentBalances) {
        await window.bridge.updateCurrentBalances();
    }
}

/**
 * Центральная функция для обработки изменения состояния сети кошелька.
 * Вызывается из connectWallet и обработчика события 'chainChanged'.
 * Обновляет глобальное состояние сети, UI шапки и инициирует обновление активной вкладки.
 * @param {number} newChainIdFromProvider - ID сети, полученный от провайдера кошелька.
 * @param {string | null} networkNameFromProvider - Имя сети от провайдера.
 * @returns {Promise<{chainIdChanged: boolean, newChainId: number | null}>} - Результат обработки.
 */
async function processWalletNetworkState(newChainIdFromProvider, networkNameFromProvider = null) {
    console.log(`wallet.js: processWalletNetworkState called with newChainIdFromProvider=${newChainIdFromProvider}`);

    if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number') {
        await loadSupportedNetworks(); // Гарантируем загрузку сетей
        if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number') {
            console.error("wallet.js: CRITICAL - Supported networks could not be loaded in processWalletNetworkState.");
            currentChainId = parseInt(newChainIdFromProvider, 10); // Устанавливаем как есть
            currentNetworkName = networkNameFromProvider || "Неизвестная сеть (ошибка загрузки конфига)";
            if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
            if(ui.updateUIState) ui.updateUIState(false); // Блокируем, так как не можем проверить поддержку
            alert(`Критическая ошибка: не удалось загрузить конфигурацию сетей. Функционал будет ограничен. Текущая сеть: ${currentNetworkName} (ID: ${currentChainId})`);
            return { chainIdChanged: currentChainId !== null, newChainId: currentChainId };
        }
    }

    const numericNewChainId = parseInt(newChainIdFromProvider, 10);
    const networkConfig = supportedNetworks.find(n => n.chainId === numericNewChainId);
    const oldChainId = currentChainId; // Сохраняем предыдущее значение

    if (networkConfig) {
        currentChainId = networkConfig.chainId;
        currentNetworkName = networkConfig.name;
        console.log(`wallet.js: Wallet network set to SUPPORTED: ${currentNetworkName} (ID: ${currentChainId})`);
        if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
        if(ui.updateUIState) ui.updateUIState(!!currentAccount); // Разблокируем, если аккаунт есть
    } else {
        currentChainId = numericNewChainId;
        currentNetworkName = networkNameFromProvider || `Неподдерживаемая сеть (ID: ${currentChainId})`;
        const message = `Сеть "${currentNetworkName}" не поддерживается этим приложением. Некоторые функции могут быть недоступны.`;
        alert(message);
        if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
        if(ui.updateUIState) ui.updateUIState(false); // Блокируем UI, если сеть не поддерживается
        console.warn(message);
    }

    const chainIdActuallyChanged = oldChainId !== currentChainId;
    console.log(`wallet.js: Chain ID actually changed: ${chainIdActuallyChanged} (Old: ${oldChainId}, New: ${currentChainId})`);

    // Если chainId изменился ИЛИ это первая установка (oldChainId был null и currentChainId теперь установлен)
    if (chainIdActuallyChanged || (oldChainId === null && currentChainId !== null)) {
        console.log(`wallet.js: Triggering full UI refresh for tabs due to network change or initial setup.`);
        // Сбросить состояние ВСЕХ вкладок, чтобы они адаптировались к новой сети
        if(window.swap?.resetState) await window.swap.resetState();
        if(window.bridge?.resetState) await window.bridge.resetState();
        if(window.telegram?.resetState) await window.telegram.resetState();

        // И затем принудительно обновить АКТИВНУЮ вкладку
        await refreshActiveTabData(currentChainId); // Передаем новый ID для синхронизации
    } else if (currentAccount && currentChainId !== null) { // Если chainId не менялся, но нужно обновить (например, после смены аккаунта)
        console.log(`wallet.js: Chain ID did not change, but refreshing active tab and balances.`);
        await refreshActiveTabData(currentChainId); // Обновить активную вкладку
    }

    return { chainIdChanged: chainIdActuallyChanged, newChainId: currentChainId };
}

/**
 * Принудительно обновляет UI и данные для текущей активной вкладки.
 * @param {number | null} forceNetworkId - Если передан, вкладка должна инициализироваться для этой сети.
 */
async function refreshActiveTabData(forceNetworkId = null) {
    const activeTabElement = document.querySelector('.tab-pane.active');
    if (!activeTabElement) {
        console.log("wallet.js: No active tab to refresh.");
        return;
    }
    const tabId = activeTabElement.id.replace('-tab', '');
    const account = wallet.getAccount();
    // Используем forceNetworkId если он есть, иначе текущую сеть кошелька
    const effectiveChainId = forceNetworkId !== null ? forceNetworkId : currentChainId;

    console.log(`wallet.js: Refreshing active tab '${tabId}' for effectiveChainId: ${effectiveChainId}`);

    if (!account || effectiveChainId === null) {
        console.log(`wallet.js: Cannot refresh tab '${tabId}', no account or effectiveChainId.`);
        // Можно дополнительно сбросить UI вкладки, если она была активна, но стала невалидной
        if (tabId === 'swap' && window.swap?.resetState) await window.swap.resetState();
        if (tabId === 'bridge' && window.bridge?.resetState) await window.bridge.resetState();
        return;
    }

    const isNetworkSupportedByApp = !!supportedNetworks.find(net => net.chainId === effectiveChainId);

    if (isNetworkSupportedByApp) {
        if (tabId === 'swap' && window.swap?.initializeSwapNetworkSelector) {
            await window.swap.initializeSwapNetworkSelector(); // Эта функция должна учесть effectiveChainId
        } else if (tabId === 'bridge' && window.bridge) {
            if(window.bridge.populateNetworkSelects) window.bridge.populateNetworkSelects(); // Обновит селекторы, один из них должен стать effectiveChainId
            if(window.bridge.updateCurrentBalances) await window.bridge.updateCurrentBalances();
            // Обновление статуса моста
            const fromChainB = window.bridge?.selectedFromChainId?.();
            const toChainB = window.bridge?.selectedToChainId?.();
            const fromTokenB = window.bridge?.selectedFromTokenBridge?.();
            const toTokenB = window.bridge?.selectedToTokenBridge?.();
            if(ui.updateBridgeStatus) ui.updateBridgeStatus(fromChainB && toChainB && fromTokenB && toTokenB ? "Найти лучший путь" : "Выберите сети и токены");
        } else if (tabId === 'telegram' && window.telegram?.checkTelegramStatus) {
            await window.telegram.checkTelegramStatus();
            if(window.telegram.startPolling) window.telegram.startPolling();
        }
    } else {
        const networkName = wallet.getNetworkName() || `ID ${effectiveChainId}`; // Используем геттер для имени
        if (tabId === 'swap') {
            if(window.swap?.initializeSwapNetworkSelector) await window.swap.initializeSwapNetworkSelector();
            if(ui.updateSwapStatus) ui.updateSwapStatus(`Кошелек на неподдерживаемой сети "${networkName}".`);
        }
        if (tabId === 'bridge') {
            if(window.bridge?.populateNetworkSelects) window.bridge.populateNetworkSelects();
            if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Кошелек на неподдерживаемой сети "${networkName}".`);
        }
        // и т.д.
    }
    // Общее обновление балансов в конце, так как состояние могло измениться
    await updateCurrentBalances();
}


async function connectWallet() {
    // Гарантируем загрузку сетей перед попыткой подключения
    if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number') {
        await loadSupportedNetworks();
        if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number') {
            alert("Не удалось загрузить конфигурацию сетей. Пожалуйста, обновите страницу или попробуйте позже.");
            return;
        }
    }

    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length === 0) {
                 console.log("User denied account access.");
                 if(ui.updateWalletStatus) ui.updateWalletStatus(null); // Обновляем UI
                 return;
            }
            currentAccount = accounts[0];
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            const network = await provider.getNetwork();

            // Обрабатываем состояние сети и обновляем UI
            const { newChainId } = await processWalletNetworkState(network.chainId, network.name);

            // После установки состояния сети, принудительно обновляем активную вкладку
            // (processWalletNetworkState уже вызывает refreshActiveTabData, если сеть изменилась)
            // но если это первое подключение, а сеть не изменилась (была null), то нужно вызвать
            if (newChainId !== null) {
                 // await refreshActiveTabData(newChainId); // Это уже должно быть вызвано внутри processWalletNetworkState
            }

            console.log("Wallet connected by user:", utils.formatAddress(currentAccount), "Chain ID:", currentChainId, "Network:", currentNetworkName);
        } catch (error) {
            console.error("Error connecting wallet:", error);
            let errorMessage = "Неизвестная ошибка подключения кошелька.";
            if (error.code === 4001) errorMessage = "Подключение отклонено пользователем.";
            else if (error.message) errorMessage = `Ошибка: ${error.message}`;
            alert(errorMessage);
            disconnectWallet(); // Полный сброс состояния при ошибке
        }
    } else {
        alert('MetaMask или другой Web3 провайдер не обнаружен. Пожалуйста, установите его.');
        if(ui.updateWalletStatus) ui.updateWalletStatus(null);
        if(ui.updateUIState) ui.updateUIState(false);
        // При отсутствии MetaMask, сбрасываем состояние модулей
        if(window.swap?.resetState) window.swap.resetState();
        if(window.bridge?.resetState) window.bridge.resetState();
        if(window.telegram?.resetState) window.telegram.resetState();
    }
}

function disconnectWallet() {
    currentAccount = null;
    currentChainId = null;
    currentNetworkName = null;
    provider = null;
    signer = null;
    console.log("wallet.js: Wallet disconnected by user or error.");
    if(ui.updateWalletStatus) ui.updateWalletStatus(null);
    if(ui.updateUIState) ui.updateUIState(false); // Блокируем формы
    // Сброс состояния всех модулей
    if(window.swap?.resetState) window.swap.resetState();
    if(window.bridge?.resetState) window.bridge.resetState();
    if(window.telegram?.resetState) window.telegram.resetState();
}

async function switchChain(targetChainId) {
    if (typeof window.ethereum === 'undefined' || targetChainId === null || targetChainId === undefined) {
        console.error("wallet.js: MetaMask not installed or invalid targetChainId for switchChain:", targetChainId);
        return false;
    }
    const numericTargetChainId = parseInt(targetChainId, 10);
    if (isNaN(numericTargetChainId)) {
        console.error("wallet.js: Invalid non-numeric targetChainId for switchChain:", targetChainId);
        return false;
    }

    if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number') await loadSupportedNetworks();
    const networkToSwitch = supportedNetworks.find(n => n.chainId === numericTargetChainId);

    if (!networkToSwitch) {
        alert(`Попытка переключиться на неподдерживаемую приложением сеть (ID: ${numericTargetChainId}). Пожалуйста, выберите сеть из списка.`);
        return false;
    }

    const chainIdHex = '0x' + numericTargetChainId.toString(16);

    try {
        if (ui.updateSwapStatus) ui.updateSwapStatus(`Запрос на переключение сети на ${networkToSwitch.name}...`); // Информируем пользователя
        else if (ui.updateBridgeStatus) ui.updateBridgeStatus(`Запрос на переключение сети на ${networkToSwitch.name}...`);

        console.log(`wallet.js: Requesting wallet to switch to chain ID: ${numericTargetChainId} (Hex: ${chainIdHex})`);
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
        });
        console.log(`wallet.js: Switch chain request sent for chain ID: ${numericTargetChainId}. Waiting for 'chainChanged' event.`);
        // НЕ обновляем currentChainId здесь. Ждем события 'chainChanged'.
        return true; // Запрос успешно отправлен
    } catch (switchError) {
        console.error(`wallet.js: Failed to switch to chain ID ${numericTargetChainId}:`, switchError);
        let alertMsg = `Ошибка при переключении сети: ${switchError.message || JSON.stringify(switchError)}`;
        if (switchError.code === 4001) {
            alertMsg = "Запрос на переключение сети был отклонен пользователем.";
        } else if (switchError.code === 4902) {
            alertMsg = `Сеть ${networkToSwitch.name} (ID: ${numericTargetChainId}) не добавлена в ваш кошелек. Пожалуйста, добавьте ее вручную.`;
        }
        alert(alertMsg);
        // Восстанавливаем UI статус активной вкладки, так как переключение не удалось
        await refreshActiveTabData(currentChainId); // Обновить на основе текущей (неизменившейся) сети кошелька
        return false;
    }
}

// --- Обработчики событий от Web3 провайдера (MetaMask) ---
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', async (accounts) => {
        console.log("wallet.js: MetaMask event: accountsChanged received", accounts);
        if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number') await loadSupportedNetworks();

        const oldAccount = currentAccount;
        if (accounts.length === 0) {
            console.log("wallet.js: MetaMask accounts disconnected by user (accounts array empty).");
            disconnectWallet();
        } else {
            currentAccount = accounts[0];
            if (oldAccount !== currentAccount || oldAccount === null) { // Обновляем, если аккаунт изменился или это первая установка
                console.log("wallet.js: MetaMask account actually changed to:", utils.formatAddress(currentAccount));
                if (!provider) provider = new ethers.providers.Web3Provider(window.ethereum); // Инициализируем, если еще нет
                signer = provider.getSigner(currentAccount); // Всегда обновляем signer

                if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
                const isNetSupported = !!supportedNetworks.find(n => n.chainId === currentChainId);
                if(ui.updateUIState) ui.updateUIState(!!currentAccount && isNetSupported);

                if (currentChainId !== null) {
                    // Сеть не менялась, но аккаунт сменился. Обновляем вкладки.
                    // processWalletNetworkState поймет, что chainId не изменился, но вызовет refreshActiveTabData
                    await processWalletNetworkState(currentChainId, currentNetworkName);
                } else if (provider) { // Если это первое событие accountsChanged и сеть еще не была установлена
                    const network = await provider.getNetwork();
                    await processWalletNetworkState(network.chainId, network.name);
                }
                if(window.telegram?.checkTelegramStatus) await window.telegram.checkTelegramStatus();
            } else {
                console.log("wallet.js: MetaMask accountsChanged event, but account is the same.");
            }
        }
    });

    window.ethereum.on('chainChanged', async (chainIdHex) => {
        console.log("wallet.js: MetaMask event: chainChanged to network", chainIdHex);
        const newConnectedChainId = parseInt(chainIdHex, 16);

        let networkNameFromProvider = "Неизвестная сеть";
        try {
            // Не создаем новый провайдер, если он уже есть, используем существующий
            const currentProvider = provider || new ethers.providers.Web3Provider(window.ethereum);
            const networkInfo = await currentProvider.getNetwork();
            networkNameFromProvider = networkInfo.name;
            if (!provider) provider = currentProvider; // Сохраняем, если не было
        } catch (e) { console.error("wallet.js: Could not get network name in chainChanged:", e); }

        // processWalletNetworkState обработает обновление currentChainId, currentNetworkName, UI шапки,
        // сброс всех вкладок и принудительное обновление активной вкладки.
        await processWalletNetworkState(newConnectedChainId, networkNameFromProvider);
    });

    window.ethereum.on('disconnect', (error) => { // provider_request RPC Error: Method not found.
        console.error("wallet.js: MetaMask event: disconnected (error code " + error?.code + ")", error);
        // Событие 'disconnect' не всегда надежно и может иметь разные коды.
        // accountsChanged с пустым массивом более надежный индикатор.
        // Но на всякий случай, сбрасываем состояние.
        disconnectWallet();
    });
} else {
    // Это предупреждение может появляться при первой загрузке, до полной инициализации MetaMask.
    // Если MetaMask установлен, он должен исчезнуть после инициализации кошелька.
    // console.warn("wallet.js: MetaMask not detected when setting up global event listeners.");
}

// --- Экспорт ---
window.wallet = {
    connectWallet,
    disconnectWallet,
    loadSupportedNetworks, // Важно, чтобы app.js мог вызвать это при старте
    getAccount: () => currentAccount,
    getProvider: () => provider,
    getSigner: () => signer,
    getChainId: () => currentChainId,
    getNetworkName: () => currentNetworkName,
    getSupportedNetworks: () => supportedNetworks,
    getExplorerUrl,
    switchChain,
    updateCurrentBalances,
};