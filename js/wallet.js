// js/wallet.js

let provider = null;
let signer = null;
let currentAccount = null;
let currentChainId = null; // ID сети, к которой ФАКТИЧЕСКИ подключен кошелек
let currentNetworkName = null; // Имя сети, к которой ФАКТИЧЕСКИ подключен кошелек

let supportedNetworks = []; // Загружается с бэкенда

async function loadSupportedNetworks() {
    // Проверяем, не является ли supportedNetworks уже загруженным и валидным списком
    if (supportedNetworks.length > 0 && typeof supportedNetworks[0]?.chainId === 'number' &&
        supportedNetworks[0].name !== 'Ethereum (Fallback)' &&
        supportedNetworks[0].name !== 'Ethereum (Error Fallback)') {
        // console.log("wallet.js: Supported networks already loaded.");
        return;
    }
    console.log("wallet.js: Loading supported networks from backend...");
    try {
        const networksFromBackend = await utils.fetchData(`${utils.BACKEND_URL}/api/networks`);
        console.log("wallet.js: Data received from /api/networks:", JSON.stringify(networksFromBackend, null, 2));

        if (networksFromBackend && Array.isArray(networksFromBackend) && networksFromBackend.length > 0) {
            supportedNetworks = networksFromBackend.map(n => {
                if (!n.explorerUrl) {
                    console.warn(`wallet.js: Network ${n.name} (ID: ${n.chainId}) from backend is missing explorerUrl. Using default.`);
                }
                return {
                    chainId: parseInt(n.chainId, 10),
                    name: n.name,
                    explorerUrl: n.explorerUrl || `https://etherscan.io/tx/` // Фолбэк для explorerUrl
                    // Добавь другие поля, если они приходят и нужны: short_name, currency_symbol и т.д.
                };
            }).filter(n => !isNaN(n.chainId)); // Убираем сети с невалидным chainId

            if (supportedNetworks.length === 0 && networksFromBackend.length > 0) {
                 console.error("wallet.js: All networks from backend were filtered out or invalid.");
                 supportedNetworks = [{ chainId: 1, name: 'Ethereum (Processing Error Fallback)', explorerUrl: 'https://etherscan.io/tx/' }];
            } else {
                console.log("wallet.js: Supported networks successfully processed:", supportedNetworks);
            }
        } else {
            console.error("wallet.js: Failed to load supported networks (empty or invalid response). Using minimal fallback.");
            supportedNetworks = [{ chainId: 1, name: 'Ethereum (Load Error Fallback)', explorerUrl: 'https://etherscan.io/tx/' }];
        }
    } catch (error) {
        console.error("wallet.js: Exception while loading supported networks:", error);
        supportedNetworks = [{ chainId: 1, name: 'Ethereum (Exception Fallback)', explorerUrl: 'https://etherscan.io/tx/' }];
    }
}

function getExplorerUrl(chainId) {
    if (chainId === null || chainId === undefined) {
        console.warn("wallet.js: getExplorerUrl called with null/undefined chainId. Returning default.");
        return "https://etherscan.io/tx/";
    }
    const numericChainId = parseInt(chainId, 10);
    if (isNaN(numericChainId)) {
        console.warn(`wallet.js: getExplorerUrl with invalid non-numeric chainId: ${chainId}. Returning default.`);
        return "https://etherscan.io/tx/";
    }
    if (!supportedNetworks || supportedNetworks.length === 0) {
        // console.warn(`wallet.js: getExplorerUrl - supportedNetworks empty. Default for chainId: ${numericChainId}.`);
        return "https://etherscan.io/tx/"; // Фолбэк, если сети еще не загружены
    }
    const network = supportedNetworks.find(n => n.chainId === numericChainId);
    if (network && network.explorerUrl) {
        return network.explorerUrl.endsWith('/') ? network.explorerUrl : network.explorerUrl + '/';
    }
    // console.warn(`wallet.js: getExplorerUrl - No specific explorerUrl for chainId: ${numericChainId}. Default Etherscan.`);
    return "https://etherscan.io/tx/";
}

async function updateCurrentBalances() {
    // console.log("wallet.js: Attempting to update balances for the active tab...");
    const activeTabElement = document.querySelector('.tab-pane.active');
    if (!activeTabElement) { /* console.log("wallet.js: No active tab to update balances."); */ return; }

    const tabId = activeTabElement.id.replace('-tab', '');
    const account = getAccount();
    const currentWalletChain = wallet.getChainId(); // Используем getChainId() для получения актуального значения

    if (!account || currentWalletChain === null) { // Проверяем и currentWalletChain
        // console.log("wallet.js: Cannot update balances: Wallet not connected or chainId not determined.");
        if (window.swap?.updateCurrentBalances) await window.swap.updateCurrentBalances();
        if (window.bridge?.updateCurrentBalances) await window.bridge.updateCurrentBalances();
        return;
    }

    // console.log(`wallet.js: Updating balances for tab: '${tabId}', account: ${account}, walletChainId: ${currentWalletChain}`);
    if (tabId === 'swap' && window.swap?.updateCurrentBalances) {
        await window.swap.updateCurrentBalances();
    } else if (tabId === 'bridge' && window.bridge?.updateCurrentBalances) {
        await window.bridge.updateCurrentBalances();
    }
}

async function connectWallet() {
    // Гарантируем загрузку сетей перед попыткой подключения
    if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number' || supportedNetworks[0].name.includes('Fallback')) {
        console.log("wallet.js: connectWallet - pre-loading supportedNetworks...");
        await loadSupportedNetworks();
        if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number' || supportedNetworks[0].name.includes('Fallback')) {
            alert("Ошибка загрузки конфигурации сетей. Функциональность ограничена. Обновите страницу.");
            // Не прерываем, но пользователь предупрежден
        }
    }

    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length === 0) {
                 console.log("wallet.js: User denied account access.");
                 if(ui.updateWalletStatus) ui.updateWalletStatus(null);
                 return;
            }
            currentAccount = accounts[0];
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            const network = await provider.getNetwork();
            const connectedChainId = network.chainId; // ID сети, к которой ФАКТИЧЕСКИ подключен кошелек

            const networkConfig = supportedNetworks.find(n => n.chainId === connectedChainId);
            if (networkConfig) {
                currentChainId = networkConfig.chainId;
                currentNetworkName = networkConfig.name;
                if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
                if(ui.updateUIState) ui.updateUIState(true); // Сеть поддерживается
            } else {
                currentChainId = connectedChainId; // Сохраняем фактический ID
                currentNetworkName = network.name || "Неизвестная сеть";
                const message = `Сеть "${currentNetworkName}" (ID: ${currentChainId}) не поддерживается этим приложением.`;
                alert(message); // Предупреждаем пользователя
                if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId); // Показываем инфо о неподдерживаемой сети
                if(ui.updateUIState) ui.updateUIState(false); // Блокируем основной UI
            }
            console.log(`wallet.js: Wallet connected: ${currentAccount}, Network: ${currentNetworkName} (ID: ${currentChainId})`);

            // Обновляем состояние активной вкладки, если она есть
            // Это важно, т.к. app.js еще может не вызвал 'shown.bs.tab' для начальной вкладки
            const activeTabElement = document.querySelector('.tab-pane.active');
            if (activeTabElement) {
                const tabId = activeTabElement.id.replace('-tab', '');
                 if (tabId === 'swap' && window.swap?.resetState) await window.swap.resetState();
                 else if (tabId === 'bridge' && window.bridge?.resetState) await window.bridge.resetState();
                 else if (tabId === 'telegram' && window.telegram?.resetState) await window.telegram.resetState();
            } else { // Если активной вкладки нет (например, при самой первой загрузке до активации)
                // Можно принудительно вызвать resetState для 'swap' (дефолтной вкладки)
                if(window.swap?.resetState) await window.swap.resetState();
            }

            if(window.telegram?.checkTelegramStatus) await window.telegram.checkTelegramStatus();

        } catch (error) {
            console.error("wallet.js: Error connecting wallet:", error);
            let errorMessage = "Неизвестная ошибка подключения кошелька.";
            if (error.code === 4001) errorMessage = "Подключение отклонено пользователем.";
            else if (error.message) errorMessage = `Ошибка: ${error.message}`;
            alert(errorMessage);
            // Полный сброс состояния при ошибке подключения
            currentAccount = null; currentChainId = null; currentNetworkName = null; provider = null; signer = null;
            if(ui.updateWalletStatus) ui.updateWalletStatus(null);
            if(ui.updateUIState) ui.updateUIState(false);
            if(window.swap?.resetState) await window.swap.resetState();
            if(window.bridge?.resetState) await window.bridge.resetState();
            if(window.telegram?.resetState) await window.telegram.resetState();
        }
    } else {
        alert('MetaMask или другой Web3 провайдер не обнаружен. Пожалуйста, установите его.');
        if(ui.updateWalletStatus) ui.updateWalletStatus(null);
        if(ui.updateUIState) ui.updateUIState(false);
    }
}

function disconnectWallet() {
    console.log("wallet.js: Disconnecting wallet (frontend state reset).");
    currentAccount = null; currentChainId = null; currentNetworkName = null; provider = null; signer = null;
    if(ui.updateWalletStatus) ui.updateWalletStatus(null);
    if(ui.updateUIState) ui.updateUIState(false);
    if(window.swap?.resetState) window.swap.resetState(); // Используем await, если они async
    if(window.bridge?.resetState) window.bridge.resetState();
    if(window.telegram?.resetState) window.telegram.resetState();
}

async function switchChain(targetChainId) {
    if (typeof window.ethereum === 'undefined' || targetChainId === null || targetChainId === undefined) {
        console.error("wallet.js: MetaMask not installed or invalid targetChainId for switchChain:", targetChainId);
        return false;
    }
    const numericTargetChainId = parseInt(targetChainId, 10); // Убедимся, что это число
    if (isNaN(numericTargetChainId)) {
        console.error("wallet.js: Invalid non-numeric targetChainId for switchChain:", targetChainId);
        return false;
    }

    // Гарантируем, что supportedNetworks загружен
    if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number' || supportedNetworks[0].name.includes('Fallback')) {
        await loadSupportedNetworks();
    }
    const networkToSwitch = supportedNetworks.find(n => n.chainId === numericTargetChainId);
    if (!networkToSwitch) {
        alert(`Попытка переключиться на неподдерживаемую приложением сеть (ID: ${numericTargetChainId}).`);
        return false;
    }

    const chainIdHex = '0x' + numericTargetChainId.toString(16);
    const currentActiveWalletChain = wallet.getChainId(); // Получаем текущую сеть кошелька

    // Если кошелек уже на нужной сети, ничего не делаем
    if (currentActiveWalletChain === numericTargetChainId) {
        console.log(`wallet.js: Wallet is already on the target network ${networkToSwitch.name} (ID: ${numericTargetChainId}). No switch needed.`);
        return true; // Считаем успешным, так как уже на нужной сети
    }

    try {
        const statusMsgLocation = document.querySelector('.tab-pane.active .lead, .tab-pane.active p:last-child'); // Попытка найти место для статуса
        if(statusMsgLocation) statusMsgLocation.textContent = `Запрос на переключение сети на ${networkToSwitch.name}...`;
        else console.log(`wallet.js: Requesting wallet switch to ${networkToSwitch.name}...`);

        console.log(`wallet.js: Requesting wallet to switch to chain ID: ${numericTargetChainId} (Hex: ${chainIdHex})`);
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
        });
        console.log(`wallet.js: Switch chain request sent for chain ID: ${numericTargetChainId}. Waiting for 'chainChanged' event.`);
        // Не обновляем currentChainId здесь. Ждем события 'chainChanged'.
        return true;
    } catch (switchError) {
        console.error(`wallet.js: Failed to switch to chain ID ${numericTargetChainId}:`, switchError);
        if (switchError.code === 4902) {
            alert(`Сеть ${networkToSwitch.name} (ID: ${numericTargetChainId}) не добавлена в ваш кошелек. Пожалуйста, добавьте ее вручную.`);
        } else if (switchError.code === 4001) {
            alert("Запрос на переключение сети был отклонен пользователем.");
        } else {
            alert(`Произошла ошибка при попытке переключения сети: ${switchError.message}`);
        }
        return false;
    }
}

// --- Обработчики событий от Web3 провайдера (MetaMask) ---
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', async (accounts) => {
        console.log("WALLET.JS: 'accountsChanged' event! Accounts:", accounts);
        if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number' || supportedNetworks[0].name.includes('Fallback')) await loadSupportedNetworks();

        if (accounts.length === 0) {
            console.log("WALLET.JS: All accounts disconnected.");
            disconnectWallet();
        } else {
            currentAccount = accounts[0];
            console.log("WALLET.JS: Account changed to:", currentAccount);
            if (window.ethereum) { // Провайдер должен быть, если событие сработало
                 provider = new ethers.providers.Web3Provider(window.ethereum);
                 signer = provider.getSigner();
            }
            // currentChainId и currentNetworkName не меняются при смене аккаунта, используем существующие
            const isNetSupported = !!supportedNetworks.find(n => n.chainId === currentChainId);
            if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
            if(ui.updateUIState) ui.updateUIState(!!currentAccount && isNetSupported); // Обновляем UI с учетом поддержки сети

            // Обновляем состояние активной вкладки
            const activeTabElement = document.querySelector('.tab-pane.active');
            if (activeTabElement) {
                const tabId = activeTabElement.id.replace('-tab', '');
                if (tabId === 'swap' && window.swap?.resetState) await window.swap.resetState();
                else if (tabId === 'bridge' && window.bridge?.resetState) await window.bridge.resetState();
                else if (tabId === 'telegram' && window.telegram?.resetState) {
                    await window.telegram.resetState();
                    if (window.telegram.checkTelegramStatus) await window.telegram.checkTelegramStatus();
                }
            }
             if(window.telegram?.checkTelegramStatus && (!activeTabElement || activeTabElement.id.replace('-tab','') !=='telegram')) {
                await window.telegram.checkTelegramStatus(); // Проверить статус телеграма в любом случае
             }
        }
    });

    window.ethereum.on('chainChanged', async (chainIdHex) => {
        console.log("WALLET.JS: 'chainChanged' event! Hex:", chainIdHex);
        const newConnectedChainId = parseInt(chainIdHex, 16);

        if (supportedNetworks.length === 0 || typeof supportedNetworks[0]?.chainId !== 'number' || supportedNetworks[0].name.includes('Fallback')) {
            await loadSupportedNetworks();
        }
        if (window.ethereum) {
             provider = new ethers.providers.Web3Provider(window.ethereum);
             if(currentAccount) signer = provider.getSigner();
        } else { return; /* Не должно произойти */ }

        const oldChainIdForLog = currentChainId;
        const networkConfig = supportedNetworks.find(n => n.chainId === newConnectedChainId);

        if (networkConfig) {
            currentChainId = networkConfig.chainId;
            currentNetworkName = networkConfig.name;
        } else {
            let tempNetName = "Неизвестная сеть";
            try { const tempNetInfo = await provider.getNetwork(); tempNetName = tempNetInfo.name || tempNetName; } catch (e) { /*...*/ }
            currentChainId = newConnectedChainId;
            currentNetworkName = tempNetName;
        }
        console.log(`WALLET.JS: Chain ID in state updated from ${oldChainIdForLog} to ${currentChainId} (${currentNetworkName})`);

        if(ui.updateWalletStatus) ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
        if(ui.updateUIState) ui.updateUIState(!!currentAccount && !!networkConfig); // UI активен, если кошелек подключен и сеть ПОДДЕРЖИВАЕТСЯ

        // Обновить состояние АКТИВНОЙ вкладки
        const activeTabElement = document.querySelector('.tab-pane.active');
        if (activeTabElement) {
            const tabId = activeTabElement.id.replace('-tab', '');
            console.log(`WALLET.JS: 'chainChanged' - Updating active tab '${tabId}' state.`);
            if (tabId === 'swap' && window.swap?.resetState) await window.swap.resetState();
            else if (tabId === 'bridge' && window.bridge?.resetState) await window.bridge.resetState();
            else if (tabId === 'telegram' && window.telegram?.resetState) {
                await window.telegram.resetState();
                if (window.telegram.checkTelegramStatus) await window.telegram.checkTelegramStatus();
                 // Запускаем поллинг только если кошелек подключен и сеть поддерживается
                 if (currentAccount && networkConfig && window.telegram.startPolling) {
                      window.telegram.startPolling();
                 }
            }
        }
        console.log("WALLET.JS: 'chainChanged' event processing finished.");
    });

    window.ethereum.on('disconnect', (error) => { // disconnect более надежен, чем message { type: 'disconnect' }
        console.error("WALLET.JS: MetaMask disconnected (event 'disconnect'). Error:", error);
        disconnectWallet();
    });

} else {
    console.warn("wallet.js: MetaMask (window.ethereum) not detected during initial setup.");
    // Можно вызвать disconnectWallet или установить начальное состояние UI для "нет провайдера"
    // disconnectWallet(); // Это сбросит UI и переменные
}

window.wallet = {
    connectWallet,
    disconnectWallet,
    loadSupportedNetworks,
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