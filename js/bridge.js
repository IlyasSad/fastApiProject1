// js/bridge.js

let selectedFromChainId = null;
let selectedToChainId = null;
let selectedFromTokenBridge = null;
let selectedToTokenBridge = null;
let currentBridgeQuote = null;

function populateNetworkSelects() {
    console.log("bridge.js: populateNetworkSelects called.");
    const allSupportedNetworks = wallet.getSupportedNetworks();
    if (!allSupportedNetworks || allSupportedNetworks.length === 0) {
        console.warn("bridge.js: No supported networks available to populate selects.");
        if(ui.elements.bridgeFromNetworkSelect) ui.elements.bridgeFromNetworkSelect.innerHTML = '<option value="">Сети не загружены</option>';
        if(ui.elements.bridgeToNetworkSelect) ui.elements.bridgeToNetworkSelect.innerHTML = '<option value="">Сети не загружены</option>';
        // Сбрасываем выбранные ID, если сетей нет
        selectedFromChainId = null;
        selectedToChainId = null;
        resetBridgeTokensAndQuote('both');
        updateBridgeUIStatus(); // Обновить статус (покажет "Сети не загружены")
        return;
    }

    const currentWalletChainId = wallet.getChainId();
    const previouslySelectedFrom = selectedFromChainId;
    const previouslySelectedTo = selectedToChainId;

    let defaultFromChainId = null;
    if (previouslySelectedFrom && allSupportedNetworks.some(n => n.chainId === previouslySelectedFrom)) {
        defaultFromChainId = previouslySelectedFrom;
    } else if (currentWalletChainId && allSupportedNetworks.some(net => net.chainId === currentWalletChainId)) {
        defaultFromChainId = currentWalletChainId;
    } else if (allSupportedNetworks.length > 0) {
        defaultFromChainId = allSupportedNetworks[0].chainId;
    }

    let defaultToChainId = null;
    if (previouslySelectedTo && allSupportedNetworks.some(n => n.chainId === previouslySelectedTo) && previouslySelectedTo !== defaultFromChainId) {
        defaultToChainId = previouslySelectedTo;
    } else {
        const firstDifferentNetwork = allSupportedNetworks.find(net => net.chainId !== defaultFromChainId);
        defaultToChainId = firstDifferentNetwork?.chainId || (allSupportedNetworks.length > 1 ? allSupportedNetworks[1]?.chainId : null);
         if (defaultFromChainId && defaultToChainId === defaultFromChainId && allSupportedNetworks.length > 1) { // Если вдруг выбрались одинаковые
            defaultToChainId = allSupportedNetworks.find(n => n.chainId !== defaultFromChainId)?.chainId;
        }
    }
     if (defaultFromChainId && defaultToChainId === defaultFromChainId) { // Последняя проверка, чтобы не было одинаковых
        defaultToChainId = null;
    }


    if (ui.elements.bridgeFromNetworkSelect) {
        ui.populateNetworkSelect('bridge-from-network', allSupportedNetworks, defaultFromChainId);
        selectedFromChainId = ui.elements.bridgeFromNetworkSelect.value ? parseInt(ui.elements.bridgeFromNetworkSelect.value, 10) : null;
    }
    if (ui.elements.bridgeToNetworkSelect) {
        ui.populateNetworkSelect('bridge-to-network', allSupportedNetworks, defaultToChainId);
        selectedToChainId = ui.elements.bridgeToNetworkSelect.value ? parseInt(ui.elements.bridgeToNetworkSelect.value, 10) : null;
    }

    if(previouslySelectedFrom !== selectedFromChainId) resetBridgeTokensAndQuote('from');
    if(previouslySelectedTo !== selectedToChainId) resetBridgeTokensAndQuote('to');

    console.log(`bridge.js: Networks populated. From: ${selectedFromChainId}, To: ${selectedToChainId}`);
    updateBridgeUIStatus();
}

async function handleNetworkChange(type, selectElement) {
    const newChainId = selectElement.value ? parseInt(selectElement.value, 10) : null;
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId();
    let networkChangedInUI = false;

    if (type === 'from') {
        if (selectedFromChainId === newChainId) return;
        selectedFromChainId = newChainId;
        networkChangedInUI = true;
        resetBridgeTokensAndQuote('from'); // Сбрасываем FROM токен и котировку

        if (account && selectedFromChainId && currentWalletChainId !== null && selectedFromChainId !== currentWalletChainId) {
            const targetNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
            if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Переключение кошелька на "${targetNetInfo?.name || selectedFromChainId}"...`);
            const switched = await wallet.switchChain(selectedFromChainId);
            if (!switched && ui.updateBridgeStatus) {
                ui.updateBridgeStatus(`Не удалось переключить. Для моста из "${targetNetInfo?.name || selectedFromChainId}" переключите вручную.`);
            }
            // Дальнейшее обновление UI произойдет через 'chainChanged' -> resetState -> populateNetworkSelects -> updateBridgeUIStatus
            // или через updateBridgeUIStatus ниже, если переключения не было
        }
    } else { // type === 'to'
        if (selectedToChainId === newChainId) return;
        selectedToChainId = newChainId;
        networkChangedInUI = true;
        resetBridgeTokensAndQuote('to'); // Сбрасываем TO токен и котировку
    }

    if(networkChangedInUI) {
        console.log(`bridge.js: Network '${type}' in UI changed to: ${newChainId}. Current state: From=${selectedFromChainId}, To=${selectedToChainId}`);
        await updateBridgeUIStatus(); // Обновляем UI на основе нового выбора в селекторах и текущего состояния кошелька
    }
}

function resetBridgeTokensAndQuote(type = 'both') {
    if (type === 'from' || type === 'both') {
        selectedFromTokenBridge = null;
        if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
    }
    if (type === 'to' || type === 'both') {
        selectedToTokenBridge = null;
        if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';
    }
    currentBridgeQuote = null;
    if (type === 'both') {
        if(ui.elements.bridgeFromAmount) ui.elements.bridgeFromAmount.value = '';
        if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = '';
    }
    if(ui.updateBridgeDetails) ui.updateBridgeDetails(null, null, null, null, null);
    if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
    if(ui.elements.getBridgeQuoteBtn) ui.elements.getBridgeQuoteBtn.disabled = false;
}

async function updateBridgeUIStatus() {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId();

    if(!ui.updateBridgeStatus || !ui.updateTokenBalanceDisplay) { console.warn("bridge.js: UI update functions not ready."); return; }

    const isWalletConnected = !!account;
    const networkSelectsDisabled = !isWalletConnected;
    // Кнопки токенов зависят от выбора сетей И от соответствия ИСХОДНОЙ сети моста сети кошелька (для FROM токена)
    let fromTokenBtnDisabled = !isWalletConnected || !selectedFromChainId || (currentWalletChainId !== selectedFromChainId);
    let toTokenBtnDisabled = !isWalletConnected || !selectedToChainId;


    if(ui.elements.bridgeFromNetworkSelect) ui.elements.bridgeFromNetworkSelect.disabled = networkSelectsDisabled;
    if(ui.elements.bridgeToNetworkSelect) ui.elements.bridgeToNetworkSelect.disabled = networkSelectsDisabled;
    if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.disabled = fromTokenBtnDisabled;
    if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.disabled = toTokenBtnDisabled;


    if (!isWalletConnected) {
        ui.updateBridgeStatus("Подключите кошелек.");
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        return;
    }

    if (selectedFromChainId === null || selectedToChainId === null) {
        ui.updateBridgeStatus("Выберите исходную и целевую сети.");
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        return;
    }
    if (selectedFromChainId === selectedToChainId) {
        ui.updateBridgeStatus("Исходная и целевая сети не должны совпадать.");
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18); // Баланс нерелевантен
        return;
    }

    if (currentWalletChainId !== null && selectedFromChainId !== currentWalletChainId) {
        const selectedFromNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        const currentNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        ui.updateBridgeStatus(
            `Кошелек на сети "${currentNetInfo?.name || currentWalletChainId}". `+
            `Для моста из "${selectedFromNetInfo?.name || selectedFromChainId}" переключите кошелек или выберите другую исходную сеть.`
        );
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    } else { // Сеть кошелька совпадает с выбранной ИСХОДНОЙ сетью моста
        ui.updateBridgeStatus(selectedFromTokenBridge && selectedToTokenBridge ? "Найти лучший путь" : "Выберите токены и сумму");
        await updateCurrentBalancesBridge();
    }
}

async function handleTokenSelectClickBridge(type) {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId(); // Фактическая сеть кошелька
    const targetChainIdForTokenList = (type === 'from') ? selectedFromChainId : selectedToChainId;

    if (!account) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Подключите кошелек."); return; }
    if (selectedFromChainId === null || selectedToChainId === null) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Сначала выберите сети для моста."); return; }
    if (selectedFromChainId === selectedToChainId) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Выберите разные сети."); return; }
    if (targetChainIdForTokenList === null) { if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Сначала выберите ${type === 'from' ? 'исходную' : 'целевую'} сеть.`); return; }

    // Для выбора FROM токена, кошелек должен быть на selectedFromChainId
    if (type === 'from' && currentWalletChainId !== selectedFromChainId) {
        const fromNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Для выбора токена из сети "${fromNetInfo?.name || selectedFromChainId}" переключите кошелек.`);
        return;
    }
    if (!wallet.getSupportedNetworks().find(net => net.chainId === targetChainIdForTokenList)) {
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Сеть (ID ${targetChainIdForTokenList}) не поддерживается для выбора токенов.`); return;
    }

    if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Загрузка токенов для сети ID ${targetChainIdForTokenList}...`);
    try {
        const tokenList = await utils.getTokenList(targetChainIdForTokenList);
        if (!tokenList || tokenList.length === 0) {
             if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Нет токенов для сети ID ${targetChainIdForTokenList}.`);
             if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
             return;
        }
        if(ui.updateBridgeStatus) ui.updateBridgeStatus("");
        if(ui.showTokenPickerModal) ui.showTokenPickerModal(tokenList);

        if (ui.elements.tokenListUl) {
            ui.elements.tokenListUl.onclick = async (event) => {
                const targetLi = event.target.closest('li');
                if (targetLi) {
                    const token = { /* ... как было ... */
                        address: targetLi.dataset.address, symbol: targetLi.dataset.symbol,
                        decimals: parseInt(targetLi.dataset.decimals, 10), chainId: parseInt(targetLi.dataset.chainId, 10),
                        logo_uri: targetLi.querySelector('img')?.src, name: targetLi.textContent.split(' - ')[1]?.trim() || targetLi.dataset.symbol
                    };
                    if (token.chainId !== targetChainIdForTokenList) {
                        if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
                        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Ошибка: Токен из неверной сети.`);
                        return;
                    }

                    if (type === 'from') {
                        if (token.chainId !== selectedFromChainId) { /* ... ошибка ... */ return; }
                        selectedFromTokenBridge = token;
                        if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width:24px;height:24px;"> ${token.symbol}`;
                        await updateCurrentBalancesBridge();
                    } else {
                        if (token.chainId !== selectedToChainId) { /* ... ошибка ... */ return; }
                        selectedToTokenBridge = token;
                        if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width:24px;height:24px;"> ${token.symbol}`;
                    }
                    if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
                    currentBridgeQuote = null;
                    if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null);
                    if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
                    await updateBridgeUIStatus();
                }
            };
        }
    } catch (error) {
        console.error("Error bridge token select:", error);
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Ошибка загрузки токенов: ${error.message}`);
        if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
    }
}

async function updateCurrentBalancesBridge() {
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
    const currentWalletChainId = wallet.getChainId();

    if(!ui.updateTokenBalanceDisplay) { console.warn("bridge.js: ui.updateTokenBalanceDisplay not ready."); return;}

    if (!account || !provider || currentWalletChainId === null) {
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        return;
    }
    if (selectedFromTokenBridge &&
        selectedFromChainId === currentWalletChainId && // Баланс показываем, если ИСХОДНАЯ сеть моста = сеть кошелька
        selectedFromTokenBridge.chainId === selectedFromChainId) { // И токен принадлежит этой исходной сети
        ui.updateTokenBalanceDisplay('bridge-from-balance', 'Загрузка...', selectedFromTokenBridge.decimals);
        const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
        ui.updateTokenBalanceDisplay('bridge-from-balance', balance, selectedFromTokenBridge.decimals);
    } else {
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    }
}

async function handleGetBridgeQuote() {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId(); // Фактическая сеть кошелька
    const amountString = ui.elements.bridgeFromAmount?.value;

    if (!account) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Подключите кошелек."); return; }
    if (selectedFromChainId === null || selectedToChainId === null || !selectedFromTokenBridge || !selectedToTokenBridge) {
        if(ui.updateBridgeStatus) ui.updateBridgeStatus("Выберите сети и оба токена для моста."); return;
    }
    if (selectedFromChainId === selectedToChainId) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Выберите разные сети."); return; }

    // Для получения котировки и выполнения моста, кошелек ДОЛЖЕН быть на ИСХОДНОЙ сети моста
    if (currentWalletChainId !== selectedFromChainId) {
        const reqNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === selectedFromChainId);
        const curNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === currentWalletChainId);
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Кошелек на сети "${curNetInfo?.name}". Для моста из "${reqNetInfo?.name}" переключите кошелек.`);
        return;
    }
    if(selectedFromTokenBridge.chainId !== selectedFromChainId) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Токен отправки не соотв. исходной сети."); return; }
    if(selectedToTokenBridge.chainId !== selectedToChainId) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Токен получения не соотв. целевой сети."); return; }

    if (!amountString || parseFloat(amountString) <= 0) { if(ui.updateBridgeStatus) ui.updateBridgeStatus("Введите сумму > 0."); /* ... */ return; }
    let amountBigNumber;
    try { amountBigNumber = utils.parseTokenAmount(amountString, selectedFromTokenBridge.decimals); }
    catch (e) { if(ui.updateBridgeStatus) ui.updateBridgeStatus(e.message); return; }

    const provider = wallet.getProvider();
    const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
    if (amountBigNumber.gt(balance)) { if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Недостаточно ${selectedFromTokenBridge.symbol}.`); return; }

    if(ui.updateBridgeStatus) ui.updateBridgeStatus("Поиск пути через мост...");
    if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
    if(ui.elements.getBridgeQuoteBtn) ui.elements.getBridgeQuoteBtn.disabled = true;
    if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'Поиск...';
    if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null);

    const relayApiUrl = "https://api.relay.link/quote";
    const originCurrencyAddress = selectedFromTokenBridge.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedFromTokenBridge.address;
    const destinationCurrencyAddress = selectedToTokenBridge.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedToTokenBridge.address;

    const params = {
        user: account, originChainId: selectedFromChainId, destinationChainId: selectedToChainId,
        originCurrency: ethers.utils.getAddress(originCurrencyAddress), destinationCurrency: ethers.utils.getAddress(destinationCurrencyAddress),
        recipient: account, tradeType: 'EXACT_INPUT', amount: amountBigNumber.toString(),
        referrer: 'MyDApp_Bridge/1.3', useExternalLiquidity: false,
    };

    try {
        console.log("BRIDGE.JS: Requesting Bridge Relay API quote:", params);
        const response = await fetch(relayApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Статус ответа: ${response.status}` }));
            throw new Error(`Ошибка API Relay (${response.status}): ${errorData.message || errorData.error || 'Не удалось найти путь'}`);
        }
        const quoteData = await response.json();
        console.log("BRIDGE.JS: Received Bridge Relay API quote:", quoteData);
        if (!quoteData || !quoteData.steps || quoteData.steps.length === 0) {
            if(ui.updateBridgeStatus) ui.updateBridgeStatus("Путь для моста не найден.");
            if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'Нет пути';
            currentBridgeQuote = null; return;
        }

        let toAmountFromApi;
        let toTokenDecimalsFromApi = selectedToTokenBridge.decimals;

        if (quoteData.details?.currencyOut?.amount) {
            toAmountFromApi = quoteData.details.currencyOut.amount;
            if (typeof quoteData.details.currencyOut.currency?.decimals === 'number') {
                toTokenDecimalsFromApi = quoteData.details.currencyOut.currency.decimals;
            }
        } else if (quoteData.quote?.amountOut) {
            toAmountFromApi = quoteData.quote.amountOut;
        }

        if (!toAmountFromApi) {
            console.warn("BRIDGE.JS: Relay API - 'toAmount' не найден.", quoteData);
            if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'N/A';
        } else {
            if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = utils.formatTokenAmount(toAmountFromApi, toTokenDecimalsFromApi);
        }

        currentBridgeQuote = quoteData;
        const fromChainObj = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        const toChainObj = wallet.getSupportedNetworks().find(n => n.chainId === selectedToChainId);
        if(ui.updateBridgeDetails) ui.updateBridgeDetails(currentBridgeQuote, fromChainObj, toChainObj, selectedFromTokenBridge, selectedToTokenBridge);
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Готово к выполнению моста.`);
        if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.remove('d-none');

    } catch (error) {
        console.error("BRIDGE.JS: Error get bridge quote Relay:", error);
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Ошибка получения пути: ${error.message}`);
        if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'Ошибка';
        currentBridgeQuote = null;
    } finally {
        if(ui.elements.getBridgeQuoteBtn) ui.elements.getBridgeQuoteBtn.disabled = false;
    }
}

async function handleExecuteBridge() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentWalletChainId = wallet.getChainId(); // Фактическая сеть кошелька

    if (!account || !signer || !currentBridgeQuote || selectedFromChainId === null) {
        if(ui.updateBridgeStatus) ui.updateBridgeStatus("Ошибка: Нет котировки/сети или кошелек не подключен."); return;
    }
    // Для выполнения моста, кошелек ДОЛЖЕН быть на ИСХОДНОЙ сети моста
    if (currentWalletChainId !== selectedFromChainId) {
        const reqNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === selectedFromChainId);
        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Для выполнения моста из сети "${reqNetInfo?.name}" переключите кошелек.`); return;
    }

    if(ui.updateBridgeStatus) ui.updateBridgeStatus("Подготовка транзакции моста...");
    if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.disabled = true;
    let errorOccurred = false;
    const steps = currentBridgeQuote.steps;
    let currentStepIndex = 0;
    let bridgeReceipt = null;

    try {
        // ... (логика approve и bridge step как была, используя selectedFromChainId для explorerUrl) ...
        if (steps[currentStepIndex]?.id === 'approve') {
            const approvePayload = steps[currentStepIndex].items[0].data;
            if(!approvePayload || !approvePayload.to || !approvePayload.data) throw new Error("Некорректные данные для approve (мост).");
            // ... (отправка approve) ...
            const approveTx = await signer.sendTransaction({to: ethers.utils.getAddress(approvePayload.to), data: approvePayload.data, value: approvePayload.value ? ethers.BigNumber.from(approvePayload.value) : ethers.constants.Zero});
            ui.showTransactionStatusModal(`Разрешение (мост) отправлено...`, approveTx.hash, wallet.getExplorerUrl(selectedFromChainId) + approveTx.hash);
            const approveReceipt = await approveTx.wait();
            if(approveReceipt.status === 0) throw {message: `Approve TX (bridge) failed.`, transactionHash: approveReceipt.transactionHash, code: 'TX_REVERTED'};
            ui.showTransactionStatusModal("Разрешение (мост) подтверждено!", approveReceipt.transactionHash, wallet.getExplorerUrl(selectedFromChainId) + approveReceipt.transactionHash);
            currentStepIndex++;
            await new Promise(r => setTimeout(r, 2500)); ui.hideTransactionStatusModal();
        }

        const bridgeStepPayload = steps[currentStepIndex]?.items[0]?.data;
        if(!bridgeStepPayload || !bridgeStepPayload.to || !bridgeStepPayload.data) throw new Error("Некорректные данные для транзакции моста.");
        // ... (отправка bridge) ...
        const bridgeTx = await signer.sendTransaction({to: ethers.utils.getAddress(bridgeStepPayload.to), data: bridgeStepPayload.data, value: bridgeStepPayload.value ? ethers.BigNumber.from(bridgeStepPayload.value) : ethers.constants.Zero});
        ui.showTransactionStatusModal(`Мост отправлен...`, bridgeTx.hash, wallet.getExplorerUrl(selectedFromChainId) + bridgeTx.hash);
        bridgeReceipt = await bridgeTx.wait();
        if(bridgeReceipt.status === 0) throw {message: `Bridge TX failed.`, transactionHash: bridgeReceipt.transactionHash, code: 'TX_REVERTED'};

        ui.updateBridgeStatus(`Транзакция моста отправлена! Ожидайте поступления.`);
        ui.showTransactionStatusModal("Транзакция моста отправлена!", bridgeReceipt.transactionHash, wallet.getExplorerUrl(selectedFromChainId) + bridgeReceipt.transactionHash);

        // ОТПРАВКА УВЕДОМЛЕНИЯ НА БЭКЕНД
        const fromNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        const toNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedToChainId);
        const notificationPayload = {
            walletAddress: account,
            fromTokenSymbol: selectedFromTokenBridge.symbol,
            toTokenSymbol: selectedToTokenBridge.symbol,
            fromAmountStr: ui.elements.bridgeFromAmount.value,
            toAmountStr: ui.elements.bridgeToAmount.value, // Приблизительная сумма
            fromNetworkName: fromNetworkInfo?.name || `Сеть ID ${selectedFromChainId}`,
            toNetworkName: toNetworkInfo?.name || `Сеть ID ${selectedToChainId}`,
            transactionHashFrom: bridgeReceipt.transactionHash,
            explorerUrlBaseFrom: wallet.getExplorerUrl(selectedFromChainId)
        };
        console.log("BRIDGE.JS: Preparing to send bridge initiated notification:", notificationPayload);
        try {
            await utils.postData(`${utils.BACKEND_URL}/api/notify/bridge_initiated`, notificationPayload);
            console.log("BRIDGE.JS: Bridge initiated notification request sent to backend.");
        } catch (notifyError) {
            console.error("BRIDGE.JS: Error sending bridge initiated notification to backend:", notifyError);
        }

        resetBridgeTokensAndQuote('both');
        await updateBridgeUIStatus();
        setTimeout(() => { if(ui.hideTransactionStatusModal) ui.hideTransactionStatusModal(); }, 10000);

    } catch (error) {
        errorOccurred = true;
        // ... (обработка ошибок) ...
        console.error("BRIDGE.JS: Bridge execution failed:", error);
        let errMsg = error.message || "Неизвестная ошибка";
        if (error.code === 4001) errMsg = "Транзакция отклонена.";
        else if (error.code === 'TX_REVERTED') errMsg = `Транзакция не удалась (${error.transactionHash ? 'хэш: '+utils.formatAddress(error.transactionHash) : 'детали в консоли'}).`;

        if(ui.updateBridgeStatus) ui.updateBridgeStatus(`Ошибка: ${errMsg.substring(0,150)}`);
        if(ui.showTransactionStatusModal) ui.showTransactionStatusModal(`Ошибка: ${errMsg.substring(0,150)}`, error.transactionHash, error.transactionHash ? wallet.getExplorerUrl(selectedFromChainId) + error.transactionHash : null);

        const hideTimeout = (error.code === 4001 || error.code === 'TX_REVERTED') ? 6000 : 8000;
        setTimeout(() => { if(ui.hideTransactionStatusModal) ui.hideTransactionStatusModal(); }, hideTimeout);
    } finally {
        if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.disabled = false;
        if (errorOccurred && !(error.code === 4001 && currentStepIndex === 0 && bridgeReceipt === null)) {
             currentBridgeQuote = null; if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null); if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
        } else if (!errorOccurred) {
            // Кнопка execute уже скрыта через resetBridgeTokensAndQuote
        }
    }
}

async function resetState() {
    console.log("bridge.js: resetState called (e.g., tab switch or wallet chain change).");
    // Пере-заполняем селекторы сетей, они выберут значения по умолчанию или на основе текущей сети кошелька.
    // populateNetworkSelects также вызовет resetBridgeTokensAndQuote где нужно и updateBridgeUIStatus.
    if (typeof populateNetworkSelects === 'function') {
        populateNetworkSelects();
    } else {
        console.warn("bridge.js: populateNetworkSelects not available in resetState.");
        // Базовый сброс, если populateNetworkSelects недоступна
        selectedFromChainId = null;
        selectedToChainId = null;
        resetBridgeTokensAndQuote('both');
        await updateBridgeUIStatus();
    }
    console.log("bridge.js: resetState finished.");
}

window.bridge = {
    populateNetworkSelects,
    handleNetworkChange,
    handleTokenSelectClickBridge,
    handleGetBridgeQuote,
    handleExecuteBridge,
    updateCurrentBalances: updateCurrentBalancesBridge,
    resetState,
    selectedFromChainId: () => selectedFromChainId,
    selectedToChainId: () => selectedToChainId,
    selectedFromTokenBridge: () => selectedFromTokenBridge,
    selectedToTokenBridge: () => selectedToTokenBridge,
    currentBridgeQuote: () => currentBridgeQuote,
};