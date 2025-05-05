// Переменные состояния для выбранных токенов и котировки
let selectedFromToken = null;
let selectedToToken = null;
let currentSwapQuote = null; // Текущая полученная котировка

// TODO: АДРЕС КОНТРАКТА АГРЕГАТОРА СВАПОВ НА КАЖДОЙ СЕТИ
// Этот адрес нужен для проверки и выполнения APPROVE
// В реальном приложении вы получите его из документации или SDK выбранного агрегатора (Li.Finance, 1inch и т.д.)
const SWAP_SPENDER_ADDRESSES = {
    1: "0x...Ethereum_Spender_Address...", // Ethereum Mainnet
    5: "0x...Goerli_Spender_Address...",   // Goerli Testnet
     11155111: "0x...Sepolia_Spender_Address...", // Sepolia Testnet
    137: "0x...Polygon_Spender_Address...", // Polygon Mainnet
    80001: "0x...Mumbai_Spender_Address...", // Polygon Mumbai Testnet
    // Добавьте адреса для других сетей
};


// --- Обработчики событий и основная логика ---

// Обработка клика по кнопке выбора токена (FROM или TO)
async function handleTokenSelectClick(type) {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId();

    if (!account || !currentChainId) {
        ui.updateSwapStatus("Подключите кошелек, чтобы выбрать токены.");
        return;
    }

     // Проверяем, поддерживается ли текущая сеть
     if (!wallet.getSupportedNetworks().find(net => net.chainId === currentChainId)) {
          ui.updateSwapStatus(`Текущая сеть (ID ${currentChainId}) не поддерживается для свапов.`);
          return;
     }


    ui.updateSwapStatus("Загрузка списка токенов...");
    try {
         // Получаем список токенов с бэкенда для текущей сети
        const tokenList = await utils.getTokenList(currentChainId);

        if (tokenList.length === 0) {
            ui.updateSwapStatus(`Не удалось загрузить список токенов для сети ID ${currentChainId}.`);
            return;
        }

        ui.updateSwapStatus(""); // Очищаем статус после загрузки

        // Показываем модальное окно с загруженным списком
        ui.showTokenPickerModal(tokenList, currentChainId);

        // Устанавливаем обработчик клика на элементы списка токенов внутри модалки
        // Используем делегирование событий для списка
        ui.elements.tokenListUl.onclick = async (event) => {
            const target = event.target.closest('li'); // Находим ближайший li элемент
            if (target) {
                const token = {
                    address: target.dataset.address,
                    symbol: target.dataset.symbol,
                    decimals: parseInt(target.dataset.decimals, 10),
                     chainId: parseInt(target.dataset.chainId, 10), // Получаем chainId из dataset
                    logo_uri: target.querySelector('img')?.src // Можно добавить получение logoURI
                };

                // Проверяем, что выбранный токен действительно на текущей сети
                 if (token.chainId !== currentChainId) {
                     ui.hideTokenPickerModal(); // Закрываем модалку
                     ui.updateSwapStatus(`Ошибка: Выбранный токен "${token.symbol}" находится на другой сети (ID ${token.chainId}), а кошелек на ID ${currentChainId}.`);
                     console.error("Mismatch between selected token chain and current wallet chain.");
                     return; // Прерываем выполнение
                 }


                if (type === 'from') {
                    selectedFromToken = token;
                    ui.elements.swapFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`; // Обновляем кнопку с лого и символом
                     // При выборе "отправить" токена, сразу обновить его баланс
                     updateCurrentBalances();
                } else {
                    selectedToToken = token;
                    ui.elements.swapToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`; // Обновляем кнопку с лого и символом
                    // Для "получить" токена, баланс не так критичен сразу
                     // updateCurrentBalances(); // Можно тоже обновить
                }

                ui.hideTokenPickerModal(); // Скрываем модалку выбора токена
                // Сбросить старую котировку и детали, так как токены изменились
                currentSwapQuote = null;
                ui.updateSwapDetails(null); // Скрываем детали свапа
                ui.elements.approveSwapBtn.classList.add('d-none'); // Скрываем кнопку апрува
                ui.elements.executeSwapBtn.classList.add('d-none'); // Скрываем кнопку выполнения
                 ui.updateSwapStatus("Выберите токены и сумму, затем нажмите 'Получить курс'."); // Обновляем статус

                console.log(`Selected ${type} token: ${token.symbol} on chain ${token.chainId}`);
            }
        };

    } catch (error) {
        console.error("Error handling token select click:", error);
        ui.updateSwapStatus(`Ошибка: ${error.message}`);
        ui.hideTokenPickerModal(); // Скрываем модалку в случае ошибки
    }
}


// Обновляет отображение баланса для выбранного токена отправки
async function updateCurrentBalances() {
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
     const chainId = wallet.getChainId();

    if (!account || !provider || !chainId) {
         ui.updateTokenBalanceDisplay('swap-from-balance', null, 18); // Сбросить отображение
        return;
    }

    // Обновляем баланс только для выбранного токена отправки, если он на текущей сети
    if (selectedFromToken && selectedFromToken.chainId === chainId) {
        ui.updateTokenBalanceDisplay('swap-from-balance', 'Загрузка...', selectedFromToken.decimals); // Показываем "Загрузка..."
        const balance = await utils.getTokenBalance(selectedFromToken.address, account, provider, selectedFromToken.decimals);
        ui.updateTokenBalanceDisplay('swap-from-balance', balance, selectedFromToken.decimals);
    } else {
         // Если токен не выбран или не на текущей сети, сбрасываем баланс
         ui.updateTokenBalanceDisplay('swap-from-balance', null, 18);
    }
}


// Обработка клика по кнопке "Получить курс"
async function handleGetSwapQuote() {
    const account = wallet.getAccount();
    const chainId = wallet.getChainId();
    const provider = wallet.getProvider();
    const amountString = ui.elements.swapFromAmount.value; // Берем значение из поля ввода

    if (!account || !chainId || !provider) {
        ui.updateSwapStatus("Подключите кошелек.");
        return;
    }
    if (!selectedFromToken || !selectedToToken) {
        ui.updateSwapStatus("Выберите токены для свапа.");
        return;
    }
     // Убедимся, что выбранные токены на текущей сети кошелька
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

     // Парсим введенную сумму в BigNumber
     let amountBigNumber;
     try {
         amountBigNumber = utils.parseTokenAmount(amountString, selectedFromToken.decimals);
     } catch (e) {
         ui.updateSwapStatus(e.message); // Показываем ошибку парсинга из utils
         ui.elements.swapToAmount.value = '';
         ui.updateSwapDetails(null);
         ui.elements.approveSwapBtn.classList.add('d-none');
         ui.elements.executeSwapBtn.classList.add('d-none');
         return;
     }


     // Проверяем баланс перед запросом котировки
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
    ui.elements.approveSwapBtn.classList.add('d-none'); // Скрываем кнопки
    ui.elements.executeSwapBtn.classList.add('d-none');
     ui.elements.getSwapQuoteBtn.disabled = true; // Отключаем кнопку
    ui.elements.swapToAmount.value = 'Загрузка...';
    ui.updateSwapDetails(null); // Скрываем старые детали


    try {
        // TODO: ИСПОЛЬЗУЙТЕ SDK/API ВАШЕГО АГРЕГАТОРА СВАПОВ ДЛЯ ПОЛУЧЕНИЯ КОТИРОВКИ
        // ПРИМЕР с Li.Finance SDK (после установки и инициализации)
        // const route = await LiFi.getRoute({
        //      fromChainId: chainId,
        //      toChainId: chainId, // Для свапа цепь та же
        //      fromTokenAddress: selectedFromToken.address === 'NATIVE' ? '0x0' : selectedFromToken.address, // LiFi использует '0x0' для нативных
        //      toTokenAddress: selectedToToken.address === 'NATIVE' ? '0x0' : selectedToToken.address,
        //      fromAmount: amountBigNumber.toString(), // Агрегаторы часто требуют строку BigNumber
        //      fromAddress: account // Некоторые API требуют адрес отправителя
        // });
        // currentSwapQuote = route.route; // В LiFi котировка находится в поле .route

        // --- ЗАГЛУШКА: Имитация получения котировки ---
         await new Promise(resolve => setTimeout(resolve, 1500)); // Имитация задержки сети
         // Имитируем структуру, похожую на ответ агрегатора
         const mockToAmount = amountBigNumber.mul(98).div(100); // Имитация проскальзывания/комиссии
         currentSwapQuote = {
             fromToken: selectedFromToken,
             toToken: selectedToToken,
             fromAmount: amountBigNumber,
             toAmount: mockToAmount, // Рассчитанная сумма получения
             protocol: 'Тестовый Uniswap V3', // Имя протокола
             gasCost: { amount: ethers.utils.parseUnits('0.005', 18), decimals: 18, token: {symbol: 'ETH', name: 'Ethereum'} }, // Примерная комиссия сети
             steps: [ /* Детали шагов */ ], // Агрегатор может возвращать шаги
             estimate: { /* Дополнительные оценки */ }
             // В реальной котировке от агрегатора будет намного больше данных,
             // включая rawTransaction или Data для вызова контракта
         };
        // --- КОНЕЦ ЗАГЛУШКИ ---


        ui.updateSwapDetails(currentSwapQuote);
        // Отображаем ожидаемую сумму получения
        ui.elements.swapToAmount.value = utils.formatTokenAmount(currentSwapQuote.toAmount, selectedToToken.decimals);


        // Проверяем необходимость апрува для токена отправки (если это не нативная валюта)
        if (selectedFromToken.address.toLowerCase() !== 'native') { // Проверяем регистр
            const spenderAddress = SWAP_SPENDER_ADDRESSES[chainId];
            if (!spenderAddress) {
                 ui.updateSwapStatus(`Ошибка: Неизвестный адрес контракта агрегатора для текущей сети ID ${chainId}.`);
                 return; // Прерываем, т.к. не можем проверить/сделать апрув
            }

            const allowance = await utils.getTokenAllowance(selectedFromToken.address, account, spenderAddress, provider);

            // Сравниваем разрешение с суммой, которую хотим отправить
            // Если разрешение меньше, чем сумма к отправке, или сильно меньше MaxUint256 (если апрувим на максимум)
            if (allowance.lt(amountBigNumber)) { // Сравниваем с требуемой суммой
                ui.updateSwapStatus(`Требуется разрешение на трату ${selectedFromToken.symbol}.`);
                ui.elements.approveSwapBtn.classList.remove('d-none'); // Показываем кнопку апрува
                ui.elements.executeSwapBtn.classList.add('d-none'); // Скрываем кнопку выполнения
            } else {
                // Апрув не нужен или уже есть достаточный
                ui.updateSwapStatus(`Готово к свапу.`);
                 ui.elements.approveSwapBtn.classList.add('d-none'); // Скрываем кнопку апрува
                ui.elements.executeSwapBtn.classList.remove('d-none'); // Показываем кнопку выполнения
            }
        } else {
            // Нативная валюта (ETH, MATIC) - апрув не нужен
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
        ui.updateSwapDetails(null); // Скрываем детали
         ui.elements.approveSwapBtn.classList.add('d-none');
         ui.elements.executeSwapBtn.classList.add('d-none');
         currentSwapQuote = null; // Сброс котировки
    } finally {
         ui.elements.getSwapQuoteBtn.disabled = false; // Включаем кнопку обратно
    }
}


// Обработка клика по кнопке "Разрешить Токен"
async function handleApproveSwap() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const chainId = wallet.getChainId(); // Текущая сеть кошелька
    const amountString = ui.elements.swapFromAmount.value; // Берем сумму из поля ввода

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

     // Получаем адрес спенаера для текущей сети
     const spenderAddress = SWAP_SPENDER_ADDRESSES[chainId];
     if (!spenderAddress) {
          ui.updateSwapStatus(`Ошибка: Неизвестный адрес контракта агрегатора для текущей сети ID ${chainId}.`);
          return;
     }

     // Парсим введенную сумму в BigNumber (для апрува обычно используют MaxUint256)
     let amountBigNumber;
     try {
         // В большинстве случаев для DEX/агрегаторов лучше апрувить на MaxUint256,
         // чтобы не просить апрув при каждой транзакции.
          amountBigNumber = ethers.constants.MaxUint256; // Максимальное возможное значение uint256
          // Или можно использовать amountString, но тогда потребуется апрув для каждой новой суммы
          // amountBigNumber = utils.parseTokenAmount(amountString, selectedFromToken.decimals);
     } catch (e) {
         ui.updateSwapStatus("Некорректная сумма для апрува."); // Эта ошибка маловероятна с MaxUint256
         return;
     }

    ui.updateSwapStatus(`Запрос разрешения на ${selectedFromToken.symbol}...`);
     ui.elements.approveSwapBtn.disabled = true; // Отключить кнопку во время выполнения


    try {
        // Вызываем вспомогательную функцию для апрува
        const receipt = await utils.approveToken(selectedFromToken.address, spenderAddress, amountBigNumber, signer);

        // После успешного апрува, снова проверяем его, чтобы обновить UI
         // Ждем немного после подтверждения транзакции перед проверкой
         await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
         const newAllowance = await utils.getTokenAllowance(selectedFromToken.address, account, spenderAddress, wallet.getProvider());

         // Проверяем, достаточно ли теперь разрешения для СУММЫ ИЗ ПОЛЯ ВВОДА
          const currentInputAmount = utils.parseTokenAmount(amountString, selectedFromToken.decimals);

         if (newAllowance.gte(currentInputAmount)) { // Проверяем, достаточно ли разрешения для введенной суммы
             ui.updateSwapStatus("Разрешение получено. Готово к свапу.");
             ui.elements.approveSwapBtn.classList.add('d-none'); // Скрываем апрув
             ui.elements.executeSwapBtn.classList.remove('d-none'); // Показываем выполнить
         } else {
             ui.updateSwapStatus("Разрешение получено, но недостаточно для этой суммы. Пожалуйста, получите новый курс и проверьте.");
              ui.elements.approveSwapBtn.classList.remove('d-none'); // Кнопка апрува снова доступна
              ui.elements.executeSwapBtn.classList.add('d-none'); // Кнопка выполнения скрыта
         }


    } catch (error) {
        console.error("Approval failed:", error);
        // Сообщение об ошибке уже выведено в approveToken, но можно обновить статус
         // ui.updateSwapStatus(`Ошибка апрува: ${error.message}`); // Можно дублировать или улучшить сообщение
         // Кнопка апрува остается или становится снова доступной
         ui.elements.approveSwapBtn.classList.remove('d-none');
         ui.elements.executeSwapBtn.classList.add('d-none');
    } finally {
         ui.elements.approveSwapBtn.disabled = false; // Включить кнопку
    }
}


// Обработка клика по кнопке "Выполнить Свап"
async function handleExecuteSwap() {
    const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const chainId = wallet.getChainId(); // Текущая сеть кошелька

     if (!account || !signer || !chainId || !currentSwapQuote) {
        ui.updateSwapStatus("Ошибка: Котировка свапа не получена или кошелек не подключен.");
        return;
    }

    // Убедимся, что текущая котировка соответствует выбранной сети
     if (currentSwapQuote.fromToken.chainId !== chainId || currentSwapQuote.toToken.chainId !== chainId) {
         ui.updateSwapStatus("Ошибка: Котировка получена для другой сети.");
         return;
     }

     // Дополнительно можно проверить, что сумма в поле ввода не изменилась с момента получения котировки
      const currentInputAmount = ui.elements.swapFromAmount.value;
      try {
          const inputAmountBigNumber = utils.parseTokenAmount(currentInputAmount, selectedFromToken.decimals);
           // Сравниваем с fromAmount из котировки. Использовать .eq() для BigNumber
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
     ui.elements.executeSwapBtn.disabled = true; // Отключить кнопку во время выполнения
     ui.elements.approveSwapBtn.disabled = true; // Отключить и апрув кнопку на всякий случай

    try {
        // TODO: ИСПОЛЬЗУЙТЕ SDK/API ВАШЕГО АГРЕГАТОРА ДЛЯ ВЫПОЛНЕНИЯ СВАПА
        // Это САМАЯ ВАЖНАЯ и зависящая от агрегатора часть.
        // Агрегатор обычно предоставляет функцию execute() или populateTransaction()
        // которая принимает signer и объект котировки (текущий currentSwapQuote).
        // Она взаимодействует с кошельком пользователя для подписи и отправки.

        // ПРИМЕР с Li.Finance SDK (выполнение маршрута):
        // const result = await LiFi.executeRoute(signer, currentSwapQuote);
        // console.log("Swap transaction result:", result);
        // const txHash = result.transactionHash; // Или result.txHash в зависимости от SDK

        // --- ЗАГЛУШКА: Имитация выполнения транзакции ---
         ui.updateSwapStatus(`Запрос подписи транзакции в кошельке...`);
         await new Promise((resolve, reject) => {
              console.log("Имитация запроса подписи транзакции свапа...");
             // В реальном коде здесь был бы вызов signer.sendTransaction({ data: currentSwapQuote.transaction.data, ... })
             // или метода SDK.
             // Кошелек откроет окно подтверждения. Если пользователь подтвердит, sendTransaction вернет объект транзакции.
             setTimeout(() => {
                 // Имитируем получение объекта транзакции после подтверждения
                 const fakeTxHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'); // Пример фейкового хэша
                 console.log("Имитация отправки транзакции, хэш:", fakeTxHash);
                 // В реальном случае, tx = await signer.sendTransaction(...)
                 // resolve(tx); // Передаем объект транзакции
                 resolve({ hash: fakeTxHash, wait: () => new Promise(res => setTimeout(() => res({ transactionHash: fakeTxHash, status: 1 }), 10000)) }); // Имитируем tx object с методом wait
             }, 2000); // Имитация ожидания подтверждения в кошельке
         });

         const tx = await new Promise((resolve, reject) => { /* ...имитация выше... */ }); // Получаем имитацию tx объекта

        ui.updateSwapStatus(`Транзакция отправлена! Ожидание подтверждения... Хэш: ${utils.formatAddress(tx.hash)}`);
         const explorerUrl = wallet.getExplorerUrl(chainId) + tx.hash;
         ui.showTransactionStatusModal("Отправлено, ожидание подтверждения...", tx.hash, explorerUrl);


         // Ждем подтверждения транзакции в блокчейне
         console.log("Waiting for transaction confirmation...");
         const receipt = await tx.wait(); // Ждем 10 секунд в нашей имитации

         console.log("Swap transaction confirmed:", receipt);

         // Проверяем статус транзакции (0 = ошибка, 1 = успех)
         if (receipt.status === 1) {
             ui.updateSwapStatus(`Свап успешно выполнен!`);
             ui.showTransactionStatusModal("Подтверждено!", receipt.transactionHash, wallet.getExplorerUrl(chainId) + receipt.transactionHash);
         } else {
              ui.updateSwapStatus(`Транзакция не удалась. Проверьте в эксплорере.`);
             ui.showTransactionStatusModal("Не удалась!", receipt.transactionHash, wallet.getExplorerUrl(chainId) + receipt.transactionHash);
         }


         // TODO: ОПЦИОНАЛЬНО: Отправить информацию о транзакции на бэкенд для Telegram уведомления
         // Например: utils.postData(`${utils.BACKEND_URL}/api/notify/swap`, { wallet_address: account, tx_hash: receipt.transactionHash, status: receipt.status });


         // Обновить балансы после успешного (или неуспешного) свапа
         await updateCurrentBalances();

         // Очистить поля ввода и сбросить состояние
         ui.elements.swapFromAmount.value = '';
         ui.elements.swapToAmount.value = '';
         ui.updateSwapDetails(null);
          ui.elements.approveSwapBtn.classList.add('d-none');
          ui.elements.executeSwapBtn.classList.add('d-none');
          currentSwapQuote = null; // Сбросить котировку


    } catch (error) {
        console.error("Swap execution failed:", error);
         // Обработка ошибок кошелька и транзакции
         let errorMessage = "Неизвестная ошибка выполнения свапа.";
         let txHashForModal = null;

         if (error.code === 4001) {
             errorMessage = "Транзакция отклонена пользователем.";
         } else if (error.transactionHash) {
              // Ошибка произошла после отправки транзакции (например, недостаточно газа, revert)
              errorMessage = `Транзакция не удалась: ${error.message || 'Проверьте в эксплорере'}`;
              txHashForModal = error.transactionHash;
         } else if (error.message) {
             errorMessage = `Ошибка: ${error.message.substring(0, 100)}...`;
         }

         ui.updateSwapStatus(errorMessage);
         ui.showTransactionStatusModal(errorMessage, txHashForModal, txHashForModal ? wallet.getExplorerUrl(chainId) + txHashForModal : null);

         // Очистить модалку через несколько секунд, если это ошибка пользователя
         if (error.code === 4001) {
              setTimeout(() => ui.hideTransactionStatusModal(), 5000);
         }


    } finally {
         ui.elements.executeSwapBtn.disabled = false; // Включить кнопку
         ui.elements.approveSwapBtn.disabled = false; // Включить кнопку апрува
    }
}

// Сброс состояния свапа при смене сети или отключении кошелька
function resetState() {
    selectedFromToken = null;
    selectedToToken = null;
    currentSwapQuote = null;
    ui.elements.swapFromAmount.value = '';
    ui.elements.swapToAmount.value = '';
    // Сбрасываем текст кнопки выбора токена к дефолтному
    ui.elements.swapFromTokenBtn.innerHTML = 'Выберите Токен';
    ui.elements.swapToTokenBtn.innerHTML = 'Выберите Токен';

    ui.updateSwapDetails(null); // Скрываем детали
    ui.updateSwapStatus(""); // Очищаем статус
    ui.updateTokenBalanceDisplay('swap-from-balance', null, 18); // Сбрасываем баланс
     ui.elements.approveSwapBtn.classList.add('d-none'); // Скрываем кнопки
     ui.elements.executeSwapBtn.classList.add('d-none');

    // Обновляем балансы на всякий случай после сброса (покажет 0 если кошелек не подключен)
    updateCurrentBalances();
}


// Экспорт функций (делаем их доступными в глобальной области под объектом swap)
window.swap = {
    handleTokenSelectClick,
    handleGetSwapQuote,
    handleApproveSwap,
    handleExecuteSwap,
    updateCurrentBalances, // Экспортируем для вызова из wallet.js и app.js
     resetState, // Экспортируем для вызова из wallet.js и app.js

     // Опционально: экспортировать переменные состояния для отладки или доступа из app.js
     selectedFromToken: () => selectedFromToken,
     selectedToToken: () => selectedToToken,
     currentSwapQuote: () => currentSwapQuote,
};