// js/bridge.js

let selectedFromChainId = null;
let selectedToChainId = null;
let selectedFromTokenBridge = null;
let selectedToTokenBridge = null;
let currentBridgeQuote = null;

// TODO: АДРЕС КОНТРАКТА АГРЕГАТОРА/МОСТА НА КАЖДОЙ СЕТИ ДЛЯ APPROVE
// Получите их из документации агрегатора/моста
const BRIDGE_SPENDER_ADDRESSES = {
    1: "0x...Ethereum_Bridge_Spender_Address...", // Ethereum Mainnet
    5: "0x...Goerli_Bridge_Spender_Address...",   // Goerli Testnet
    11155111: "0x...Sepolia_Bridge_Spender_Address...", // Sepolia Testnet
    137: "0x...Polygon_Bridge_Spender_Address...", // Polygon Mainnet
    80001: "0x...Mumbai_Bridge_Spender_Address...", // Polygon Mumbai Testnet
    // Добавьте адреса для других сетей
};


function populateNetworkSelects() {
    const supportedNetworks = wallet.getSupportedNetworks();
    const currentChainId = wallet.getChainId();

     // Фильтруем сети для выбора, чтобы показывать только поддерживаемые
     const selectableNetworks = supportedNetworks.filter(net => true); // Пока все поддерживаемые, можно добавить логику фильтрации

    if (!currentChainId) {
         ui.populateNetworkSelect('bridge-from-network', selectableNetworks, null);
         ui.populateNetworkSelect('bridge-to-network', selectableNetworks, null);
         selectedFromChainId = null;
         selectedToChainId = null;
         return;
    }

    ui.populateNetworkSelect('bridge-from-network', selectableNetworks, currentChainId);
    const defaultToChainId = selectableNetworks.find(net => net.chainId !== currentChainId)?.chainId || null;
    ui.populateNetworkSelect('bridge-to-network', selectableNetworks, defaultToChainId);

    selectedFromChainId = currentChainId;
    selectedToChainId = defaultToChainId;

     console.log(`Populated bridge networks. Default From: ${selectedFromChainId}, Default To: ${selectedToChainId}`);

     selectedFromTokenBridge = null;
     selectedToTokenBridge = null;
     ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
     ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';
     ui.updateBridgeDetails(null);
     ui.updateBridgeStatus("Выберите сети и токены, затем нажмите 'Найти лучший путь'.");
     ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
     ui.elements.approveBridgeBtn.classList.add('d-none');
     ui.elements.executeBridgeBtn.classList.add('d-none');
     currentBridgeQuote = null;
}

function handleNetworkChange(type, selectElement) {
    const newChainId = parseInt(selectElement.value, 10);

    if (type === 'from') {
        selectedFromChainId = newChainId;
        selectedFromTokenBridge = null;
        ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
        updateCurrentBalances();

    } else { // type === 'to'
        selectedToChainId = newChainId;
        selectedToTokenBridge = null;
        ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';
    }

    currentBridgeQuote = null;
    ui.updateBridgeDetails(null);
    ui.elements.approveBridgeBtn.classList.add('d-none');
    ui.elements.executeBridgeBtn.classList.add('d-none');
    ui.updateBridgeStatus("Выберите сети и токены, затем нажмите 'Найти лучший путь'.");

    console.log(`Bridge networks updated: From ${selectedFromChainId} to ${selectedToChainId}`);
}


async function handleTokenSelectClickBridge(type) {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId();
    const targetChainId = (type === 'from') ? selectedFromChainId : selectedToChainId;

    if (!account || !currentChainId) {
        ui.updateBridgeStatus("Подключите кошелек.");
        return;
    }
    if (!selectedFromChainId || !selectedToChainId) {
        ui.updateBridgeStatus("Сначала выберите сети для моста.");
        return;
    }
     if (selectedFromChainId === selectedToChainId) {
          ui.updateBridgeStatus("Выберите разные сети для моста.");
          return;
     }

     if (type === 'from' && selectedFromChainId !== currentChainId) {
         ui.updateBridgeStatus(`Чтобы выбрать токен для отправки, переключите кошелек на сеть "${wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId)?.name || selectedFromChainId}".`);
         return;
     }

    ui.updateBridgeStatus(`Загрузка списка токенов для сети ID ${targetChainId}...`);
    try {
        const tokenList = await utils.getTokenList(targetChainId);

         if (tokenList.length === 0) {
            ui.updateBridgeStatus(`Не удалось загрузить список токенов для сети ID ${targetChainId}.`);
            return;
        }

        ui.updateBridgeStatus("");

        ui.showTokenPickerModal(tokenList, targetChainId);

         ui.elements.tokenListUl.onclick = async (event) => {
            const target = event.target.closest('li');
            if (target) {
                 const tokenChainId = parseInt(target.dataset.chainId, 10);

                const token = {
                    address: target.dataset.address,
                    symbol: target.dataset.symbol,
                    decimals: parseInt(target.dataset.decimals, 10),
                    chainId: tokenChainId,
                    logo_uri: target.querySelector('img')?.src
                };

                 if (token.chainId !== targetChainId) {
                      console.error("Mismatch between selected token chain and target chain for modal.");
                      ui.hideTokenPickerModal();
                      ui.updateBridgeStatus(`Ошибка: Выбранный токен "${token.symbol}" находится на другой сети (ID ${token.chainId}).`);
                      return;
                 }

                if (type === 'from') {
                     if (token.chainId !== selectedFromChainId) {
                          ui.hideTokenPickerModal();
                          ui.updateBridgeStatus(`Ошибка: Токен отправки "${token.symbol}" должен быть на исходной сети моста (${wallet.getSupportedNetworks().find(n=>n.chainId === selectedFromChainId)?.name || selectedFromChainId}).`);
                          return;
                     }
                    selectedFromTokenBridge = token;
                    ui.elements.bridgeFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`;
                     if (selectedFromChainId === currentChainId) {
                          updateCurrentBalances();
                     } else {
                         ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
                     }

                } else { // type === 'to'
                     if (token.chainId !== selectedToChainId) {
                         ui.hideTokenPickerModal();
                         ui.updateBridgeStatus(`Ошибка: Токен получения "${token.symbol}" должен быть на целевой сети моста (${wallet.getSupportedNetworks().find(n=>n.chainId === selectedToChainId)?.name || selectedToChainId}).`);
                         return;
                     }
                    selectedToTokenBridge = token;
                    ui.elements.bridgeToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`;
                }

                ui.hideTokenPickerModal();
                currentBridgeQuote = null;
                ui.updateBridgeDetails(null);
                ui.elements.approveBridgeBtn.classList.add('d-none');
                ui.elements.executeBridgeBtn.classList.add('d-none');
                ui.updateBridgeStatus("Выберите сети и токены, затем нажмите 'Найти лучший путь'.");

                console.log(`Selected bridge token: ${type} - ${token.symbol} on chain ${token.chainId}`);
            }
        };

    } catch (error) {
        console.error("Error handling bridge token select click:", error);
        ui.updateBridgeStatus(`Ошибка: ${error.message}`);
        ui.hideTokenPickerModal();
    }
}

async function updateCurrentBalances() {
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
    const chainId = wallet.getChainId();

    if (!account || !provider || !chainId) {
         ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
        return;
    }

    if (selectedFromTokenBridge && selectedFromTokenBridge.chainId === chainId) {
         ui.updateTokenBalanceDisplay('bridge-from-balance', 'Загрузка...', selectedFromTokenBridge.decimals);
        const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
        ui.updateTokenBalanceDisplay('bridge-from-balance', balance, selectedFromTokenBridge.decimals);
    } else {
         ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    }
}

async function handleGetBridgeQuote() {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId();
    const amountString = ui.elements.bridgeFromAmount.value;

    if (!account || !currentChainId) {
        ui.updateBridgeStatus("Подключите кошелек.");
        return;
    }
    if (!selectedFromChainId || !selectedToChainId || !selectedFromTokenBridge || !selectedToTokenBridge) {
        ui.updateBridgeStatus("Выберите сети и токены для моста.");
        return;
    }
    if (selectedFromChainId === selectedToChainId) {
         ui.updateBridgeStatus("Выберите разные сети для моста.");
         return;
     }
     if (selectedFromTokenBridge.chainId !== selectedFromChainId) {
          ui.updateBridgeStatus(`Ошибка: Выбранный токен отправки "${selectedFromTokenBridge.symbol}" не на исходной сети моста.`);
          return;
     }
      if (selectedToTokenBridge.chainId !== selectedToChainId) {
           ui.updateBridgeStatus(`Ошибка: Выбранный токен получения "${selectedToTokenBridge.symbol}" не на целевой сети моста.`);
          return;
     }
     if (currentChainId !== selectedFromChainId) {
         ui.updateBridgeStatus(`Переключите кошелек на сеть "${wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId)?.name || selectedFromChainId}", чтобы найти путь и отправить средства.`);
         return;
     }

     if (parseFloat(amountString) <= 0 || amountString === '') {
         ui.updateBridgeStatus("Введите сумму больше нуля.");
         ui.elements.bridgeToAmount.value = '';
         ui.updateBridgeDetails(null);
         ui.elements.approveBridgeBtn.classList.add('d-none');
         ui.elements.executeBridgeBtn.classList.add('d-none');
         return;
     }

     let amountBigNumber;
     try {
         amountBigNumber = utils.parseTokenAmount(amountString, selectedFromTokenBridge.decimals);
     } catch (e) {
         ui.updateBridgeStatus(e.message);
         ui.elements.bridgeToAmount.value = '';
         ui.updateBridgeDetails(null);
         ui.elements.approveBridgeBtn.classList.add('d-none');
         ui.elements.executeBridgeBtn.classList.add('d-none');
         return;
     }

      const provider = wallet.getProvider();
      const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
      if (amountBigNumber.gt(balance)) {
           ui.updateBridgeStatus(`Недостаточно средств. Ваш баланс ${utils.formatTokenAmount(balance, selectedFromTokenBridge.decimals)} ${selectedFromTokenBridge.symbol}.`);
           ui.elements.bridgeToAmount.value = '';
           ui.updateBridgeDetails(null);
           ui.elements.approveBridgeBtn.classList.add('d-none');
           ui.elements.executeBridgeBtn.classList.add('d-none');
          return;
      }


    ui.updateBridgeStatus("Поиск лучшего пути через мост...");
    ui.elements.approveBridgeBtn.classList.add('d-none');
    ui.elements.executeBridgeBtn.classList.add('d-none');
    ui.elements.getBridgeQuoteBtn.disabled = true;
    ui.elements.bridgeToAmount.value = 'Поиск...';
    ui.updateBridgeDetails(null);

    try {
        // TODO: ИНТЕГРАЦИЯ С АГРЕГАТОРОМ МОСТОВ
        // Пример с Li.Finance SDK:
        // const routeResult = await LiFi.getRoute({
        //     fromChainId: selectedFromChainId,
        //     toChainId: selectedToChainId,
        //     fromTokenAddress: selectedFromTokenBridge.address === 'NATIVE' ? '0x0' : selectedFromTokenBridge.address,
        //     toTokenAddress: selectedToTokenBridge.address === 'NATIVE' ? '0x0' : selectedToTokenBridge.address,
        //     fromAmount: amountBigNumber.toString(),
        //     fromAddress: account
        // });
        // currentBridgeQuote = routeResult.route; // Сохраняем route объект

         // --- ЗАГЛУШКА ---
         await new Promise(resolve => setTimeout(resolve, 2000));
         const mockToAmount = amountBigNumber.mul(97).div(100);
         currentBridgeQuote = {
             fromChain: wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId),
             toChain: wallet.getSupportedNetworks().find(n => n.chainId === selectedToChainId),
             fromToken: selectedFromTokenBridge,
             toToken: selectedToTokenBridge,
             fromAmount: amountBigNumber,
             toAmount: mockToAmount,
             protocol: 'Тестовый AnyBridge',
             estimatedTime: '5-20 минут',
             gasCost: { amount: ethers.utils.parseUnits('0.01', 18), decimals: 18, token: {symbol: 'ETH/MATIC', name: 'Native'} },
             steps: [ /* ... */ ]
             // В реальной котировке будет transactionRequest или другие детали для выполнения
         };
        // --- КОНЕЦ ЗАГЛУШКИ ---


        ui.updateBridgeDetails(currentBridgeQuote);
        ui.elements.bridgeToAmount.value = utils.formatTokenAmount(currentBridgeQuote.toAmount, selectedToTokenBridge.decimals);

        const spenderAddress = BRIDGE_SPENDER_ADDRESSES[selectedFromChainId];
        if (!spenderAddress) {
             ui.updateBridgeStatus(`Ошибка: Неизвестный адрес контракта агрегатора/моста для исходной сети ID ${selectedFromChainId}.`);
             return;
        }

        if (selectedFromTokenBridge.address.toLowerCase() !== 'native') {
            const allowance = await utils.getTokenAllowance(selectedFromTokenBridge.address, account, spenderAddress, provider);

            if (allowance.lt(amountBigNumber)) {
                ui.updateBridgeStatus(`Требуется разрешение на трату ${selectedFromTokenBridge.symbol} на сети ${currentBridgeQuote.fromChain.name}.`);
                ui.elements.approveBridgeBtn.classList.remove('d-none');
                ui.elements.executeBridgeBtn.classList.add('d-none');
            } else {
                ui.updateBridgeStatus(`Готово к выполнению моста.`);
                ui.elements.approveBridgeBtn.classList.add('d-none');
                ui.elements.executeBridgeBtn.classList.remove('d-none');
            }
        } else {
            ui.updateBridgeStatus(`Готово к выполнению моста.`);
            ui.elements.approveBridgeBtn.classList.add('d-none');
            ui.elements.executeBridgeBtn.classList.add('d-none');
        }

    } catch (error) {
        console.error("Error getting bridge quote:", error);
        let errorMessage = "Ошибка при поиске пути моста.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateBridgeStatus(errorMessage);
        ui.elements.bridgeToAmount.value = 'Ошибка';
        ui.updateBridgeDetails(null);
        ui.elements.approveBridgeBtn.classList.add('d-none');
        ui.elements.executeBridgeBtn.classList.add('d-none');
        currentBridgeQuote = null;
    } finally {
        ui.elements.getBridgeQuoteBtn.disabled = false;
    }
}

async function handleApproveBridge() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentChainId = wallet.getChainId();
    const amountString = ui.elements.bridgeFromAmount.value;

    if (!account || !signer || !currentChainId || !selectedFromTokenBridge || !selectedFromChainId) {
        ui.updateBridgeStatus("Ошибка: Не удалось выполнить апрув (нет кошелька, токена или сети).");
        return;
    }

    if (currentChainId !== selectedFromChainId) {
        ui.updateBridgeStatus(`Переключите кошелек на сеть "${wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId)?.name || selectedFromChainId}", чтобы выполнить апрув.`);
        return;
    }

    if (selectedFromTokenBridge.address.toLowerCase() === 'native') {
         ui.updateBridgeStatus("Нативная валюта не требует апрува.");
         ui.elements.approveBridgeBtn.classList.add('d-none');
         ui.elements.executeBridgeBtn.classList.remove('d-none');
         return;
     }

    const spenderAddress = BRIDGE_SPENDER_ADDRESSES[currentChainId];
    if (!spenderAddress) {
         ui.updateBridgeStatus(`Ошибка: Неизвестный адрес контракта агрегатора/моста для текущей сети ${currentChainId}.`);
         return;
    }

    let amountBigNumber;
    try {
         amountBigNumber = ethers.constants.MaxUint256;
    } catch (e) {
        ui.updateBridgeStatus("Некорректная сумма для апрува.");
        return;
    }

    ui.updateBridgeStatus(`Запрос разрешения на ${selectedFromTokenBridge.symbol} на сети ${wallet.getSupportedNetworks().find(n => n.chainId === currentChainId)?.name || currentChainId}...`);
    ui.elements.approveBridgeBtn.disabled = true;

    try {
        const receipt = await utils.approveToken(selectedFromTokenBridge.address, spenderAddress, amountBigNumber, signer);

        await new Promise(resolve => setTimeout(resolve, 3000));
        const newAllowance = await utils.getTokenAllowance(selectedFromTokenBridge.address, account, spenderAddress, wallet.getProvider());

        const currentInputAmount = ui.elements.bridgeFromAmount.value;
         const inputAmountBigNumber = utils.parseTokenAmount(currentInputAmount, selectedFromTokenBridge.decimals);

        if (newAllowance.gte(inputAmountBigNumber)) {
            ui.updateBridgeStatus("Разрешение получено. Готово к выполнению моста.");
            ui.elements.approveBridgeBtn.classList.add('d-none');
            ui.elements.executeBridgeBtn.classList.remove('d-none');
        } else {
            ui.updateBridgeStatus("Разрешение получено, но недостаточно для этой суммы. Пожалуйста, получите новый путь и проверьте.");
            ui.elements.approveBridgeBtn.classList.remove('d-none');
            ui.elements.executeBridgeBtn.classList.add('d-none');
        }

    } catch (error) {
        console.error("Bridge Approval failed:", error);
        ui.elements.approveBridgeBtn.classList.remove('d-none');
        ui.elements.executeBridgeBtn.classList.add('d-none');
    } finally {
        ui.elements.approveBridgeBtn.disabled = false;
    }
}

async function handleExecuteBridge() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentChainId = wallet.getChainId();

    if (!account || !signer || !currentChainId || !currentBridgeQuote) {
        ui.updateBridgeStatus("Ошибка: Котировка моста не получена или кошелек не подключен.");
        return;
    }

    if (currentChainId !== currentBridgeQuote.fromChain.chainId) {
        ui.updateBridgeStatus(`Переключите кошелек на сеть "${currentBridgeQuote.fromChain.name}", чтобы выполнить мост.`);
        return;
    }

    if (currentBridgeQuote.fromChain.chainId !== selectedFromChainId ||
        currentBridgeQuote.toChain.chainId !== selectedToChainId ||
        currentBridgeQuote.fromToken.address.toLowerCase() !== selectedFromTokenBridge?.address.toLowerCase() ||
        currentBridgeQuote.toToken.address.toLowerCase() !== selectedToTokenBridge?.address.toLowerCase()
    ) {
        ui.updateBridgeStatus("Ошибка: Котировка моста устарела или не соответствует выбору. Получите новую.");
        ui.elements.approveBridgeBtn.classList.add('d-none');
        ui.elements.executeBridgeBtn.classList.add('d-none');
        currentBridgeQuote = null;
        ui.updateBridgeDetails(null);
        return;
    }
    const currentInputAmount = ui.elements.bridgeFromAmount.value;
    try {
        const inputAmountBigNumber = utils.parseTokenAmount(currentInputAmount, selectedFromTokenBridge.decimals);
        if (!inputAmountBigNumber.eq(currentBridgeQuote.fromAmount)) {
            ui.updateBridgeStatus("Сумма изменена. Пожалуйста, найдите новый путь.");
            ui.updateBridgeDetails(null);
            ui.elements.approveBridgeBtn.classList.add('d-none');
            ui.elements.executeBridgeBtn.classList.add('d-none');
            currentBridgeQuote = null;
            return;
        }
    } catch (e) {
        ui.updateBridgeStatus("Некорректная сумма в поле ввода.");
        ui.updateBridgeDetails(null);
        ui.elements.approveBridgeBtn.classList.add('d-none');
        ui.elements.executeBridgeBtn.classList.add('d-none');
        currentBridgeQuote = null;
        return;
    }


    ui.updateBridgeStatus(`Отправка транзакции моста на сети ${currentBridgeQuote.fromChain.name}...`);
    ui.elements.executeBridgeBtn.disabled = true;
    ui.elements.approveBridgeBtn.disabled = true;

    try {
        // TODO: ВЫПОЛНЕНИЕ МОСТА ЧЕРЕЗ АГРЕГАТОР
        // Пример с Li.Finance SDK:
        // const result = await LiFi.executeRoute(signer, currentBridgeQuote);
        // const txHash = result.transactionHash;

         // --- ЗАГЛУШКА ---
         ui.updateBridgeStatus(`Запрос подписи транзакции в кошельке...`);
         const fakeTxHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
         console.log("Имитация отправки транзакции моста, хэш:", fakeTxHash);
         const tx = { hash: fakeTxHash, wait: () => new Promise(res => setTimeout(() => res({ transactionHash: fakeTxHash, status: 1 }), 10000)) }; // Имитация tx object
        // --- КОНЕЦ ЗАГЛУШКИ ---

        const txHash = tx.hash;
        ui.updateBridgeStatus(`Транзакция моста отправлена на сети ${currentBridgeQuote.fromChain.name}! Ожидание обработки... Хэш: ${utils.formatAddress(txHash)}`);
        const explorerUrl = wallet.getExplorerUrl(currentBridgeQuote.fromChain.chainId);
        ui.showTransactionStatusModal(`Транзакция отправлена на ${currentBridgeQuote.fromChain.name}, ожидание моста...`, txHash, explorerUrl ? explorerUrl + txHash : null);

        // Ждем подтверждения транзакции на исходной сети
        console.log("Waiting for initial transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Initial bridge transaction confirmed:", receipt);


        // TODO: ОТСЛЕЖИВАНИЕ СТАТУСА МОСТА
        // Используйте SDK агрегатора (например, LiFi.waitForRouteCompletion) или опрос бэкенда
         ui.updateBridgeStatus(`Транзакция подтверждена на ${currentBridgeQuote.fromChain.name}. Ожидание моста...`);
         ui.showTransactionStatusModal(`Транзакция подтверждена на ${currentBridgeQuote.fromChain.name}. Мост в процессе...`, receipt.transactionHash, wallet.getExplorerUrl(currentBridgeQuote.fromChain.chainId) + receipt.transactionHash);

         console.log(`Имитация ожидания завершения моста через ${currentBridgeQuote.estimatedTime}...`);
         setTimeout(async () => {
             ui.updateBridgeStatus(`Мост на сеть ${currentBridgeQuote.toChain.name} успешно выполнен!`);
             const targetTxHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '1');
             const targetExplorerUrl = wallet.getExplorerUrl(currentBridgeQuote.toChain.chainId);
             ui.showTransactionStatusModal(`Мост завершен на ${currentBridgeQuote.toChain.name}!`, targetTxHash, targetExplorerUrl ? targetExplorerUrl + targetTxHash : null);

              // TODO: ОПЦИОНАЛЬНО: Отправить информацию о завершении моста на бэкенд для Telegram уведомления

              await updateCurrentBalances(); // Обновить баланс на исходной сети

              ui.elements.bridgeFromAmount.value = '';
              ui.elements.bridgeToAmount.value = '';
              ui.updateBridgeDetails(null);
              ui.elements.approveBridgeBtn.classList.add('d-none');
              ui.elements.executeBridgeBtn.classList.add('d-none');
              currentBridgeQuote = null;

         }, 30000);


    } catch (error) {
        console.error("Bridge execution failed:", error);
         let errorMessage = "Неизвестная ошибка выполнения моста.";
         let txHashForModal = null;
         if (error.code === 4001) {
             errorMessage = "Транзакция отклонена пользователем.";
         } else if (error.transactionHash) {
              errorMessage = `Транзакция на ${currentBridgeQuote.fromChain.name} не удалась: ${error.message || 'Проверьте в эксплорере'}`;
              txHashForModal = error.transactionHash;
         } else if (error.message) {
             errorMessage = `Ошибка: ${error.message.substring(0, 100)}...`;
         }
         const currentChainId = wallet.getChainId();
         const explorerUrl = currentChainId ? wallet.getExplorerUrl(currentChainId) : null; // Ссылка на эксплорер текущей сети кошелька

        ui.updateBridgeStatus(errorMessage);
        ui.showTransactionStatusModal(errorMessage, txHashForModal, txHashForModal && explorerUrl ? explorerUrl + txHashForModal : null);

         if (error.code === 4001) {
              setTimeout(() => ui.hideTransactionStatusModal(), 5000);
         }

    } finally {
        ui.elements.executeBridgeBtn.disabled = false;
        ui.elements.approveBridgeBtn.disabled = false;
    }
}

function resetState() {
    selectedFromChainId = null;
    selectedToChainId = null;
    selectedFromTokenBridge = null;
    selectedToTokenBridge = null;
    currentBridgeQuote = null;
    ui.elements.bridgeFromAmount.value = '';
    ui.elements.bridgeToAmount.value = '';
    ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
    ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';

    ui.updateBridgeDetails(null);
    ui.updateBridgeStatus("");
    ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    ui.elements.approveBridgeBtn.classList.add('d-none');
    ui.elements.executeBridgeBtn.classList.add('d-none');

    populateNetworkSelects(); // Перезаполнить дропдауны, что также сбросит выбранные сети в state и UI

    updateCurrentBalances();
}

// Экспорт функций
window.bridge = {
    populateNetworkSelects,
    handleNetworkChange,
    handleTokenSelectClickBridge,
    handleGetBridgeQuote,
    handleApproveBridge,
    handleExecuteBridge,
    updateCurrentBalances,
    resetState,

    selectedFromChainId: () => selectedFromChainId,
    selectedToChainId: () => selectedToChainId,
    selectedFromTokenBridge: () => selectedFromTokenBridge,
    selectedToTokenBridge: () => selectedToTokenBridge,
    currentBridgeQuote: () => currentBridgeQuote,
};