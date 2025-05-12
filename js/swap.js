// js/swap.js

let selectedFromToken = null;
let selectedToToken = null;
let currentSwapQuote = null;

// TODO: АДРЕС КОНТРАКТА АГРЕГАТОРА СВАПОВ НА КАЖДОЙ СЕТИ
// Получите их из документации агрегатора (например, Li.Finance, 1inch V5 Router)
// Используйте checksummed адреса для надежности
const SWAP_SPENDER_ADDRESSES = {
    1: "0x...Ethereum_Spender_Address...", // Ethereum Mainnet
    5: "0x...Goerli_Spender_Address...",   // Goerli Testnet
    11155111: "0x...Sepolia_Spender_Address...", // Sepolia Testnet
    137: "0x...Polygon_Spender_Address...", // Polygon Mainnet
    80001: "0x...Mumbai_Spender_Address...", // Polygon Mumbai Testnet
    // Добавьте адреса для других сетей
};


async function handleTokenSelectClick(type) {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId();

    if (!account || !currentChainId) {
        ui.updateSwapStatus("Подключите кошелек, чтобы выбрать токены.");
        return;
    }

     const networkConfig = wallet.getSupportedNetworks().find(net => net.chainId === currentChainId);
     if (!networkConfig) {
          ui.updateSwapStatus(`Текущая сеть (ID ${currentChainId}) не поддерживается для свапов.`);
          return;
     }


    ui.updateSwapStatus("Загрузка списка токенов...");
    try {
        const tokenList = await utils.getTokenList(currentChainId);

        if (tokenList.length === 0) {
            ui.updateSwapStatus(`Не удалось загрузить список токенов для сети ${networkConfig.name}.`);
            return;
        }

        ui.updateSwapStatus("");

        ui.showTokenPickerModal(tokenList, currentChainId);

        ui.elements.tokenListUl.onclick = async (event) => {
            const target = event.target.closest('li');
            if (target) {
                const token = {
                    address: target.dataset.address,
                    symbol: target.dataset.symbol,
                    decimals: parseInt(target.dataset.decimals, 10),
                    chainId: parseInt(target.dataset.chainId, 10),
                    logo_uri: target.querySelector('img')?.src
                };

                 if (token.chainId !== currentChainId) {
                     console.error("Mismatch between selected token chain and current wallet chain.");
                     ui.hideTokenPickerModal();
                     ui.updateSwapStatus(`Ошибка: Выбранный токен "${token.symbol}" находится на другой сети (ID ${token.chainId}). Переключите кошелек или выберите другой токен.`);
                     return;
                 }

                if (type === 'from') {
                    selectedFromToken = token;
                    ui.elements.swapFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`;
                     updateCurrentBalances();
                } else {
                    selectedToToken = token;
                    ui.elements.swapToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`;
                }

                ui.hideTokenPickerModal();
                currentSwapQuote = null;
                ui.updateSwapDetails(null);
                ui.elements.approveSwapBtn.classList.add('d-none');
                ui.elements.executeSwapBtn.classList.add('d-none');
                 ui.updateSwapStatus("Выберите токены и сумму, затем нажмите 'Получить курс'.");
            }
        };

    } catch (error) {
        console.error("Error handling swap token select click:", error);
        ui.updateSwapStatus(`Ошибка: ${error.message}`);
        ui.hideTokenPickerModal();
    }
}

async function updateCurrentBalances() {
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
    const chainId = wallet.getChainId();

    if (!account || !provider || !chainId) {
         ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
        return;
    }

    if (selectedFromToken && selectedFromToken.chainId === chainId) {
        ui.updateTokenBalanceDisplay('swap-from-balance', 'Загрузка...', selectedFromToken.decimals);
        const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
        ui.updateTokenBalanceDisplay('swap-from-balance', balance, selectedFromToken.decimals);
    } else {
         ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    }
}

async function handleGetSwapQuote() {
    const account = wallet.getAccount();
    const chainId = wallet.getChainId();
    const provider = wallet.getProvider();
    const amountString = ui.elements.swapFromAmount.value;

    if (!account || !chainId || !provider) {
        ui.updateSwapStatus("Подключите кошелек.");
        return;
    }
    if (!selectedFromToken || !selectedToToken) {
        ui.updateSwapStatus("Выберите токены для свапа.");
        return;
    }
    if (selectedFromToken.chainId !== chainId || selectedToToken.chainId !== chainId) {
         ui.updateSwapStatus(`Выбранные токены не соответствуют текущей сети "${wallet.getSupportedNetworks().find(n=>n.chainId === chainId)?.name || chainId}".`);
         return;
     }

     if (parseFloat(amountString) <= 0 || amountString === '') {
         ui.updateSwapStatus("Введите сумму больше нуля.");
         ui.elements.swapToAmount.value = '';
         ui.updateSwapDetails(null);
         ui.elements.approveSwapBtn.classList.add('d-none');
         ui.elements.executeSwapBtn.classList.add('d-none');
         return;
     }

     let amountBigNumber;
     try {
         amountBigNumber = utils.parseTokenAmount(amountString, selectedFromToken.decimals);
     } catch (e) {
         ui.updateSwapStatus(e.message);
         ui.elements.swapToAmount.value = '';
         ui.updateSwapDetails(null);
         ui.elements.approveSwapBtn.classList.add('d-none');
         ui.elements.executeSwapBtn.classList.add('d-none');
         return;
     }

     const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
     if (amountBigNumber.gt(balance)) {
          ui.updateSwapStatus(`Недостаточно средств. Ваш баланс ${utils.formatTokenAmount(balance, selectedFromToken.decimals)} ${selectedFromToken.symbol}.`);
          ui.elements.swapToAmount.value = '';
          ui.updateSwapDetails(null);
          ui.elements.approveSwapBtn.classList.add('d-none');
          ui.elements.executeSwapBtn.classList.add('d-none');
         return;
     }

    ui.updateSwapStatus("Получение котировки свапа...");
    ui.elements.approveSwapBtn.classList.add('d-none');
    ui.elements.executeSwapBtn.classList.add('d-none');
    ui.elements.getSwapQuoteBtn.disabled = true;
    ui.elements.swapToAmount.value = 'Загрузка...';
    ui.updateSwapDetails(null);

    try {
        // TODO: ИНТЕГРАЦИЯ С АГРЕГАТОРОМ СВАПОВ
        // Пример с Li.Finance SDK:
        // const routeResult = await LiFi.getRoute({
        //      fromChainId: chainId,
        //      toChainId: chainId,
        //      fromTokenAddress: selectedFromToken.address === 'NATIVE' ? '0x0' : selectedFromToken.address,
        //      toTokenAddress: selectedToToken.address === 'NATIVE' ? '0x0' : selectedToToken.address,
        //      fromAmount: amountBigNumber.toString(),
        //      fromAddress: account
        // });
        // currentSwapQuote = routeResult.route; // Сохраняем route объект

        // --- ЗАГЛУШКА ---
         await new Promise(resolve => setTimeout(resolve, 1500));
         const mockToAmount = amountBigNumber.mul(98).div(100);
         currentSwapQuote = {
             fromToken: selectedFromToken,
             toToken: selectedToToken,
             fromAmount: amountBigNumber,
             toAmount: mockToAmount,
             protocol: 'Тестовый Uniswap V3',
             gasCost: { amount: ethers.utils.parseUnits('0.005', 18), decimals: 18, token: {symbol: 'ETH', name: 'Ethereum'} },
             // В реальной котировке будет transactionRequest или другие детали для выполнения
         };
        // --- КОНЕЦ ЗАГЛУШКИ ---

        ui.updateSwapDetails(currentSwapQuote);
        ui.elements.swapToAmount.value = utils.formatTokenAmount(currentSwapQuote.toAmount, selectedToToken.decimals);

        if (selectedFromToken.address.toLowerCase() !== 'native') {
            const spenderAddress = SWAP_SPENDER_ADDRESSES[chainId];
            if (!spenderAddress) {
                 ui.updateSwapStatus(`Ошибка: Неизвестный адрес контракта агрегатора для текущей сети.`);
                 return;
            }
            const allowance = await utils.getTokenAllowance(selectedFromToken.address, account, spenderAddress, provider);

            if (allowance.lt(amountBigNumber)) {
                ui.updateSwapStatus(`Требуется разрешение на трату ${selectedFromToken.symbol}.`);
                ui.elements.approveSwapBtn.classList.remove('d-none');
                ui.elements.executeSwapBtn.classList.add('d-none');
            } else {
                ui.updateSwapStatus(`Готово к свапу.`);
                ui.elements.approveSwapBtn.classList.add('d-none');
                ui.elements.executeSwapBtn.classList.remove('d-none');
            }
        } else {
            ui.updateSwapStatus(`Готово к свапу.`);
            ui.elements.approveSwapBtn.classList.add('d-none');
            ui.elements.executeSwapBtn.classList.remove('d-none');
        }

    } catch (error) {
        console.error("Error getting swap quote:", error);
         let errorMessage = "Ошибка при получении курса.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateSwapStatus(errorMessage);
        ui.elements.swapToAmount.value = 'Ошибка';
        ui.updateSwapDetails(null);
        ui.elements.approveSwapBtn.classList.add('d-none');
        ui.elements.executeSwapBtn.classList.add('d-none');
        currentSwapQuote = null;
    } finally {
        ui.elements.getSwapQuoteBtn.disabled = false;
    }
}

async function handleApproveSwap() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const chainId = wallet.getChainId();
    const amountString = ui.elements.swapFromAmount.value;

    if (!account || !signer || !chainId || !selectedFromToken) {
        ui.updateSwapStatus("Ошибка: Не удалось выполнить апрув (нет кошелька или токена).");
        return;
    }

    if (selectedFromToken.address.toLowerCase() === 'native') {
         ui.updateSwapStatus("Нативная валюта не требует апрува.");
         ui.elements.approveSwapBtn.classList.add('d-none');
         ui.elements.executeSwapBtn.classList.remove('d-none');
         return;
     }

    const spenderAddress = SWAP_SPENDER_ADDRESSES[chainId];
     if (!spenderAddress) {
          ui.updateSwapStatus(`Ошибка: Неизвестный адрес контракта агрегатора для текущей сети ID ${chainId}.`);
          return;
     }

     let amountBigNumber;
     try {
          amountBigNumber = ethers.constants.MaxUint256;
     } catch (e) {
         ui.updateSwapStatus("Некорректная сумма для апрува.");
         return;
     }

    ui.updateSwapStatus(`Запрос разрешения на ${selectedFromToken.symbol}...`);
    ui.elements.approveSwapBtn.disabled = true;

    try {
        const receipt = await utils.approveToken(selectedFromToken.address, spenderAddress, amountBigNumber, signer);

        await new Promise(resolve => setTimeout(resolve, 3000));
        const newAllowance = await utils.getTokenAllowance(selectedFromToken.address, account, spenderAddress, wallet.getProvider());

        const currentInputAmount = ui.elements.swapFromAmount.value;
        const inputAmountBigNumber = utils.parseTokenAmount(currentInputAmount, selectedFromToken.decimals);


        if (newAllowance.gte(inputAmountBigNumber)) {
            ui.updateSwapStatus("Разрешение получено. Готово к свапу.");
            ui.elements.approveSwapBtn.classList.add('d-none');
            ui.elements.executeSwapBtn.classList.remove('d-none');
        } else {
            ui.updateSwapStatus("Разрешение получено, но недостаточно для этой суммы. Пожалуйста, получите новый курс и проверьте.");
            ui.elements.approveSwapBtn.classList.remove('d-none');
            ui.elements.executeSwapBtn.classList.add('d-none');
        }

    } catch (error) {
        console.error("Approval failed:", error);
        ui.elements.approveSwapBtn.classList.remove('d-none');
        ui.elements.executeSwapBtn.classList.add('d-none');
    } finally {
        ui.elements.approveSwapBtn.disabled = false;
    }
}

async function handleExecuteSwap() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const chainId = wallet.getChainId();

    if (!account || !signer || !chainId || !currentSwapQuote) {
        ui.updateSwapStatus("Ошибка: Котировка свапа не получена или кошелек не подключен.");
        return;
    }

    if (currentSwapQuote.fromToken.chainId !== chainId || currentSwapQuote.toToken.chainId !== chainId) {
         ui.updateSwapStatus("Ошибка: Котировка получена для другой сети.");
         return;
     }

     const currentInputAmount = ui.elements.swapFromAmount.value;
      try {
          const inputAmountBigNumber = utils.parseTokenAmount(currentInputAmount, selectedFromToken.decimals);
          if (!inputAmountBigNumber.eq(currentSwapQuote.fromAmount)) {
              ui.updateSwapStatus("Сумма изменена. Пожалуйста, получите новый курс.");
              ui.updateSwapDetails(null);
               ui.elements.approveSwapBtn.classList.add('d-none');
              ui.elements.executeSwapBtn.classList.add('d-none');
              currentSwapQuote = null;
              return;
          }
      } catch (e) {
           ui.updateSwapStatus("Некорректная сумма в поле ввода.");
           ui.updateSwapDetails(null);
           ui.elements.approveSwapBtn.classList.add('d-none');
           ui.elements.executeSwapBtn.classList.add('d-none');
           currentSwapQuote = null;
           return;
      }


    ui.updateSwapStatus("Отправка транзакции свапа...");
    ui.elements.executeSwapBtn.disabled = true;
    ui.elements.approveSwapBtn.disabled = true;

    try {
        // TODO: ВЫПОЛНЕНИЕ СВАПА ЧЕРЕЗ АГРЕГАТОР
        // Пример с Li.Finance SDK:
        // const result = await LiFi.executeRoute(signer, currentSwapQuote);
        // const txHash = result.transactionHash;

         // --- ЗАГЛУШКА ---
         ui.updateSwapStatus(`Запрос подписи транзакции в кошельке...`);
         const fakeTxHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
         console.log("Имитация отправки транзакции свапа, хэш:", fakeTxHash);
         const tx = { hash: fakeTxHash, wait: () => new Promise(res => setTimeout(() => res({ transactionHash: fakeTxHash, status: 1 }), 10000)) };
        // --- КОНЕЦ ЗАГЛУШКИ ---

        ui.updateSwapStatus(`Транзакция отправлена! Ожидание подтверждения... Хэш: ${utils.formatAddress(tx.hash)}`);
        const explorerUrl = wallet.getExplorerUrl(chainId);
        ui.showTransactionStatusModal("Отправлено, ожидание подтверждения...", tx.hash, explorerUrl ? explorerUrl + tx.hash : null);

        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();

        console.log("Swap transaction confirmed:", receipt);

        if (receipt.status === 1) {
            ui.updateSwapStatus(`Свап успешно выполнен!`);
            ui.showTransactionStatusModal("Подтверждено!", receipt.transactionHash, explorerUrl ? explorerUrl + receipt.transactionHash : null);
        } else {
            ui.updateSwapStatus(`Транзакция не удалась. Проверьте в эксплорере.`);
            ui.showTransactionStatusModal("Не удалась!", receipt.transactionHash, explorerUrl ? explorerUrl + receipt.transactionHash : null);
        }

        // TODO: ОПЦИОНАЛЬНО: Отправить информацию о транзакции на бэкенд для Telegram уведомления


        await updateCurrentBalances();

        ui.elements.swapFromAmount.value = '';
        ui.elements.swapToAmount.value = '';
        ui.updateSwapDetails(null);
        ui.elements.approveSwapBtn.classList.add('d-none');
        ui.elements.executeSwapBtn.classList.add('d-none');
        currentSwapQuote = null;

    } catch (error) {
        console.error("Swap execution failed:", error);
         let errorMessage = "Неизвестная ошибка выполнения свапа.";
         let txHashForModal = null;
         if (error.code === 4001) {
             errorMessage = "Транзакция отклонена пользователем.";
         } else if (error.transactionHash) {
              errorMessage = `Транзакция не удалась: ${error.message || 'Проверьте в эксплорере'}`;
              txHashForModal = error.transactionHash;
         } else if (error.message) {
             errorMessage = `Ошибка: ${error.message.substring(0, 100)}...`;
         }
         const chainId = wallet.getChainId();
         const explorerUrl = chainId ? wallet.getExplorerUrl(chainId) : null;

        ui.updateSwapStatus(errorMessage);
        ui.showTransactionStatusModal(errorMessage, txHashForModal, txHashForModal && explorerUrl ? explorerUrl + txHashForModal : null);

         if (error.code === 4001) {
              setTimeout(() => ui.hideTransactionStatusModal(), 5000);
         }

    } finally {
        ui.elements.executeSwapBtn.disabled = false;
        ui.elements.approveSwapBtn.disabled = false;
    }
}

function resetState() {
    selectedFromToken = null;
    selectedToToken = null;
    currentSwapQuote = null;
    ui.elements.swapFromAmount.value = '';
    ui.elements.swapToAmount.value = '';
    ui.elements.swapFromTokenBtn.innerHTML = 'Выберите Токен';
    ui.elements.swapToTokenBtn.innerHTML = 'Выберите Токен';

    ui.updateSwapDetails(null);
    ui.updateSwapStatus("");
    ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    ui.elements.approveSwapBtn.classList.add('d-none');
    ui.elements.executeSwapBtn.classList.add('d-none');

    updateCurrentBalances();
}

// Экспорт функций
window.swap = {
    handleTokenSelectClick,
    handleGetSwapQuote,
    handleApproveSwap,
    handleExecuteSwap,
    updateCurrentBalances,
    resetState,

     // Экспортируем переменные для доступа из app.js
     selectedFromToken: () => selectedFromToken,
     selectedToToken: () => selectedToToken,
     currentSwapQuote: () => currentSwapQuote,
};