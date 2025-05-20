// js/bridge.js

let selectedFromChainId = null;
let selectedToChainId = null;
let selectedFromTokenBridge = null;
let selectedToTokenBridge = null;
let currentBridgeQuote = null;

function populateNetworkSelects() {
    const allSupportedNetworks = wallet.getSupportedNetworks();
    if (!allSupportedNetworks || allSupportedNetworks.length === 0) {
        console.warn("bridge.js: No supported networks available to populate selects.");
        // Можно показать сообщение в UI или заблокировать селекторы
        if(ui.elements.bridgeFromNetworkSelect) ui.elements.bridgeFromNetworkSelect.innerHTML = '<option value="">Сети не загружены</option>';
        if(ui.elements.bridgeToNetworkSelect) ui.elements.bridgeToNetworkSelect.innerHTML = '<option value="">Сети не загружены</option>';
        return;
    }

    const currentWalletChainId = wallet.getChainId();

    // Сохраняем текущие выбранные значения, если они есть и валидны
    const previouslySelectedFrom = selectedFromChainId;
    const previouslySelectedTo = selectedToChainId;

    // Логика выбора по умолчанию
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
        if (firstDifferentNetwork) {
            defaultToChainId = firstDifferentNetwork.chainId;
        } else if (allSupportedNetworks.length > 1) { // Если есть хотя бы 2 сети, но первая уже выбрана как from
             defaultToChainId = allSupportedNetworks.find(n => n.chainId !== defaultFromChainId)?.chainId || allSupportedNetworks[1]?.chainId || null;
        } else if (allSupportedNetworks.length === 1 && defaultFromChainId) {
             defaultToChainId = null; // Нельзя выбрать ту же сеть
        }
    }

    if (ui.elements.bridgeFromNetworkSelect) {
        ui.populateNetworkSelect('bridge-from-network', allSupportedNetworks, defaultFromChainId);
        selectedFromChainId = ui.elements.bridgeFromNetworkSelect.value ? parseInt(ui.elements.bridgeFromNetworkSelect.value, 10) : null;
    }
    if (ui.elements.bridgeToNetworkSelect) {
        ui.populateNetworkSelect('bridge-to-network', allSupportedNetworks, defaultToChainId);
        selectedToChainId = ui.elements.bridgeToNetworkSelect.value ? parseInt(ui.elements.bridgeToNetworkSelect.value, 10) : null;
    }

    // Если выбор сетей изменился в результате populate, сбросить токены
    if(previouslySelectedFrom !== selectedFromChainId) resetBridgeTokensAndQuote('from');
    if(previouslySelectedTo !== selectedToChainId) resetBridgeTokensAndQuote('to');

    console.log(`Bridge networks populated. From: ${selectedFromChainId}, To: ${selectedToChainId}`);
    updateBridgeUIStatus(); // Обновить UI после инициализации/изменения селекторов
}

async function handleNetworkChange(type, selectElement) {
    const newChainId = selectElement.value ? parseInt(selectElement.value, 10) : null;
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId();

    let networkChanged = false;

    if (type === 'from') {
        if (selectedFromChainId === newChainId) return; // Ничего не изменилось
        selectedFromChainId = newChainId;
        networkChanged = true;
        resetBridgeTokensAndQuote('from');

        if (account && selectedFromChainId && currentWalletChainId !== null && selectedFromChainId !== currentWalletChainId) {
            const targetNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
            ui.updateBridgeStatus(`Для моста из сети "${targetNetInfo?.name || selectedFromChainId}" требуется переключение кошелька...`);
            const switched = await wallet.switchChain(selectedFromChainId);
            if (!switched) {
                ui.updateBridgeStatus(`Не удалось переключить кошелек на "${targetNetInfo?.name || selectedFromChainId}". Переключите вручную.`);
                // updateBridgeUIStatus ниже обновит состояние на основе РЕАЛЬНОЙ сети кошелька
            }
            // Обновление UI (баланс и т.д.) произойдет в 'chainChanged' или в updateBridgeUIStatus ниже
        }
    } else { // type === 'to'
        if (selectedToChainId === newChainId) return;
        selectedToChainId = newChainId;
        networkChanged = true;
        resetBridgeTokensAndQuote('to');
    }

    if(networkChanged) {
        console.log(`Bridge network '${type}' changed to: ${newChainId}. From: ${selectedFromChainId}, To: ${selectedToChainId}`);
        await updateBridgeUIStatus(); // Обновляем UI в любом случае после смены сети в селекторе
    }
}

function resetBridgeTokensAndQuote(type = 'both') { // type can be 'from', 'to', or 'both'
    if (type === 'from' || type === 'both') {
        selectedFromTokenBridge = null;
        if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
    }
    if (type === 'to' || type === 'both') {
        selectedToTokenBridge = null;
        if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';
    }
    currentBridgeQuote = null;
    if (type === 'both') { // Сбрасываем суммы только если обе части сброшены или это полный reset
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

    if(!ui.updateBridgeStatus || !ui.updateTokenBalanceDisplay) return;

    if (!account) {
        ui.updateBridgeStatus("Подключите кошелек.");
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        // Блокируем элементы, если кошелек не подключен
        if(ui.elements.bridgeFromNetworkSelect) ui.elements.bridgeFromNetworkSelect.disabled = true;
        if(ui.elements.bridgeToNetworkSelect) ui.elements.bridgeToNetworkSelect.disabled = true;
        if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.disabled = true;
        if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.disabled = true;
        return;
    }

    // Разблокируем селекторы сетей
    if(ui.elements.bridgeFromNetworkSelect) ui.elements.bridgeFromNetworkSelect.disabled = false;
    if(ui.elements.bridgeToNetworkSelect) ui.elements.bridgeToNetworkSelect.disabled = false;


    if (selectedFromChainId === null || selectedToChainId === null) {
        ui.updateBridgeStatus("Выберите исходную и целевую сети.");
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.disabled = true; // Нельзя выбрать токен без сети
        if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.disabled = true;
        return;
    }
     // Кнопки выбора токенов активны, если сети выбраны
    if(ui.elements.bridgeFromTokenBtn) ui.elements.bridgeFromTokenBtn.disabled = false;
    if(ui.elements.bridgeToTokenBtn) ui.elements.bridgeToTokenBtn.disabled = false;

    if (selectedFromChainId === selectedToChainId) {
        ui.updateBridgeStatus("Исходная и целевая сети не должны совпадать.");
        // Баланс здесь не трогаем, так как это ошибка конфигурации пользователя
        return;
    }

    if (currentWalletChainId !== null && selectedFromChainId !== currentWalletChainId) {
        const selectedFromNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        const currentNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        ui.updateBridgeStatus(
            `Кошелек на сети "${currentNetInfo?.name || currentWalletChainId}". `+
            `Для моста из сети "${selectedFromNetInfo?.name || selectedFromChainId}" переключите кошелек или выберите другую исходную сеть.`
        );
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    } else {
        ui.updateBridgeStatus(selectedFromTokenBridge && selectedToTokenBridge ? "Найти лучший путь" : "Выберите токены и сумму");
        await updateCurrentBalancesBridge();
    }
}

async function handleTokenSelectClickBridge(type) {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId();
    const targetChainIdForTokenList = (type === 'from') ? selectedFromChainId : selectedToChainId;

    if (!account) { ui.updateBridgeStatus("Подключите кошелек."); return; }
    if (selectedFromChainId === null || selectedToChainId === null) { ui.updateBridgeStatus("Сначала выберите сети для моста."); return; }
    if (selectedFromChainId === selectedToChainId) { ui.updateBridgeStatus("Выберите разные сети."); return; }
    if (targetChainIdForTokenList === null) { ui.updateBridgeStatus(`Сначала выберите ${type === 'from' ? 'исходную' : 'целевую'} сеть.`); return; }

    if (type === 'from' && currentWalletChainId !== selectedFromChainId) {
        const fromNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        ui.updateBridgeStatus(`Для выбора токена из сети "${fromNetInfo?.name || selectedFromChainId}" переключите кошелек на эту сеть.`);
        return;
    }
    if (!wallet.getSupportedNetworks().find(net => net.chainId === targetChainIdForTokenList)) {
        ui.updateBridgeStatus(`Сеть (ID ${targetChainIdForTokenList}) не поддерживается для выбора токенов.`); return;
    }

    ui.updateBridgeStatus(`Загрузка токенов для сети ID ${targetChainIdForTokenList}...`);
    try {
        const tokenList = await utils.getTokenList(targetChainIdForTokenList);
        if (tokenList.length === 0) { ui.updateBridgeStatus(`Нет токенов для сети ID ${targetChainIdForTokenList}.`); return; }
        ui.updateBridgeStatus("");
        ui.showTokenPickerModal(tokenList);

        ui.elements.tokenListUl.onclick = async (event) => {
            const targetLi = event.target.closest('li');
            if (targetLi) {
                const token = { /* ... как было ... */
                    address: targetLi.dataset.address, symbol: targetLi.dataset.symbol,
                    decimals: parseInt(targetLi.dataset.decimals, 10), chainId: parseInt(targetLi.dataset.chainId, 10),
                    logo_uri: targetLi.querySelector('img')?.src, name: targetLi.textContent.split(' - ')[1] || targetLi.dataset.symbol
                };
                if (token.chainId !== targetChainIdForTokenList) { /* ... ошибка ... */ return; }

                // Проверка на одинаковые токены
                if ((type === 'from' && selectedToTokenBridge?.address === token.address && selectedToTokenBridge?.chainId === token.chainId && selectedFromChainId === selectedToChainId) ||
                    (type === 'to' && selectedFromTokenBridge?.address === token.address && selectedFromTokenBridge?.chainId === token.chainId && selectedFromChainId === selectedToChainId)) {
                     // Эта проверка имеет смысл только если fromChainId === toChainId, что мы уже запретили
                     // Но если вдруг логика поменяется, она здесь.
                     // ui.updateBridgeStatus("Нельзя выбрать одинаковые токены для отправки и получения в одной сети через мост.");
                     // ui.hideTokenPickerModal();
                     // return;
                }


                if (type === 'from') {
                    if (token.chainId !== selectedFromChainId) { ui.hideTokenPickerModal(); ui.updateBridgeStatus(`Токен ${token.symbol} не на исходной сети.`); return; }
                    selectedFromTokenBridge = token;
                    ui.elements.bridgeFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width:24px;height:24px;"> ${token.symbol}`;
                    await updateCurrentBalancesBridge();
                } else { // type === 'to'
                    if (token.chainId !== selectedToChainId) { ui.hideTokenPickerModal(); ui.updateBridgeStatus(`Токен ${token.symbol} не на целевой сети.`); return; }
                    selectedToTokenBridge = token;
                    ui.elements.bridgeToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width:24px;height:24px;"> ${token.symbol}`;
                }
                ui.hideTokenPickerModal();
                currentBridgeQuote = null;
                if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null);
                if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
                await updateBridgeUIStatus(); // Обновить статус после выбора токена
            }
        };
    } catch (error) { /* ... */ }
}

async function updateCurrentBalancesBridge() { // Вызывается из wallet.js и изнутри bridge.js
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
    const currentWalletChainId = wallet.getChainId();

    if(!ui.updateTokenBalanceDisplay) return;

    if (!account || !provider || currentWalletChainId === null) {
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        return;
    }
    if (selectedFromTokenBridge &&
        selectedFromChainId === currentWalletChainId &&
        selectedFromTokenBridge.chainId === selectedFromChainId) {
        ui.updateTokenBalanceDisplay('bridge-from-balance', 'Загрузка...', selectedFromTokenBridge.decimals);
        const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
        ui.updateTokenBalanceDisplay('bridge-from-balance', balance, selectedFromTokenBridge.decimals);
    } else {
        ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    }
}

async function handleGetBridgeQuote() {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId();
    const amountString = ui.elements.bridgeFromAmount?.value;

    if (!account) { ui.updateBridgeStatus("Подключите кошелек."); return; }
    if (selectedFromChainId === null || selectedToChainId === null || !selectedFromTokenBridge || !selectedToTokenBridge) {
        ui.updateBridgeStatus("Выберите сети и оба токена для моста."); return;
    }
    if (selectedFromChainId === selectedToChainId) { ui.updateBridgeStatus("Выберите разные сети."); return; }
    if (currentWalletChainId !== selectedFromChainId) {
        const reqNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === selectedFromChainId);
        const curNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === currentWalletChainId);
        ui.updateBridgeStatus(`Кошелек на сети "${curNetInfo?.name}". Для моста из "${reqNetInfo?.name}" переключите кошелек.`);
        return;
    }
    // Доп. проверки на соответствие токенов выбранным сетям
    if(selectedFromTokenBridge.chainId !== selectedFromChainId) { ui.updateBridgeStatus("Токен отправки не соответствует исходной сети."); return; }
    if(selectedToTokenBridge.chainId !== selectedToChainId) { ui.updateBridgeStatus("Токен получения не соответствует целевой сети."); return; }

    if (!amountString || parseFloat(amountString) <= 0) { ui.updateBridgeStatus("Введите сумму > 0."); /* ... */ return; }
    let amountBigNumber;
    try { amountBigNumber = utils.parseTokenAmount(amountString, selectedFromTokenBridge.decimals); }
    catch (e) { ui.updateBridgeStatus(e.message); /* ... */ return; }

    const provider = wallet.getProvider();
    const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
    if (amountBigNumber.gt(balance)) { ui.updateBridgeStatus(`Недостаточно ${selectedFromTokenBridge.symbol}.`); /* ... */ return; }

    ui.updateBridgeStatus("Поиск пути через мост...");
    /* ... остальная логика кнопки ... */
    if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
    if(ui.elements.getBridgeQuoteBtn) ui.elements.getBridgeQuoteBtn.disabled = true;
    if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'Поиск...';
    if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null);


    const relayApiUrl = "https://api.relay.link/quote";
    const originCurrencyAddress = selectedFromTokenBridge.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedFromTokenBridge.address;
    const destinationCurrencyAddress = selectedToTokenBridge.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedToTokenBridge.address;

    const params = { /* ... как было, используя selectedFromChainId и selectedToChainId ... */
        user: account, originChainId: selectedFromChainId, destinationChainId: selectedToChainId,
        originCurrency: ethers.utils.getAddress(originCurrencyAddress), destinationCurrency: ethers.utils.getAddress(destinationCurrencyAddress),
        recipient: account, tradeType: 'EXACT_INPUT', amount: amountBigNumber.toString(),
        referrer: 'MyDApp_Bridge/1.2', useExternalLiquidity: false,
    };

    try {
        // ... (fetch и обработка ответа Relay как была) ...
        console.log("Requesting Bridge Relay API quote:", params);
        const response = await fetch(relayApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Статус: ${response.status}` }));
            throw new Error(`Ошибка API Relay (${response.status}): ${errorData.message || errorData.error || 'Не удалось найти путь'}`);
        }
        const quoteData = await response.json();
        console.log("Received Bridge Relay API quote:", quoteData);
        if (!quoteData || !quoteData.steps || quoteData.steps.length === 0) {
            ui.updateBridgeStatus("Путь для моста не найден.");
            if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'Нет пути';
            currentBridgeQuote = null; return;
        }
        let toAmountFromApi;
        if (quoteData.quote?.amountOut) toAmountFromApi = quoteData.quote.amountOut;
        else if (quoteData.steps) { /* ...логика извлечения toAmount... */ }

        if (!toAmountFromApi) { if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'N/A'; }
        else { if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = utils.formatTokenAmount(toAmountFromApi, selectedToTokenBridge.decimals); }

        currentBridgeQuote = quoteData;
        const fromChainObj = wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId);
        const toChainObj = wallet.getSupportedNetworks().find(n => n.chainId === selectedToChainId);
        if(ui.updateBridgeDetails) ui.updateBridgeDetails(currentBridgeQuote, fromChainObj, toChainObj, selectedFromTokenBridge, selectedToTokenBridge);
        ui.updateBridgeStatus(`Готово к выполнению моста.`);
        if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.remove('d-none');

    } catch (error) {
        console.error("Error get bridge quote Relay:", error);
        ui.updateBridgeStatus(`Ошибка: ${error.message}`);
        if(ui.elements.bridgeToAmount) ui.elements.bridgeToAmount.value = 'Ошибка';
        currentBridgeQuote = null;
    } finally {
        if(ui.elements.getBridgeQuoteBtn) ui.elements.getBridgeQuoteBtn.disabled = false;
    }
}

async function handleExecuteBridge() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentWalletChainId = wallet.getChainId();

    if (!account || !signer || !currentBridgeQuote || selectedFromChainId === null) {
        ui.updateBridgeStatus("Ошибка: Нет котировки/сети или кошелек не подключен."); return;
    }
    if (currentWalletChainId !== selectedFromChainId) {
        const reqNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === selectedFromChainId);
        ui.updateBridgeStatus(`Для выполнения моста из сети "${reqNetInfo?.name}" переключите кошелек.`); return;
    }
    if (currentBridgeQuote.originChainId !== selectedFromChainId) {
        ui.updateBridgeStatus(`Ошибка: Котировка для другой исходной сети. Получите новый путь.`);
        currentBridgeQuote = null; if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null); if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none'); return;
    }

    ui.updateBridgeStatus("Подготовка транзакции моста...");
    if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.disabled = true;
    let errorOccurred = false;
    const steps = currentBridgeQuote.steps;
    let currentStepIndex = 0;

    try {
        // ... (логика approve и bridge step как была, используя selectedFromChainId для explorerUrl) ...
         if (steps[currentStepIndex]?.id === 'approve') { /* ... approve logic ... */
            const approvePayload = steps[currentStepIndex].items[0].data;
            // ...
            const approveTx = await signer.sendTransaction({to: ethers.utils.getAddress(approvePayload.to), data: approvePayload.data, value: approvePayload.value ? ethers.BigNumber.from(approvePayload.value) : ethers.constants.Zero});
            ui.showTransactionStatusModal(`Разрешение (мост) отправлено...`, approveTx.hash, wallet.getExplorerUrl(selectedFromChainId) + approveTx.hash);
            const approveReceipt = await approveTx.wait();
            if (approveReceipt.status === 0) throw { message: `Approve TX (bridge) failed.`, transactionHash: approveReceipt.transactionHash, code: 'TX_REVERTED' };
            ui.showTransactionStatusModal("Разрешение (мост) подтверждено!", approveReceipt.transactionHash, wallet.getExplorerUrl(selectedFromChainId) + approveReceipt.transactionHash);
            currentStepIndex++;
            await new Promise(r => setTimeout(r, 2500)); ui.hideTransactionStatusModal();
        }
        const bridgePayload = steps[currentStepIndex]?.items[0]?.data;
        if(!bridgePayload) throw new Error("Bridge payload data missing.");
        // ...
        const bridgeTx = await signer.sendTransaction({to: ethers.utils.getAddress(bridgePayload.to), data: bridgePayload.data, value: bridgePayload.value ? ethers.BigNumber.from(bridgePayload.value) : ethers.constants.Zero});
        ui.showTransactionStatusModal(`Мост отправлен...`, bridgeTx.hash, wallet.getExplorerUrl(selectedFromChainId) + bridgeTx.hash);
        const bridgeReceipt = await bridgeTx.wait();
        if (bridgeReceipt.status === 0) throw { message: `Bridge TX failed.`, transactionHash: bridgeReceipt.transactionHash, code: 'TX_REVERTED' };
        ui.updateBridgeStatus(`Транзакция моста отправлена! Ожидайте поступления.`);
        ui.showTransactionStatusModal("Транзакция моста отправлена!", bridgeReceipt.transactionHash, wallet.getExplorerUrl(selectedFromChainId) + bridgeReceipt.transactionHash);

        // Сбрасываем только токены и котировку, сети остаются выбранными
        resetBridgeTokensAndQuote('both'); // Сбросит токены и суммы
        await updateBridgeUIStatus(); // Обновит статус
        // await wallet.updateCurrentBalances(); // Вызовется через updateBridgeUIStatus -> updateCurrentBalancesBridge

        setTimeout(() => ui.hideTransactionStatusModal(), 10000);
    } catch (error) {
        errorOccurred = true;
        // ... (обработка ошибок как была) ...
        console.error("Bridge execution failed:", error);
        let errMsg = error.message || "Неизвестная ошибка";
        if (error.code === 4001) errMsg = "Транзакция отклонена.";
        ui.updateBridgeStatus(`Ошибка: ${errMsg.substring(0,100)}`);
        ui.showTransactionStatusModal(`Ошибка: ${errMsg.substring(0,100)}`, error.transactionHash, error.transactionHash ? wallet.getExplorerUrl(selectedFromChainId) + error.transactionHash : null);
        setTimeout(() => ui.hideTransactionStatusModal(), (error.code === 4001 || error.code === 'TX_REVERTED') ? 5000:8000);
    } finally {
        if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.disabled = false;
        if (errorOccurred && !(error.code === 4001 && currentStepIndex === 0)) {
            currentBridgeQuote = null; if(ui.updateBridgeDetails) ui.updateBridgeDetails(null,null,null,null,null); if(ui.elements.executeBridgeBtn) ui.elements.executeBridgeBtn.classList.add('d-none');
        } else if (!errorOccurred) {
            // Кнопка execute уже скрыта через resetBridgeTokensAndQuote
        }
    }
}

async function resetState() { // Вызывается извне (app.js, wallet.js)
    console.log("bridge.js: resetState called");
    // При полном сбросе, пере-заполняем селекторы сетей,
    // они выберут значения по умолчанию (или текущую сеть кошелька)
    populateNetworkSelects(); // Это также вызовет resetBridgeTokensAndQuote где нужно и updateBridgeUIStatus
    // Дополнительно можно сбросить все переменные состояния модуля, если populate не делает это полностью
    // selectedFromChainId = null; // populateNetworkSelects их установит
    // selectedToChainId = null;
    // resetBridgeTokensAndQuote('both'); // Уже вызывается внутри populate, если сети изменились
    // await updateBridgeUIStatus(); // Уже вызывается внутри populate
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