// js/swap.js

let selectedSwapNetworkId = null; // ID сети, выбранной в селекторе для свапа
let selectedFromToken = null;
let selectedToToken = null;
let currentSwapQuote = null; // Ответ от Relay API (или другого провайдера котировок)

// --- Инициализация и Управление Сетью Свапа ---

async function initializeSwapNetworkSelector() {
    const supportedNetworksForSwap = wallet.getSupportedNetworks();
    const currentWalletChainId = wallet.getChainId(); // Сеть, на которой СЕЙЧАС кошелек
    let defaultNetworkToSelectInUI = selectedSwapNetworkId; // Попытаться сохранить предыдущий выбор пользователя

    // Если предыдущего выбора не было ИЛИ он не соответствует текущей сети кошелька (после переключения)
    // ИЛИ кошелек вообще не подключен к сети, выбираем сеть кошелька или первую доступную
    if (!defaultNetworkToSelectInUI || (currentWalletChainId && defaultNetworkToSelectInUI !== currentWalletChainId)) {
        if (currentWalletChainId && supportedNetworksForSwap.some(net => net.chainId === currentWalletChainId)) {
            defaultNetworkToSelectInUI = currentWalletChainId;
        } else if (supportedNetworksForSwap.length > 0) {
            defaultNetworkToSelectInUI = supportedNetworksForSwap[0].chainId;
        } else {
            defaultNetworkToSelectInUI = null; // Нет доступных сетей
        }
    }

    if (ui.elements.swapNetworkSelect) { // Проверка, что элемент существует
        ui.populateNetworkSelect('swap-network-select', supportedNetworksForSwap, defaultNetworkToSelectInUI);

        const selectElement = ui.elements.swapNetworkSelect;
        const newlyUpdatedSelectedIdInUI = selectElement && selectElement.value ? parseInt(selectElement.value, 10) : null;

        if (selectedSwapNetworkId !== newlyUpdatedSelectedIdInUI) {
             selectedSwapNetworkId = newlyUpdatedSelectedIdInUI;
             console.log("Swap network UI selector updated. Selected ID for swap:", selectedSwapNetworkId);
             resetTokensAndQuote();
        }
    } else {
        console.warn("Swap network select element not found for initialization.");
        selectedSwapNetworkId = null; // Если селектора нет, сбрасываем
        resetTokensAndQuote();
    }
    await updateSwapUIStatus();
}

async function handleSwapNetworkChange() {
    if (!ui.elements.swapNetworkSelect) return; // Защита

    const newSelectedChainId = ui.elements.swapNetworkSelect.value
        ? parseInt(ui.elements.swapNetworkSelect.value, 10)
        : null;

    if (selectedSwapNetworkId === newSelectedChainId) {
        if (newSelectedChainId === null && selectedSwapNetworkId !== null) {
            selectedSwapNetworkId = null;
            resetTokensAndQuote();
            await updateSwapUIStatus();
        }
        return;
    }

    selectedSwapNetworkId = newSelectedChainId;
    console.log("Swap network selection changed by user to:", selectedSwapNetworkId);
    resetTokensAndQuote();

    if (!selectedSwapNetworkId) {
        await updateSwapUIStatus();
        return;
    }

    const currentWalletChainId = wallet.getChainId();
    const account = wallet.getAccount();

    if (account && currentWalletChainId !== null && selectedSwapNetworkId !== currentWalletChainId) {
        const targetNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        ui.updateSwapStatus(`Переключение кошелька на сеть "${targetNetworkInfo?.name || selectedSwapNetworkId}"...`);

        const switchedSuccessfully = await wallet.switchChain(selectedSwapNetworkId);

        if (switchedSuccessfully) {
            // UI обновится через 'chainChanged'
        } else {
            ui.updateSwapStatus(`Не удалось переключить кошелек. Для операций в сети "${targetNetworkInfo?.name || selectedSwapNetworkId}" переключите вручную.`);
             // Важно: если не удалось переключить, селектор на сайте может показывать одну сеть,
             // а кошелек будет на другой. updateSwapUIStatus должен это отразить.
             await updateSwapUIStatus(); // Обновить статус на основе РЕАЛЬНОЙ сети кошелька
        }
    } else {
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
    const currentWalletChainId = wallet.getChainId();

    if (!ui.updateSwapStatus || !ui.updateTokenBalanceDisplay) return; // Защита, если UI еще не готов

    if (!account) {
        ui.updateSwapStatus("Подключите кошелек.");
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        if(ui.elements.swapFromTokenBtn) ui.elements.swapFromTokenBtn.disabled = true;
        if(ui.elements.swapToTokenBtn) ui.elements.swapToTokenBtn.disabled = true;
        if(ui.elements.swapNetworkSelect) ui.elements.swapNetworkSelect.disabled = true; // Блокируем селектор сети тоже
        return;
    }

    // Селектор сети всегда активен, если кошелек подключен
    if(ui.elements.swapNetworkSelect) ui.elements.swapNetworkSelect.disabled = false;


    if (!selectedSwapNetworkId) {
        ui.updateSwapStatus("Выберите сеть для свапа.");
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        if(ui.elements.swapFromTokenBtn) ui.elements.swapFromTokenBtn.disabled = true;
        if(ui.elements.swapToTokenBtn) ui.elements.swapToTokenBtn.disabled = true;
        return;
    }

    if(ui.elements.swapFromTokenBtn) ui.elements.swapFromTokenBtn.disabled = false;
    if(ui.elements.swapToTokenBtn) ui.elements.swapToTokenBtn.disabled = false;

    if (currentWalletChainId !== null && selectedSwapNetworkId !== currentWalletChainId) {
        const selectedNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const currentNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        ui.updateSwapStatus(
            `Кошелек на сети "${currentNetworkInfo?.name || currentWalletChainId}". ` +
            `Для свапа в сети "${selectedNetworkInfo?.name || selectedSwapNetworkId}" переключите кошелек или выберите другую сеть.`
        );
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    } else {
        ui.updateSwapStatus(selectedFromToken && selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
        await updateCurrentBalances();
    }
}

async function handleTokenSelectClick(type) {
    const account = wallet.getAccount();
    if (!account) { ui.updateSwapStatus("Подключите кошелек."); return; }
    if (!selectedSwapNetworkId) { ui.updateSwapStatus("Сначала выберите сеть для свапа."); return; }

    const currentWalletChainId = wallet.getChainId();
    if (currentWalletChainId !== selectedSwapNetworkId) {
        const selectedNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const currentNetworkInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
         ui.updateSwapStatus(
            `Кошелек на сети "${currentNetworkInfo?.name || currentWalletChainId}". `+
            `Для выбора токенов в сети "${selectedNetworkInfo?.name || selectedSwapNetworkId}" переключите кошелек.`
        );
        return;
    }

    ui.updateSwapStatus(`Загрузка токенов для сети ID ${selectedSwapNetworkId}...`);
    try {
        const tokenList = await utils.getTokenList(selectedSwapNetworkId);
        if (tokenList.length === 0) {
            const networkInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
            ui.updateSwapStatus(`Нет токенов для сети "${networkInfo?.name || selectedSwapNetworkId}".`);
            return;
        }
        ui.updateSwapStatus("");
        ui.showTokenPickerModal(tokenList);

        ui.elements.tokenListUl.onclick = async (event) => {
            const target = event.target.closest('li');
            if (target) {
                const token = {
                    address: target.dataset.address,
                    symbol: target.dataset.symbol,
                    decimals: parseInt(target.dataset.decimals, 10),
                    chainId: parseInt(target.dataset.chainId, 10),
                    logo_uri: target.querySelector('img')?.src,
                    name: target.textContent.split(' - ')[1] || target.dataset.symbol
                };

                if (token.chainId !== selectedSwapNetworkId) {
                    ui.hideTokenPickerModal();
                    ui.updateSwapStatus(`Ошибка: Токен "${token.symbol}" из сети ID ${token.chainId}, ожидалась сеть ID ${selectedSwapNetworkId}.`);
                    return;
                }
                if ((type === 'from' && selectedToToken?.address === token.address && selectedToToken?.chainId === token.chainId) ||
                    (type === 'to' && selectedFromToken?.address === token.address && selectedFromToken?.chainId === token.chainId)) {
                    ui.updateSwapStatus("Нельзя выбрать одинаковые токены для обмена.");
                    ui.hideTokenPickerModal();
                    return;
                }

                if (type === 'from') {
                    selectedFromToken = token;
                    ui.elements.swapFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width: 24px; height: 24px;"> ${token.symbol}`;
                    await updateCurrentBalances();
                } else {
                    selectedToToken = token;
                    ui.elements.swapToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle token-icon" style="width: 24px; height: 24px;"> ${token.symbol}`;
                }

                ui.hideTokenPickerModal();
                currentSwapQuote = null;
                if (ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);
                if (ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
                ui.updateSwapStatus(selectedFromToken && selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
            }
        };
    } catch (error) {
        console.error("Error handling token select click (swap):", error);
        ui.updateSwapStatus(`Ошибка загрузки токенов: ${error.message}`);
        ui.hideTokenPickerModal();
    }
}

async function updateCurrentBalances() { // Эта функция вызывается ИЗ wallet.js и изнутри swap.js
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
    const currentWalletChainId = wallet.getChainId(); // Сеть, к которой ПОДКЛЮЧЕН кошелек

    if (!ui.updateTokenBalanceDisplay) return;

    if (!account || !provider || currentWalletChainId === null) {
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        return;
    }
    // Баланс FROM токена показываем, только если:
    // 1. FROM токен выбран (selectedFromToken)
    // 2. Сеть, ВЫБРАННАЯ ДЛЯ СВАПА (selectedSwapNetworkId), совпадает с текущей сетью кошелька
    // 3. Сеть самого FROM токена (selectedFromToken.chainId) совпадает с выбранной сетью для свапа
    if (selectedFromToken &&
        selectedSwapNetworkId === currentWalletChainId &&
        selectedFromToken.chainId === selectedSwapNetworkId) {
        ui.updateTokenBalanceDisplay('swap-from-balance', 'Загрузка...', selectedFromToken.decimals);
        const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
        ui.updateTokenBalanceDisplay('swap-from-balance', balance, selectedFromToken.decimals);
    } else {
        ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    }
}

async function handleGetSwapQuote() {
    const account = wallet.getAccount();
    const currentWalletChainId = wallet.getChainId();
    const amountString = ui.elements.swapFromAmount?.value;

    if (!account) { ui.updateSwapStatus("Подключите кошелек."); return; }
    if (selectedSwapNetworkId === null) { ui.updateSwapStatus("Выберите сеть для свапа."); return; }
    if (!selectedFromToken || !selectedToToken) { ui.updateSwapStatus("Выберите оба токена для свапа."); return; }

    if (currentWalletChainId !== selectedSwapNetworkId) {
        const selectedNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === selectedSwapNetworkId);
        const currentNetInfo = wallet.getSupportedNetworks().find(n => n.chainId === currentWalletChainId);
        ui.updateSwapStatus(
            `Кошелек на сети "${currentNetInfo?.name || currentWalletChainId}". ` +
            `Для свапа в сети "${selectedNetInfo?.name || selectedSwapNetworkId}" переключите кошелек или выберите сеть "${currentNetInfo?.name || currentWalletChainId}".`
        );
        return;
    }
    if (selectedFromToken.chainId !== selectedSwapNetworkId || selectedToToken.chainId !== selectedSwapNetworkId) {
        ui.updateSwapStatus(`Ошибка: Токены не соответствуют выбранной сети свапа (ID ${selectedSwapNetworkId}). Перевыберите токены.`);
        resetTokensAndQuote();
        await updateSwapUIStatus();
        return;
    }
    if (!amountString || parseFloat(amountString) <= 0) {
        ui.updateSwapStatus("Введите сумму больше нуля.");
        if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = '';
        if(ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);
        if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
        return;
    }

    let amountBigNumber;
    try { amountBigNumber = utils.parseTokenAmount(amountString, selectedFromToken.decimals); }
    catch (e) { ui.updateSwapStatus(e.message); /* ... */ return; }

    const provider = wallet.getProvider();
    const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
    if (amountBigNumber.gt(balance)) {
        ui.updateSwapStatus(`Недостаточно ${selectedFromToken.symbol}. Баланс: ${utils.formatTokenAmount(balance, selectedFromToken.decimals)}.`);
        /* ... */ return;
    }

    ui.updateSwapStatus("Получение котировки свапа...");
    if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
    if(ui.elements.getSwapQuoteBtn) ui.elements.getSwapQuoteBtn.disabled = true;
    if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Загрузка...';
    if(ui.updateSwapDetails) ui.updateSwapDetails(null, null, null);

    const relayApiUrl = "https://api.relay.link/quote";
    const originCurrencyAddress = selectedFromToken.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedFromToken.address;
    const destinationCurrencyAddress = selectedToToken.address.toUpperCase() === 'NATIVE' ? utils.ZERO_ADDRESS : selectedToToken.address;

    const params = { /* ... как было ... */
        user: account, originChainId: selectedSwapNetworkId, destinationChainId: selectedSwapNetworkId,
        originCurrency: ethers.utils.getAddress(originCurrencyAddress), destinationCurrency: ethers.utils.getAddress(destinationCurrencyAddress),
        recipient: account, tradeType: 'EXACT_INPUT', amount: amountBigNumber.toString(),
        referrer: 'MyDApp_Swap/1.2', useExternalLiquidity: false,
    };

    try {
        // ... (fetch и обработка ответа Relay как была) ...
        console.log("Requesting Swap Relay API quote:", params);
        const response = await fetch(relayApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Статус: ${response.status}` }));
            throw new Error(`Ошибка API Relay (${response.status}): ${errorData.message || errorData.error || 'Не удалось получить курс'}`);
        }
        const quoteData = await response.json();
        console.log("Received Swap Relay API quote:", quoteData);
        if (!quoteData || !quoteData.steps || quoteData.steps.length === 0) {
            ui.updateSwapStatus("Маршрут свапа не найден.");
            if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Нет маршрута';
            currentSwapQuote = null; return;
        }

        let toAmountFromApi;
        let toTokenDecimalsFromApi;

        // Ищем сумму получения в структуре ответа
        if (quoteData.details && quoteData.details.currencyOut && quoteData.details.currencyOut.amount) {
            toAmountFromApi = quoteData.details.currencyOut.amount; // Это строка с суммой в минимальных единицах

            // Пытаемся получить децималы токена, который мы получим
            if (quoteData.details.currencyOut.currency && typeof quoteData.details.currencyOut.currency.decimals === 'number') {
                toTokenDecimalsFromApi = quoteData.details.currencyOut.currency.decimals;
            } else {
                // Если децималы не пришли в ответе API для currencyOut,
                // используем децималы из нашего selectedToToken (должны совпадать)
                toTokenDecimalsFromApi = selectedToToken.decimals;
                console.warn("Relay API: Decimals for currencyOut not found directly in API response, using selectedToToken.decimals:", toTokenDecimalsFromApi);
            }

        } else if (quoteData.quote && quoteData.quote.amountOut) { // Старая проверка на всякий случай
            toAmountFromApi = quoteData.quote.amountOut;
            toTokenDecimalsFromApi = selectedToToken.decimals; // Предполагаем, что это для selectedToToken
            console.warn("Relay API: Using quoteData.quote.amountOut (fallback).");
        } else {
            // Если не нашли ни там, ни там, возможно, нужно искать в последнем шаге `steps`
            // Это более сложная логика, так как структура `steps` может быть разной.
            // Пока оставим так, если `details.currencyOut.amount` - основной путь.
            console.warn("Relay API: Could not determine 'toAmount' from primary paths (details.currencyOut.amount or quote.amountOut). Quote data:", quoteData);
        }


        if (!toAmountFromApi || typeof toTokenDecimalsFromApi !== 'number') {
            console.error("Relay API: Failed to extract 'toAmountFromApi' or its 'decimals'. Cannot update UI.",
                          "toAmountFromApi:", toAmountFromApi, "toTokenDecimalsFromApi:", toTokenDecimalsFromApi);
            if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Ошибка данных'; // Или 'N/A'
            // currentSwapQuote все равно сохраняем, так как шаги для транзакции могут быть валидны
        } else {
            if(ui.elements.swapToAmount) {
                ui.elements.swapToAmount.value = utils.formatTokenAmount(toAmountFromApi, toTokenDecimalsFromApi);
            }
        }

        currentSwapQuote = quoteData;
        if(ui.updateSwapDetails) ui.updateSwapDetails(currentSwapQuote, selectedFromToken, selectedToToken);
        ui.updateSwapStatus(`Готово к свапу.`);
        if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.remove('d-none');
    } catch (error) {
        console.error("Error get swap quote Relay:", error);
        ui.updateSwapStatus(`Ошибка: ${error.message}`);
        if(ui.elements.swapToAmount) ui.elements.swapToAmount.value = 'Ошибка';
        currentSwapQuote = null;
    } finally {
        if(ui.elements.getSwapQuoteBtn) ui.elements.getSwapQuoteBtn.disabled = false;
    }
}

async function handleExecuteSwap() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentWalletChainId = wallet.getChainId();

    if (!account || !signer || !currentSwapQuote || selectedSwapNetworkId === null) {
        ui.updateSwapStatus("Ошибка: Нет котировки/сети или кошелек не подключен."); return;
    }
    if (currentWalletChainId !== selectedSwapNetworkId) {
        const selNetInfo = wallet.getSupportedNetworks().find(n=>n.chainId === selectedSwapNetworkId);
        ui.updateSwapStatus(`Для выполнения свапа в сети "${selNetInfo?.name}" переключите кошелек.`); return;
    }

    ui.updateSwapStatus("Подготовка транзакции свапа...");
    if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.disabled = true;
    let errorOccurred = false;
    const steps = currentSwapQuote.steps;
    let currentStepIndex = 0;

    try {
        // ... (логика approve и swap step как была, используя selectedSwapNetworkId для explorerUrl) ...
        if (steps[currentStepIndex]?.id === 'approve') { /* ... approve logic ... */
            const approvePayload = steps[currentStepIndex].items[0].data;
            // ...
            const approveTx = await signer.sendTransaction({to: ethers.utils.getAddress(approvePayload.to), data: approvePayload.data, value: approvePayload.value ? ethers.BigNumber.from(approvePayload.value) : ethers.constants.Zero});
            ui.showTransactionStatusModal(`Разрешение отправлено...`, approveTx.hash, wallet.getExplorerUrl(selectedSwapNetworkId) + approveTx.hash);
            const approveReceipt = await approveTx.wait();
            if (approveReceipt.status === 0) throw { message: `Approve TX failed.`, transactionHash: approveReceipt.transactionHash, code: 'TX_REVERTED' };
            ui.showTransactionStatusModal("Разрешение подтверждено!", approveReceipt.transactionHash, wallet.getExplorerUrl(selectedSwapNetworkId) + approveReceipt.transactionHash);
            currentStepIndex++;
            await new Promise(r => setTimeout(r, 2500)); ui.hideTransactionStatusModal();
        }
        const swapPayload = steps[currentStepIndex]?.items[0]?.data;
        if(!swapPayload) throw new Error("Swap payload data missing.");
        // ...
        const swapTx = await signer.sendTransaction({to: ethers.utils.getAddress(swapPayload.to), data: swapPayload.data, value: swapPayload.value ? ethers.BigNumber.from(swapPayload.value) : ethers.constants.Zero});
        ui.showTransactionStatusModal(`Свап отправлен...`, swapTx.hash, wallet.getExplorerUrl(selectedSwapNetworkId) + swapTx.hash);
        const swapReceipt = await swapTx.wait();
        if (swapReceipt.status === 0) throw { message: `Swap TX failed.`, transactionHash: swapReceipt.transactionHash, code: 'TX_REVERTED' };
        ui.updateSwapStatus(`Свап успешно выполнен!`);
        ui.showTransactionStatusModal("Свап успешно выполнен!", swapReceipt.transactionHash, wallet.getExplorerUrl(selectedSwapNetworkId) + swapReceipt.transactionHash);

        resetTokensAndQuote();
        await updateSwapUIStatus(); // Обновит статус и балансы
        // await wallet.updateCurrentBalances(); // Это вызовется через updateSwapUIStatus -> updateCurrentBalances() модуля

        setTimeout(() => ui.hideTransactionStatusModal(), 7000);
    } catch (error) {
        errorOccurred = true;
        // ... (обработка ошибок как была) ...
        console.error("Swap execution failed:", error);
        let errMsg = error.message || "Неизвестная ошибка";
        if (error.code === 4001) errMsg = "Транзакция отклонена.";
        ui.updateSwapStatus(`Ошибка: ${errMsg.substring(0,100)}`);
        ui.showTransactionStatusModal(`Ошибка: ${errMsg.substring(0,100)}`, error.transactionHash, error.transactionHash ? wallet.getExplorerUrl(selectedSwapNetworkId) + error.transactionHash : null);
        setTimeout(() => ui.hideTransactionStatusModal(), (error.code === 4001 || error.code === 'TX_REVERTED') ? 5000:8000);
    } finally {
        if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.disabled = false;
        if (errorOccurred && !(error.code === 4001 && currentStepIndex === 0)) {
            currentSwapQuote = null; if(ui.updateSwapDetails) ui.updateSwapDetails(null,null,null); if(ui.elements.executeSwapBtn) ui.elements.executeSwapBtn.classList.add('d-none');
        } else if (!errorOccurred) {
            // Кнопка execute уже скрыта через resetTokensAndQuote -> updateSwapUIStatus
        }
    }
}

async function resetState() { // Вызывается извне (app.js, wallet.js)
    console.log("swap.js: resetState called");
    // При полном сбросе состояния вкладки (например, при смене сети кошелька или отключении),
    // мы должны переинициализировать селектор сети, чтобы он отражал актуальное состояние кошелька.
    // selectedSwapNetworkId будет обновлен внутри initializeSwapNetworkSelector.
    await initializeSwapNetworkSelector(); // Это также вызовет resetTokensAndQuote и updateSwapUIStatus
}

window.swap = {
    initializeSwapNetworkSelector,
    handleSwapNetworkChange,
    handleTokenSelectClick,
    handleGetSwapQuote,
    handleExecuteSwap,
    updateCurrentBalances, // Эта функция вызывается из wallet.js для обновления баланса FROM токена
    resetState,
    selectedSwapNetworkId: () => selectedSwapNetworkId,
    selectedFromToken: () => selectedFromToken,
    selectedToToken: () => selectedToToken,
    currentSwapQuote: () => currentSwapQuote,
};