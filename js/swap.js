// js/swap.js

let selectedSwapNetworkId = null; // ID сети, выбранной в селекторе для свапа
let selectedFromToken = null;
let selectedToToken = null;
let currentSwapQuote = null; // Ответ от Relay API (или другого провайдера котировок)

// --- Инициализация и Управление Сетью Свапа ---
async function initializeSwapNetworkSelector() {
    console.log("swap.js: initializeSwapNetworkSelector called.");
    const supportedNetworksForSwap = wallet.getSupportedNetworks();
    const currentWalletChainId = wallet.getChainId();
    let defaultNetworkToSelectInUI = selectedSwapNetworkId; // Попытка сохранить предыдущий выбор

    if (!defaultNetworkToSelectInUI || (currentWalletChainId !== null && defaultNetworkToSelectInUI !== currentWalletChainId)) {
        if (currentWalletChainId !== null && supportedNetworksForSwap.some(net => net.chainId === currentWalletChainId)) {
            defaultNetworkToSelectInUI = currentWalletChainId;
        } else if (supportedNetworksForSwap.length > 0) {
            defaultNetworkToSelectInUI = supportedNetworksForSwap[0].chainId;
        } else {
            defaultNetworkToSelectInUI = null;
        }
    }

    if (ui.elements.swapNetworkSelect) {
        ui.populateNetworkSelect('swap-network-select', supportedNetworksForSwap, defaultNetworkToSelectInUI);
        const newlyUpdatedSelectedIdInUI = ui.elements.swapNetworkSelect.value ? parseInt(ui.elements.swapNetworkSelect.value, 10) : null;

        if (selectedSwapNetworkId !== newlyUpdatedSelectedIdInUI) {
             selectedSwapNetworkId = newlyUpdatedSelectedIdInUI;
             console.log("swap.js: selectedSwapNetworkId in module updated to:", selectedSwapNetworkId, "after populating select.");
             resetTokensAndQuote(); // Сбрасываем токены, если сеть в селекторе изменилась
        }
    } else {
        console.warn("swap.js: Swap network select element not found for initialization.");
        selectedSwapNetworkId = null;
        resetTokensAndQuote();
    }
    // После установки selectedSwapNetworkId (и возможного сброса токенов), обновляем весь UI свапа
    await updateSwapUIStatus();
}

async function handleSwapNetworkChange() {
    if (!ui.elements.swapNetworkSelect) { console.warn("Swap network select not found in handleSwapNetworkChange"); return; }

    const newSelectedChainIdInUI = ui.elements.swapNetworkSelect.value
        ? parseInt(ui.elements.swapNetworkSelect.value, 10)
        : null;

    // Если значение в селекторе не изменилось (с учетом null)
    if (selectedSwapNetworkId === newSelectedChainIdInUI) {
        return;
    }

    selectedSwapNetworkId = newSelectedChainIdInUI; // Обновляем ID сети, выбранной В СЕЛЕКТОРЕ
    console.log("swap.js: Network selection in UI changed to:", selectedSwapNetworkId);
    resetTokensAndQuote(); // Сбрасываем токены и котировку, так как сеть для свапа в UI изменилась

    if (!selectedSwapNetworkId) { // Пользователь выбрал "-- Выберите сеть --"
        await updateSwapUIStatus();
        return;
    }

    const currentWalletChainId = wallet.getChainId();
    const account = wallet.getAccount();

    if (account && currentWalletChainId !== null && selectedSwapNetworkId !== currentWalletChainId) {
        const targetNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Переключение кошелька на "${targetNetworkInfo?.name || selectedSwapNetworkId}"...`);

        const switchedSuccessfully = await wallet.switchChain(selectedSwapNetworkId);
        console.log("swap.js: wallet.switchChain request result:", switchedSuccessfully);
        // НЕ вызываем updateSwapUIStatus() здесь немедленно после switchChain,
        // так как 'chainChanged' событие должно его вызвать после фактического обновления состояния кошелька.
        // Если 'chainChanged' не сработает или не обновит UI, это отдельная проблема.
        if (!switchedSuccessfully && ui.updateSwapStatus) {
            // Если запрос на переключение не удался сразу (редко) или был отклонен
            ui.updateSwapStatus(`Не удалось переключить кошелек на "${targetNetworkInfo?.name || selectedSwapNetworkId}". Пожалуйста, сделайте это вручную.`);
            // Обновляем UI, чтобы отразить несоответствие сетей
            await updateSwapUIStatus();
        }
    } else {
        // Кошелек уже на нужной сети, или не подключен, или chainId не определен.
        // Обновляем UI на основе текущего selectedSwapNetworkId и состояния кошелька.
        await updateSwapUIStatus();
    }
}

function resetTokensAndQuote() {
    selectedFromToken = null;
    selectedToToken = null;
    currentSwapQuote = null;
    if (ui.elements.swapFromTokenBtn) ui.elements.swapFromTokenBtn.innerHTML = 'Выберите Токен';
    if (ui.elements.swapToTokenBtn) ui.elements.swapToTokenBtn.innerHTML = 'Выберите Токен';
    if (ui.elements.swapFromAmount) ui.elements.swapFromAmount.value = '';
    if (ui.elements.swapToAmount) ui.elements.swapToAmount.value = '';
    if (ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);
    if (ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
    if (ui.elements.getSwapQuoteBtn) ui.elements.getSwapQuoteBtn.disabled = false;
}

async function updateSwapUIStatus() {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId(); // Сеть, к которой ФАКТИЧЕСКИ подключен кошелек

    if (!ui.updateSwapStatus || !ui.updateTokenBalanceDisplay) { console.warn("swap.js: UI update functions not ready in updateSwapUIStatus."); return; }

    const isWalletConnected = !!account;
    const swapNetworkSelectDisabled = !isWalletConnected;
    const tokenButtonsDisabled = !isWalletConnected || !selectedSwapNetworkId || (currentWalletChainId !== selectedSwapNetworkId);

    if(ui.elements.swapNetworkSelect) ui.elements.swapNetworkSelect.disabled = swapNetworkSelectDisabled;
    if(ui.elements.swapFromTokenBtn) ui.elements.swapFromTokenBtn.disabled = tokenButtonsDisabled;
    if(ui.elements.swapToTokenBtn) ui.elements.swapToTokenBtn.disabled = tokenButtonsDisabled;


    if (!isWalletConnected) {
        ui.updateSwapStatus("Подключите кошелек.");
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        return;
    }

    if (!selectedSwapNetworkId) { // Сеть в UI селекторе не выбрана
        ui.updateSwapStatus("Выберите сеть для свапа.");
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        return;
    }

    // Сеть в UI выбрана, проверяем соответствие с кошельком
    if (currentWalletChainId !== null && selectedSwapNetworkId !== currentWalletChainId) {
        const selectedNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const currentNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        ui.updateSwapStatus(
            `Кошелек на сети "${currentNetworkInfo?.name || currentWalletChainId}". ` +
            `Для свапа в "${selectedNetworkInfo?.name || selectedSwapNetworkId}" переключите кошелек или выберите "${currentNetworkInfo?.name || currentWalletChainId}" в списке.`
        );
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    } else { // Сети совпадают (или currentWalletChainId еще null, но selectedSwapNetworkId есть)
        ui.updateSwapStatus(selectedFromToken && selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
        await updateCurrentBalances(); // Обновит баланс, если selectedSwapNetworkId == currentWalletChainId
    }
}

async function handleTokenSelectClick(type) {
    const account = wallet.getAccount();
    if (!account) { if(ui.updateSwapStatus) ui.updateSwapStatus("Подключите кошелек."); return; }
    if (!selectedSwapNetworkId) { if(ui.updateSwapStatus) ui.updateSwapStatus("Сначала выберите сеть для свапа."); return; }

    const currentWalletChainId = wallet.getChainId();
    if (currentWalletChainId !== selectedSwapNetworkId) {
        const selectedNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const currentNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        if(ui.updateSwapStatus) ui.updateSwapStatus(
            `Кошелек на сети "${currentNetworkInfo?.name || currentWalletChainId}". `+
            `Для выбора токенов в сети "${selectedNetworkInfo?.name || selectedSwapNetworkId}" переключите кошелек.`
        );
        return;
    }

    if(ui.updateSwapStatus) ui.updateSwapStatus(`Загрузка токенов для сети ID ${selectedSwapNetworkId}...`);
    try {
        const tokenList = await utils.getTokenList(selectedSwapNetworkId);
        if (!tokenList || tokenList.length === 0) {
            const networkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
            if(ui.updateSwapStatus) ui.updateSwapStatus(`Нет токенов для сети "${networkInfo?.name || selectedSwapNetworkId}".`);
            if(ui.hideTokenPickerModal) ui.hideTokenPickerModal(); // Закрыть, если была открыта
            return;
        }
        if(ui.updateSwapStatus) ui.updateSwapStatus(""); // Очистить статус "Загрузка"
        if(ui.showTokenPickerModal) ui.showTokenPickerModal(tokenList);

        if (ui.elements.tokenListUl) {
            ui.elements.tokenListUl.onclick = async (event) => { // Используем сохраненную ссылку
                const target = event.target.closest('li');
                if (target) {
                    const token = {
                        address: target.dataset.address, symbol: target.dataset.symbol,
                        decimals: parseInt(target.dataset.decimals, 10), chainId: parseInt(target.dataset.chainId, 10),
                        logo_uri: target.querySelector('img')?.src, name: target.textContent.split(' - ')[1]?.trim() || target.dataset.symbol
                    };

                    if (token.chainId !== selectedSwapNetworkId) {
                        if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
                        if(ui.updateSwapStatus) ui.updateSwapStatus(`Ошибка: Токен "${token.symbol}" из сети ID ${token.chainId}, ожидалась сеть ID ${selectedSwapNetworkId}.`);
                        return;
                    }
                    if ((type === 'from' && selectedToToken?.address === token.address && selectedToToken?.chainId === token.chainId) ||
                        (type === 'to' && selectedFromToken?.address === token.address && selectedFromToken?.chainId === token.chainId)) {
                        if(ui.updateSwapStatus) ui.updateSwapStatus("Нельзя выбрать одинаковые токены для обмена.");
                        if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
                        return;
                    }

                    if (type === 'from') {
                        selectedFromToken = token;
                        if(ui.elements.swapFromTokenBtn) ui.elements.swapFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width: 24px; height: 24px;"> ${token.symbol}`;
                        await updateCurrentBalances();
                    } else {
                        selectedToToken = token;
                        if(ui.elements.swapToTokenBtn) ui.elements.swapToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width: 24px; height: 24px;"> ${token.symbol}`;
                    }

                    if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
                    currentSwapQuote = null;
                    if (ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);
                    if (ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
                    if(ui.updateSwapStatus) ui.updateSwapStatus(selectedFromToken && selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
                }
            };
        }
    } catch (error) {
        console.error("Error handling token select click (swap):", error);
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Ошибка загрузки токенов: ${error.message}`);
        if(ui.hideTokenPickerModal) ui.hideTokenPickerModal();
    }
}

async function updateCurrentBalances() {
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
    const currentWalletChainId = wallet.getChainId();

    if (!ui.updateTokenBalanceDisplay) { console.warn("swap.js: ui.updateTokenBalanceDisplay not ready."); return; }

    if (!account || !provider || currentWalletChainId === null) {
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        return;
    }
    if (selectedFromToken &&
        selectedSwapNetworkId === currentWalletChainId && // Баланс показываем только если сеть свапа = сеть кошелька
        selectedFromToken.chainId === selectedSwapNetworkId) { // И токен принадлежит этой сети
        ui.updateTokenBalanceDisplay('swap-from-balance', 'Загрузка...', selectedFromToken.decimals);
        const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
        ui.updateTokenBalanceDisplay('swap-from-balance', balance, selectedFromToken.decimals);
    } else {
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    }
}

async function handleGetSwapQuote() {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId(); // Сеть, к которой ФАКТИЧЕСКИ подключен кошелек
    const amountString = ui.elements.swapFromAmount?.value;

    if (!account) { if(ui.updateSwapStatus) ui.updateSwapStatus("Подключите кошелек."); return; }
    if (selectedSwapNetworkId === null) { if(ui.updateSwapStatus) ui.updateSwapStatus("Выберите сеть для свапа."); return; }
    if (!selectedFromToken || !selectedToToken) { if(ui.updateSwapStatus) ui.updateSwapStatus("Выберите оба токена для свапа."); return; }

    if (currentWalletChainId !== selectedSwapNetworkId) {
        const selectedNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const currentNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        if(ui.updateSwapStatus) ui.updateSwapStatus(
            `Кошелек на сети "${currentNetInfo?.name || currentWalletChainId}". ` +
            `Для свапа в сети "${selectedNetInfo?.name || selectedSwapNetworkId}" переключите кошелек или выберите сеть "${currentNetInfo?.name || currentWalletChainId}".`
        );
        return;
    }
    if (selectedFromToken.chainId !== selectedSwapNetworkId || selectedToToken.chainId !== selectedSwapNetworkId) {
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Токены не соотв. выбранной сети (${selectedSwapNetworkId}). Перевыберите.`);
        resetTokensAndQuote(); await updateSwapUIStatus(); return;
    }
    if (!amountString || parseFloat(amountString) <= 0) {
        if(ui.updateSwapStatus) ui.updateSwapStatus("Введите сумму > 0.");
        /* ... сброс полей если нужно ... */ return;
    }

    let amountBigNumber;
    try { amountBigNumber = utils.parseTokenAmount(amountString, selectedFromToken.decimals); }
    catch (e) { if(ui.updateSwapStatus) ui.updateSwapStatus(e.message); return; }

    const provider = wallet.getProvider();
    const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
    if (amountBigNumber.gt(balance)) {
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Недостаточно ${selectedFromToken.symbol}.`); return;
    }

    if(ui.updateSwapStatus) ui.updateSwapStatus("Получение котировки свапа...");
    if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
    if(ui.elements.getSwapQuoteBtn) ui.elements.getSwapQuoteBtn.disabled = true;
    if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Загрузка...';
    if(ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);

    const relayApiUrl = "https://api.relay.link/quote";
    const originCurrencyAddress = selectedFromToken.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedFromToken.address;
    const destinationCurrencyAddress = selectedToToken.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedToToken.address;

    const params = {
        user: account, originChainId: selectedSwapNetworkId, destinationChainId: selectedSwapNetworkId,
        originCurrency: ethers.utils.getAddress(originCurrencyAddress), destinationCurrency: ethers.utils.getAddress(destinationCurrencyAddress),
        recipient: account, tradeType: 'EXACT_INPUT', amount: amountBigNumber.toString(),
        referrer: 'MyDApp_Swap/1.3', useExternalLiquidity: false,
    };

    try {
        console.log("SWAP.JS: Requesting Swap Relay API quote:", params);
        const response = await fetch(relayApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Статус ответа: ${response.status}` }));
            throw new Error(`Ошибка API Relay (${response.status}): ${errorData.message || errorData.error || 'Не удалось получить курс'}`);
        }
        const quoteData = await response.json();
        console.log("SWAP.JS: Received Swap Relay API quote:", quoteData);
        if (!quoteData || !quoteData.steps || quoteData.steps.length === 0) {
            if(ui.updateSwapStatus) ui.updateSwapStatus("Маршрут свапа не найден для данной пары/суммы.");
            if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Нет маршрута';
            currentSwapQuote = null; return;
        }

        let toAmountFromApi;
        let toTokenDecimalsFromApi = selectedToToken.decimals; // По умолчанию используем децималы выбранного TO токена

        if (quoteData.details?.currencyOut?.amount) {
            toAmountFromApi = quoteData.details.currencyOut.amount;
            if (typeof quoteData.details.currencyOut.currency?.decimals === 'number') {
                toTokenDecimalsFromApi = quoteData.details.currencyOut.currency.decimals;
            }
        } else if (quoteData.quote?.amountOut) {
            toAmountFromApi = quoteData.quote.amountOut;
        }

        if (!toAmountFromApi) {
            console.warn("SWAP.JS: Relay API - 'toAmount' не найден в ответе.", quoteData);
            if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'N/A';
        } else {
            if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = utils.formatTokenAmount(toAmountFromApi, toTokenDecimalsFromApi);
        }

        currentSwapQuote = quoteData;
        if(ui.updateSwapDetails) ui.updateSwapDetails(currentSwapQuote, selectedFromToken, selectedToToken);
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Готово к свапу.`);
        if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.remove('d-none');
    } catch (error) {
        console.error("SWAP.JS: Error get swap quote Relay:", error);
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Ошибка получения курса: ${error.message}`);
        if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Ошибка';
        currentSwapQuote = null;
    } finally {
        if(ui.elements.getSwapQuoteBtn) ui.elements.getSwapQuoteBtn.disabled = false;
    }
}

async function handleExecuteSwap() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentWalletChainId = wallet.getChainId(); // Фактическая сеть кошелька

    if (!account || !signer || !currentSwapQuote || selectedSwapNetworkId === null) {
        if(ui.updateSwapStatus) ui.updateSwapStatus("Ошибка: Нет котировки, сети или кошелек не подключен."); return;
    }
    if (currentWalletChainId !== selectedSwapNetworkId) { // Проверка соответствия сети кошелька и сети свапа
        const selNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === selectedSwapNetworkId);
        if(ui.updateSwapStatus) ui.updateSwapStatus(`Для выполнения свапа в сети "${selNetInfo?.name}" переключите кошелек.`); return;
    }

    if(ui.updateSwapStatus) ui.updateSwapStatus("Подготовка транзакции свапа...");
    if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.disabled = true;
    let errorOccurred = false;
    const steps = currentSwapQuote.steps;
    let currentStepIndex = 0;
    let swapReceipt = null; // Для хранения результата основной транзакции

    try {
        if (steps[currentStepIndex]?.id === 'approve') {
            const approvePayload = steps[currentStepIndex].items[0].data;
            if (!approvePayload || !approvePayload.to || !approvePayload.data) throw new Error("Некорректные данные для approve.");
            if(ui.updateSwapStatus) ui.updateSwapStatus("Запрос разрешения (approve)...");
            if(ui.showTransactionStatusModal) ui.showTransactionStatusModal("Ожидание подтверждения разрешения...", null, null);

            const approveTxRequest = {to: ethers.utils.getAddress(approvePayload.to), data: approvePayload.data, value: approvePayload.value ? ethers.BigNumber.from(approvePayload.value) : ethers.constants.Zero};
            console.log("SWAP.JS: Sending approve transaction:", approveTxRequest);
            const approveTx = await signer.sendTransaction(approveTxRequest);

            if(ui.showTransactionStatusModal) ui.showTransactionStatusModal(`Разрешение отправлено (хэш: ${utils.formatAddress(approveTx.hash)}). Ожидание...`, approveTx.hash, wallet.getExplorerUrl(selectedSwapNetworkId) + approveTx.hash);
            const approveReceipt = await approveTx.wait();
            if (approveReceipt.status === 0) throw { message: `Транзакция разрешения не удалась.`, transactionHash: approveReceipt.transactionHash, code: 'TX_REVERTED' };

            if(ui.showTransactionStatusModal) ui.showTransactionStatusModal("Разрешение подтверждено!", approveReceipt.transactionHash, wallet.getExplorerUrl(selectedSwapNetworkId) + approveReceipt.transactionHash);
            currentStepIndex++;
            await new Promise(r => setTimeout(r, 2500));
            if(ui.hideTransactionStatusModal) ui.hideTransactionStatusModal();
        }

        const swapStepData = steps[currentStepIndex]?.items[0]?.data;
        if(!swapStepData || !swapStepData.to || !swapStepData.data) throw new Error("Некорректные данные для транзакции свапа.");

        if(ui.updateSwapStatus) ui.updateSwapStatus("Отправка транзакции свапа...");
        if(ui.showTransactionStatusModal) ui.showTransactionStatusModal("Ожидание подтверждения свапа...", null, null);

        const swapTxRequest = {to: ethers.utils.getAddress(swapStepData.to), data: swapStepData.data, value: swapStepData.value ? ethers.BigNumber.from(swapStepData.value) : ethers.constants.Zero};
        console.log("SWAP.JS: Sending swap transaction:", swapTxRequest);
        const swapTx = await signer.sendTransaction(swapTxRequest);

        if(ui.showTransactionStatusModal) ui.showTransactionStatusModal(`Свап отправлен (хэш: ${utils.formatAddress(swapTx.hash)}). Ожидание...`, swapTx.hash, wallet.getExplorerUrl(selectedSwapNetworkId) + swapTx.hash);
        swapReceipt = await swapTx.wait(); // Сохраняем результат
        if (swapReceipt.status === 0) throw { message: `Транзакция свапа не удалась.`, transactionHash: swapReceipt.transactionHash, code: 'TX_REVERTED' };

        if(ui.updateSwapStatus) ui.updateSwapStatus(`Свап успешно выполнен!`);
        if(ui.showTransactionStatusModal) ui.showTransactionStatusModal("Свап успешно выполнен!", swapReceipt.transactionHash, wallet.getExplorerUrl(selectedSwapNetworkId) + swapReceipt.transactionHash);

        // ОТПРАВКА УВЕДОМЛЕНИЯ НА БЭКЕНД
        const currentNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const notificationPayload = {
            walletAddress: account,
            fromTokenSymbol: selectedFromToken.symbol,
            toTokenSymbol: selectedToToken.symbol,
            fromAmountStr: ui.elements.swapFromAmount.value,
            toAmountStr: ui.elements.swapToAmount.value,
            networkName: currentNetworkInfo?.name || `Сеть ID ${selectedSwapNetworkId}`,
            transactionHash: swapReceipt.transactionHash,
            explorerUrlBase: wallet.getExplorerUrl(selectedSwapNetworkId)
        };
        console.log("SWAP.JS: Preparing to send swap notification:", notificationPayload);
        try {
            await utils.postData(`${utils.BACKEND_URL}/api/notify/swap_completed`, notificationPayload);
            console.log("SWAP.JS: Swap completion notification request sent to backend.");
        } catch (notifyError) {
            console.error("SWAP.JS: Error sending swap completion notification to backend:", notifyError);
        }

        resetTokensAndQuote(); // Сбрасывает токены и котировку
        await updateSwapUIStatus(); // Обновляет UI и балансы для текущей selectedSwapNetworkId

        setTimeout(() => { if(ui.hideTransactionStatusModal) ui.hideTransactionStatusModal(); }, 7000);

    } catch (error) {
        errorOccurred = true;
        console.error("SWAP.JS: Swap execution failed:", error);
        let errMsg = error.message || "Неизвестная ошибка";
        if (error.code === 4001) errMsg = "Транзакция отклонена пользователем.";
        else if (error.code === 'TX_REVERTED') errMsg = `Транзакция не удалась (${error.transactionHash ? 'хэш: '+utils.formatAddress(error.transactionHash) : 'детали в консоли'}).`;

        if(ui.updateSwapStatus) ui.updateSwapStatus(`Ошибка: ${errMsg.substring(0,150)}`);
        if(ui.showTransactionStatusModal) ui.showTransactionStatusModal(`Ошибка: ${errMsg.substring(0,150)}`, error.transactionHash, error.transactionHash ? wallet.getExplorerUrl(selectedSwapNetworkId) + error.transactionHash : null);

        const hideTimeout = (error.code === 4001 || error.code === 'TX_REVERTED') ? 6000 : 8000;
        setTimeout(() => { if(ui.hideTransactionStatusModal) ui.hideTransactionStatusModal(); }, hideTimeout);
    } finally {
        if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.disabled = false;
        // Если произошла ошибка (кроме отмены пользователем на этапе approve, где котировка еще валидна)
        // или если все прошло успешно, сбрасываем котировку и скрываем кнопку execute.
        if (errorOccurred && !(error.code === 4001 && currentStepIndex === 0 && swapReceipt === null )) {
            currentSwapQuote = null;
            if(ui.updateSwapDetails) ui.updateSwapDetails(null,null,null);
            if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
        } else if (!errorOccurred) {
            // Кнопка execute уже скрыта через resetTokensAndQuote -> updateSwapUIStatus
        }
    }
}

async function resetState() {
    console.log("swap.js: resetState called (e.g., tab switch or wallet chain change).");
    // Эта функция вызывается, когда нужно полностью обновить состояние вкладки "Свап",
    // обычно из-за внешних событий (смена сети кошелька, переключение вкладок).
    // Она должна переинициализировать селектор сети, что, в свою очередь,
    // приведет к сбросу токенов и обновлению UI.
    if (typeof initializeSwapNetworkSelector === 'function') {
        await initializeSwapNetworkSelector();
    } else {
        console.warn("swap.js: initializeSwapNetworkSelector not available in resetState, doing basic reset.");
        resetTokensAndQuote(); // Базовый сброс токенов и котировки
        await updateSwapUIStatus(); // Обновить UI на основе текущего состояния (которое может быть неопределенным)
    }
    console.log("swap.js: resetState finished.");
}

window.swap = {
    initializeSwapNetworkSelector,
    handleSwapNetworkChange,
    handleTokenSelectClick,
    handleGetSwapQuote,
    handleExecuteSwap,
    updateCurrentBalances,
    resetState,
    selectedSwapNetworkId: () => selectedSwapNetworkId,
    selectedFromToken: () => selectedFromToken,
    selectedToToken: () => selectedToToken,
    currentSwapQuote: () => currentSwapQuote,
};