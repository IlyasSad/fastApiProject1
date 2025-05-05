/ Переменные состояния для моста
let selectedFromChainId = null; // ID исходной сети
let selectedToChainId = null;   // ID целевой сети
let selectedFromTokenBridge = null; // Токен для отправки на исходной сети
let selectedToTokenBridge = null;   // Токен для получения на целевой сети
let currentBridgeQuote = null; // Текущая полученная котировка моста (маршрут)

// TODO: АДРЕС КОНТРАКТА АГРЕГАТОРА/МОСТА НА КАЖДОЙ СЕТИ ДЛЯ APPROVE
// Этот адрес нужен для проверки и выполнения APPROVE на ИСХОДНОЙ сети
// В реальном приложении вы получите его из документации или SDK выбранного агрегатора/моста.
const BRIDGE_SPENDER_ADDRESSES = {
    1: "0x...Ethereum_Bridge_Spender_Address...", // Ethereum Mainnet
    5: "0x...Goerli_Bridge_Spender_Address...",   // Goerli Testnet
    11155111: "0x...Sepolia_Bridge_Spender_Address...", // Sepolia Testnet
    137: "0x...Polygon_Bridge_Spender_Address...", // Polygon Mainnet
    80001: "0x...Mumbai_Bridge_Spender_Address...", // Polygon Mumbai Testnet
    // Добавьте адреса для других сетей
};


// --- Инициализация и Обработчики ---

// Заполнение выпадающих списков сетей
function populateNetworkSelects() {
    const supportedNetworks = wallet.getSupportedNetworks(); // Получаем список поддерживаемых сетей из wallet.js
    const currentChainId = wallet.getChainId(); // Текущая сеть кошелька

    if (!currentChainId) {
        // Если кошелек не подключен, сбрасываем списки и показываем только поддерживаемые
         ui.populateNetworkSelect('bridge-from-network', supportedNetworks, null); // Выбираем по умолчанию "-- Выберите сеть --"
         ui.populateNetworkSelect('bridge-to-network', supportedNetworks, null);
         // Сбросить выбранные сети в состоянии
         selectedFromChainId = null;
         selectedToChainId = null;
         return;
    }

     // Сеть "Из" по умолчанию - текущая сеть кошелька
    ui.populateNetworkSelect('bridge-from-network', supportedNetworks, currentChainId);
     // Сеть "В" по умолчанию - можно выбрать первую в списке, отличную от текущей, или оставить "-- Выберите сеть --"
    const defaultToChainId = supportedNetworks.find(net => net.chainId !== currentChainId)?.chainId || null;
    ui.populateNetworkSelect('bridge-to-network', supportedNetworks, defaultToChainId);

     // Устанавливаем выбранные значения в переменных состояния
     selectedFromChainId = currentChainId; // Исходная сеть по умолчанию - текущая
     selectedToChainId = defaultToChainId; // Целевая сеть по умолчанию

     // Важно: Триггерим событие change после populate, чтобы обновился UI и стейт в handleNetworkChange
     // (ui.populateNetworkSelect уже делает это)

     console.log(`Populated bridge networks. Default From: ${selectedFromChainId}, Default To: ${selectedToChainId}`);

     // Сбросить выбранные токены при перенаселении списков
     selectedFromTokenBridge = null;
     selectedToTokenBridge = null;
     ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
     ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';
     ui.updateBridgeDetails(null);
     ui.updateBridgeStatus("Выберите сети и токены, затем нажмите 'Найти лучший путь'.");
     ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18); // Сбросить отображение баланса
     ui.elements.approveBridgeBtn.classList.add('d-none');
     ui.elements.executeBridgeBtn.classList.add('d-none');
     currentBridgeQuote = null;
}

// Обработка смены сети в дропдаунах
function handleNetworkChange(type, selectElement) {
    const newChainId = parseInt(selectElement.value, 10);

    if (type === 'from') {
        selectedFromChainId = newChainId;
         // Сбросить выбранный FROM токен при смене сети
         selectedFromTokenBridge = null;
         ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
          // Обновить баланс для нового выбранного FROM chainId (только если он совпадает с текущей сетью кошелька)
         updateCurrentBalances();

    } else { // type === 'to'
        selectedToChainId = newChainId;
         // Сбросить выбранный TO токен при смене сети
         selectedToTokenBridge = null;
         ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';
    }

     // Сбросить котировку и детали при смене сети
    currentBridgeQuote = null;
    ui.updateBridgeDetails(null); // Скрываем детали моста
     ui.elements.approveBridgeBtn.classList.add('d-none'); // Скрываем кнопки
     ui.elements.executeBridgeBtn.classList.add('d-none');
     ui.updateBridgeStatus("Выберите сети и токены, затем нажмите 'Найти лучший путь'.");

     console.log(`Bridge networks updated: From ${selectedFromChainId} to ${selectedToChainId}`);
}


// Обработка клика по кнопке выбора токена для моста (FROM или TO)
async function handleTokenSelectClickBridge(type) {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId(); // Текущая сеть кошелька
    const targetChainId = (type === 'from') ? selectedFromChainId : selectedToChainId; // Сеть, для которой выбираем токен

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


     // Важно: Мы можем выбирать токен ОТПРАВКИ (type='from') только для той сети,
     // к которой сейчас подключен кошелек, потому что нам нужен баланс и возможность апрува/отправки.
     if (type === 'from' && selectedFromChainId !== currentChainId) {
         ui.updateBridgeStatus(`Чтобы выбрать токен для отправки, переключите кошелек на сеть "${wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId)?.name || selectedFromChainId}".`);
         // TODO: Опционально: добавить возможность переключить сеть в кошельке по клику
         // await wallet.switchChain(selectedFromChainId);
         return;
     }
      // Для TO токена сеть может быть любой из выбранных (targetChainId)


    ui.updateBridgeStatus(`Загрузка списка токенов для сети ID ${targetChainId}...`);
    try {
        // Получаем список токенов с бэкенда для ЦЕЛЕВОЙ СЕТИ ВЫБОРА (targetChainId)
        const tokenList = await utils.getTokenList(targetChainId);

         if (tokenList.length === 0) {
            ui.updateBridgeStatus(`Не удалось загрузить список токенов для сети ID ${targetChainId}.`);
            return;
        }

        ui.updateBridgeStatus(""); // Очищаем статус


        // Показываем модальное окно с загруженным списком
        ui.showTokenPickerModal(tokenList, targetChainId); // Передаем targetChainId в модалку


        // Устанавливаем обработчик клика на элементы списка токенов внутри модалки
         ui.elements.tokenListUl.onclick = async (event) => {
            const target = event.target.closest('li');
            if (target) {
                 // Получаем chainId из dataset элемента списка
                 const tokenChainId = parseInt(target.dataset.chainId, 10);

                const token = {
                    address: target.dataset.address,
                    symbol: target.dataset.symbol,
                    decimals: parseInt(target.dataset.decimals, 10),
                    chainId: tokenChainId, // Используем chainId токена из dataset
                    logo_uri: target.querySelector('img')?.src
                };

                // Проверяем, что выбранный токен действительно на targetChainId, переданном в модалку
                 if (token.chainId !== targetChainId) {
                      console.error("Mismatch between selected token chain and target chain for modal.");
                      ui.hideTokenPickerModal();
                       ui.updateBridgeStatus(`Ошибка: Выбранный токен "${token.symbol}" находится на другой сети (ID ${token.chainId}), а модалка была для ID ${targetChainId}.`);
                      return;
                 }

                if (type === 'from') {
                     // Дополнительная проверка: токен FROM должен быть на выбранной ИСХОДНОЙ сети моста (selectedFromChainId)
                     if (token.chainId !== selectedFromChainId) {
                          ui.hideTokenPickerModal();
                          ui.updateBridgeStatus(`Ошибка: Токен отправки "${token.symbol}" должен быть на исходной сети моста (${wallet.getSupportedNetworks().find(n=>n.chainId === selectedFromChainId)?.name || selectedFromChainId}).`);
                          return;
                     }
                    selectedFromTokenBridge = token;
                    ui.elements.bridgeFromTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`; // Обновляем кнопку
                     // Обновить баланс, только если исходная сеть моста - текущая сеть кошелька
                     if (selectedFromChainId === currentChainId) {
                          updateCurrentBalances();
                     } else {
                         ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18); // Сбросить если не текущая сеть
                     }

                } else { // type === 'to'
                     // Дополнительная проверка: токен TO должен быть на выбранной ЦЕЛЕВОЙ сети моста (selectedToChainId)
                     if (token.chainId !== selectedToChainId) {
                         ui.hideTokenPickerModal();
                         ui.updateBridgeStatus(`Ошибка: Токен получения "${token.symbol}" должен быть на целевой сети моста (${wallet.getSupportedNetworks().find(n=>n.chainId === selectedToChainId)?.name || selectedToChainId}).`);
                         return;
                     }
                    selectedToTokenBridge = token;
                    ui.elements.bridgeToTokenBtn.innerHTML = `<img src="${token.logo_uri}" alt="${token.symbol}" class="me-2 rounded-circle" style="width: 20px; height: 20px;"> ${token.symbol}`; // Обновляем кнопку
                }

                ui.hideTokenPickerModal(); // Скрываем модалку
                // Сбросить старую котировку и детали
                currentBridgeQuote = null;
                ui.updateBridgeDetails(null); // Скрываем детали
                ui.elements.approveBridgeBtn.classList.add('d-none'); // Скрываем кнопки
                ui.elements.executeBridgeBtn.classList.add('d-none');
                 ui.updateBridgeStatus("Выберите сети и токены, затем нажмите 'Найти лучший путь'."); // Обновляем статус

                 console.log(`Selected bridge token: ${type} - ${token.symbol} on chain ${token.chainId}`);
            }
        };

    } catch (error) {
        console.error("Error handling bridge token select click:", error);
        ui.updateBridgeStatus(`Ошибка: ${error.message}`);
        ui.hideTokenPickerModal(); // Скрываем модалку в случае ошибки
    }
}


// Обновляет отображение баланса для выбранного токена отправки моста
async function updateCurrentBalances() {
    const account = wallet.getAccount();
    const provider = wallet.getProvider();
     const chainId = wallet.getChainId(); // Текущая сеть кошелька

    if (!account || !provider || !chainId) {
         ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18); // Сбросить отображение
        return;
    }

    // Обновляем баланс ТОЛЬКО если выбран исходный токен моста, и его сеть совпадает с текущей сетью кошелька
    if (selectedFromTokenBridge && selectedFromTokenBridge.chainId === chainId) {
         ui.updateTokenBalanceDisplay('bridge-from-balance', 'Загрузка...', selectedFromTokenBridge.decimals);
        const balance = await utils.getTokenBalance(selectedFromTokenBridge.address, account, provider, selectedFromTokenBridge.decimals);
        ui.updateTokenBalanceDisplay('bridge-from-balance', balance, selectedFromTokenBridge.decimals);
    } else {
         // Если токен не выбран, не на текущей сети, или исходная сеть моста не текущая
         ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18);
    }

     // Баланс TO токена для моста обычно не отображается или требуется отдельный RPC запрос к целевой сети
}


// Обработка клика по кнопке "Найти лучший путь"
async function handleGetBridgeQuote() {
    const account = wallet.getAccount();
    const currentChainId = wallet.getChainId(); // Текущая сеть кошелька
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
     // Проверка: выбранный исходный токен должен быть на выбранной исходной сети моста
     if (selectedFromTokenBridge.chainId !== selectedFromChainId) {
          ui.updateBridgeStatus(`Ошибка: Выбранный токен отправки "${selectedFromTokenBridge.symbol}" не на исходной сети моста.`);
          return;
     }
      // Проверка: выбранный целевой токен должен быть на выбранной целевой сети моста
      if (selectedToTokenBridge.chainId !== selectedToChainId) {
           ui.updateBridgeStatus(`Ошибка: Выбранный токен получения "${selectedToTokenBridge.symbol}" не на целевой сети моста.`);
          return;
      }
     // Проверка: кошелек должен быть подключен к исходной сети моста, чтобы отправить транзакцию
     if (currentChainId !== selectedFromChainId) {
         ui.updateBridgeStatus(`Переключите кошелек на сеть "${wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId)?.name || selectedFromChainId}", чтобы найти путь и отправить средства.`);
         // TODO: Опционально: добавить кнопку/функцию для переключения сети в кошельке
         // await wallet.switchChain(selectedFromChainId);
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

     // Парсим введенную сумму в BigNumber
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

      // Проверяем баланс перед запросом котировки
      const provider = wallet.getProvider(); // Провайдер на текущей сети кошелька (она же исходная для моста)
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
    ui.elements.approveBridgeBtn.classList.add('d-none'); // Скрываем кнопки
    ui.elements.executeBridgeBtn.classList.add('d-none');
     ui.elements.getBridgeQuoteBtn.disabled = true; // Отключаем кнопку
     ui.elements.bridgeToAmount.value = 'Поиск...';
     ui.updateBridgeDetails(null); // Скрываем старые детали


    try {
        // TODO: ИСПОЛЬЗУЙТЕ SDK/API ВАШЕГО АГРЕГАТОРА МОСТОВ ДЛЯ ПОЛУЧЕНИЯ КОТИРОВКИ (ПУТИ)
        // ПРИМЕР с Li.Finance SDK (после установки и инициализации)
        // const route = await LiFi.getRoute({
        //     fromChainId: selectedFromChainId,
        //     toChainId: selectedToChainId,
        //     fromTokenAddress: selectedFromTokenBridge.address === 'NATIVE' ? '0x0' : selectedFromTokenBridge.address,
        //     toTokenAddress: selectedToTokenBridge.address === 'NATIVE' ? '0x0' : selectedToTokenBridge.address,
        //     fromAmount: amountBigNumber.toString(),
        //     fromAddress: account // Обязательно для мостов!
        // });
        // currentBridgeQuote = route.route; // В LiFi котировка/маршрут находится в поле .route


         // --- ЗАГЛУШКА: Имитация получения котировки моста ---
         await new Promise(resolve => setTimeout(resolve, 2000)); // Имитация задержки

         // Имитация котировки моста (очень упрощено)
         const mockToAmount = amountBigNumber.mul(97).div(100); // Имитация потери на мосту
         currentBridgeQuote = {
             fromChain: wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId),
             toChain: wallet.getSupportedNetworks().find(n => n.chainId === selectedToChainId),
             fromToken: selectedFromTokenBridge,
             toToken: selectedToTokenBridge,
             fromAmount: amountBigNumber,
             toAmount: mockToAmount, // Рассчитанная сумма получения
             protocol: 'Тестовый AnyBridge',
             estimatedTime: '5-20 минут',
             gasCost: { amount: ethers.utils.parseUnits('0.01', 18), decimals: 18, token: {symbol: 'ETH', name: 'Ethereum'} }, // Примерная комиссия на исходной сети
             steps: [ /* Детали шагов: свап, мост, свап */ ]
             // Реальный агрегатор вернет гораздо больше деталей, включая transactionRequest для выполнения
         };
        // --- КОНЕЦ ЗАГЛУШКИ ---


        ui.updateBridgeDetails(currentBridgeQuote);
        // Отображаем ожидаемую сумму получения
        ui.elements.bridgeToAmount.value = utils.formatTokenAmount(currentBridgeQuote.toAmount, selectedToTokenBridge.decimals);


        // Проверяем необходимость апрува для токена отправки (если это не нативная валюта)
        // Используем адрес спенаера для КОНКРЕТНОЙ ИСХОДНОЙ СЕТИ МОСТА (selectedFromChainId)
        const spenderAddress = BRIDGE_SPENDER_ADDRESSES[selectedFromChainId]; // !!! ИСПОЛЬЗУЕМ selectedFromChainId !!!
        if (!spenderAddress) {
             ui.updateBridgeStatus(`Ошибка: Неизвестный адрес контракта агрегатора/моста для исходной сети ID ${selectedFromChainId}.`);
             return; // Прерываем, т.к. не можем проверить/сделать апрув
        }


        if (selectedFromTokenBridge.address.toLowerCase() !== 'native') {
            const allowance = await utils.getTokenAllowance(selectedFromTokenBridge.address, account, spenderAddress, provider); // !!! ИСПОЛЬЗУЕМ spenderAddress ДЛЯ ИСХОДНОЙ СЕТИ !!!

            // Сравниваем разрешение с суммой, которую хотим отправить
            if (allowance.lt(amountBigNumber)) {
                ui.updateBridgeStatus(`Требуется разрешение на трату ${selectedFromTokenBridge.symbol} на сети ${currentBridgeQuote.fromChain.name}.`);
                ui.elements.approveBridgeBtn.classList.remove('d-none'); // Показываем кнопку апрува
                ui.elements.executeBridgeBtn.classList.add('d-none'); // Скрываем выполнение
            } else {
                // Апрув не нужен
                ui.updateBridgeStatus(`Готово к выполнению моста.`);
                 ui.elements.approveBridgeBtn.classList.add('d-none');
                ui.elements.executeBridgeBtn.classList.remove('d-none');
            }
        } else {
            // Нативная валюта - апрув не нужен
            ui.updateBridgeStatus(`Готово к выполнению моста.`);
             ui.elements.approveBridgeBtn.classList.add('d-none');
            ui.elements.executeBridgeBtn.classList.remove('d-none');
        }


    } catch (error) {
        console.error("Error getting bridge quote:", error);
        let errorMessage = "Ошибка при поиске пути моста.";
         if (error.message) {
             errorMessage = `Ошибка: ${error.message}`;
         }
        ui.updateBridgeStatus(errorMessage);
        ui.elements.bridgeToAmount.value = 'Ошибка';
        ui.updateBridgeDetails(null); // Скрываем детали
         ui.elements.approveBridgeBtn.classList.add('d-none');
         ui.elements.executeBridgeBtn.classList.add('d-none');
         currentBridgeQuote = null; // Сброс котировки
    } finally {
         ui.elements.getBridgeQuoteBtn.disabled = false; // Включаем кнопку
    }
}

// Обработка клика по кнопке "Разрешить Токен" для моста
async function handleApproveBridge() {
     const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentChainId = wallet.getChainId(); // Текущая сеть кошелька
    const amountString = ui.elements.bridgeFromAmount.value; // Берем сумму из поля ввода

    if (!account || !signer || !currentChainId || !selectedFromTokenBridge || !selectedFromChainId) {
        ui.updateBridgeStatus("Ошибка: Не удалось выполнить апрув (нет кошелька, токена или сети).");
        return;
    }

     // Проверка: кошелек должен быть подключен к ИСХОДНОЙ сети моста
     if (currentChainId !== selectedFromChainId) {
         ui.updateBridgeStatus(`Переключите кошелек на сеть "${wallet.getSupportedNetworks().find(n => n.chainId === selectedFromChainId)?.name || selectedFromChainId}", чтобы выполнить апрув.`);
         // TODO: Опционально: добавить кнопку/функцию для переключения сети
         // await wallet.switchChain(selectedFromChainId);
         return;
     }


     if (selectedFromTokenBridge.address.toLowerCase() === 'native') {
         ui.updateBridgeStatus("Нативная валюта не требует апрува.");
         ui.elements.approveBridgeBtn.classList.add('d-none');
         ui.elements.executeBridgeBtn.classList.remove('d-none');
         return;
     }

     // Получаем адрес спенаера для текущей (исходной) сети моста
     const spenderAddress = BRIDGE_SPENDER_ADDRESSES[currentChainId]; // !!! ИСПОЛЬЗУЕМ currentChainId, т.к. это сеть кошелька И исходная сеть !!!
     if (!spenderAddress) {
          ui.updateBridgeStatus(`Ошибка: Неизвестный адрес контракта агрегатора/моста для текущей сети ${currentChainId}.`);
          return;
     }


     // Парсим введенную сумму в BigNumber (для апрува обычно используют MaxUint256)
     let amountBigNumber;
     try {
          amountBigNumber = ethers.constants.MaxUint256; // Максимальное возможное значение
          // Или amountBigNumber = utils.parseTokenAmount(amountString, selectedFromTokenBridge.decimals);
     } catch (e) {
         ui.updateBridgeStatus("Некорректная сумма для апрува."); // Маловероятно с MaxUint256
         return;
     }


    ui.updateBridgeStatus(`Запрос разрешения на ${selectedFromTokenBridge.symbol} на сети ${wallet.getSupportedNetworks().find(n => n.chainId === currentChainId)?.name || currentChainId}...`);
     ui.elements.approveBridgeBtn.disabled = true; // Отключить кнопку

    try {
        // Вызываем вспомогательную функцию для апрува
        const receipt = await utils.approveToken(selectedFromTokenBridge.address, spenderAddress, amountBigNumber, signer);

        // После успешного апрува, снова проверяем его, чтобы обновить UI
         await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем немного
         const newAllowance = await utils.getTokenAllowance(selectedFromTokenBridge.address, account, spenderAddress, wallet.getProvider());

         // Проверяем, достаточно ли теперь разрешения для СУММЫ ИЗ ПОЛЯ ВВОДА
         const currentInputAmount = ui.elements.bridgeFromAmount.value;
          const inputAmountBigNumber = utils.parseTokenAmount(currentInputAmount, selectedFromTokenBridge.decimals);


         if (newAllowance.gte(inputAmountBigNumber)) { // Проверяем, достаточно ли разрешения
             ui.updateBridgeStatus("Разрешение получено. Готово к выполнению моста.");
             ui.elements.approveBridgeBtn.classList.add('d-none'); // Скрываем апрув
             ui.elements.executeBridgeBtn.classList.remove('d-none'); // Показываем выполнить
         } else {
             ui.updateBridgeStatus("Разрешение получено, но недостаточно для этой суммы. Пожалуйста, получите новый путь и проверьте.");
              ui.elements.approveBridgeBtn.classList.remove('d-none');
              ui.elements.executeBridgeBtn.classList.add('d-none');
         }


    } catch (error) {
        console.error("Bridge Approval failed:", error);
        // Сообщение об ошибке уже выведено в approveToken
         ui.elements.approveBridgeBtn.classList.remove('d-none');
         ui.elements.executeBridgeBtn.classList.add('d-none');
    } finally {
         ui.elements.approveBridgeBtn.disabled = false; // Включить кнопку
    }
}


// Обработка клика по кнопке "Выполнить Мост"
async function handleExecuteBridge() {
     const account = wallet.getAccount();
    const signer = wallet.getSigner();
    const currentChainId = wallet.getChainId(); // Текущая сеть кошелька

     if (!account || !signer || !currentChainId || !currentBridgeQuote) {
        ui.updateBridgeStatus("Ошибка: Котировка моста не получена или кошелек не подключен.");
        return;
    }

    // Убедимся, что кошелек подключен к ИСХОДНОЙ сети моста из котировки
     if (currentChainId !== currentBridgeQuote.fromChain.chainId) {
         ui.updateBridgeStatus(`Переключите кошелек на сеть "${currentBridgeQuote.fromChain.name}", чтобы выполнить мост.`);
         // TODO: Опционально: предложить переключить сеть
         // await wallet.switchChain(currentBridgeQuote.fromChain.chainId);
         return;
     }

      // Убедимся, что котировка актуальна для выбранных сетей и токенов
      // Сравнение объектов может быть неточным, лучше сравнивать ID сетей и адреса токенов
     if (currentBridgeQuote.fromChain.chainId !== selectedFromChainId ||
         currentBridgeQuote.toChain.chainId !== selectedToChainId ||
         currentBridgeQuote.fromToken.address.toLowerCase() !== selectedFromTokenBridge?.address.toLowerCase() ||
         currentBridgeQuote.toToken.address.toLowerCase() !== selectedToTokenBridge?.address.toLowerCase()
        )
      {
           ui.updateBridgeStatus("Ошибка: Котировка моста устарела или не соответствует выбору. Получите новую.");
           ui.elements.approveBridgeBtn.classList.add('d-none');
           ui.elements.executeBridgeBtn.classList.add('d-none');
           currentBridgeQuote = null;
           ui.updateBridgeDetails(null);
           return;
      }
       // Дополнительно можно проверить, что сумма в поле ввода не изменилась
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
     ui.elements.executeBridgeBtn.disabled = true; // Отключить кнопку во время выполнения
     ui.elements.approveBridgeBtn.disabled = true; // Отключить апрув на всякий случай


    try {
        // TODO: ИСПОЛЬЗУЙТЕ SDK/API ВАШЕГО АГРЕГАТОРА МОСТОВ ДЛЯ ВЫПОЛНЕНИЯ МОСТА
        // Это САМАЯ СЛОЖНАЯ ЧАСТЬ. Агрегатор обычно предоставляет функцию executeRoute()
        // или подобные. Она обработает шаги маршрута (например, одобрение, свап на исходной цепи,
        // вызов мостового контракта).

        // ПРИМЕР с Li.Finance SDK (выполнение маршрута):
        // const result = await LiFi.executeRoute(signer, currentBridgeQuote);
        // console.log("Bridge transaction result:", result);
        // const txHash = result.transactionHash; // Хэш первой транзакции в маршруте (на исходной сети)


         // --- ЗАГЛУШКА: Имитация выполнения транзакции моста ---
         ui.updateBridgeStatus(`Запрос подписи транзакции в кошельке...`);
         await new Promise((resolve, reject) => {
              console.log("Имитация запроса подписи транзакции моста...");
             // В реальном коде здесь был бы вызов signer.sendTransaction(...)
             // или метода SDK. Кошелек откроет окно.
             setTimeout(() => {
                 // Имитируем получение объекта транзакции на исходной сети
                 const fakeTxHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
                 console.log("Имитация отправки транзакции моста, хэш:", fakeTxHash);
                 // resolve(tx); // В реальном случае
                 resolve({ hash: fakeTxHash, wait: () => new Promise(res => setTimeout(() => res({ transactionHash: fakeTxHash, status: 1 }), 10000)) }); // Имитируем tx object
             }, 2000);
         });

         const tx = await new Promise((resolve, reject) => { /* ...имитация выше... */ }); // Получаем имитацию tx объекта
         const txHash = tx.hash; // Хэш транзакции на исходной сети

        ui.updateBridgeStatus(`Транзакция моста отправлена на сети ${currentBridgeQuote.fromChain.name}! Ожидание обработки... Хэш: ${utils.formatAddress(txHash)}`);
        const explorerUrl = wallet.getExplorerUrl(currentBridgeQuote.fromChain.chainId) + txHash; // Ссылка на исходную сеть
        ui.showTransactionStatusModal(`Транзакция отправлена на ${currentBridgeQuote.fromChain.name}, ожидание моста...`, txHash, explorerUrl);


         // TODO: ОТСЛЕЖИВАНИЕ СТАТУСА МОСТА - САМАЯ СЛОЖНАЯ ЧАСТЬ!
         // После отправки транзакции на исходной сети, средства должны быть обработаны мостом/агрегатором
         // и переведены на целевую сеть. Это может занять от нескольких секунд до десятков минут.
         // Требуется либо:
         // 1. Использовать функции SDK агрегатора для отслеживания статуса (например, LiFi.waitForRouteCompletion).
         // 2. Периодически опрашивать API агрегатора или ваш бэкенд, который мониторит мост/блокчейн.
         // 3. Если бэкенд приложения мониторит блокчейн/мост - он может уведомить фронтенд (например, через WebSockets или периодический опрос фронтендом бэкенда).

         // В рамках курсовой можно:
         // A) Просто показать "Транзакция отправлена, мост в процессе". (Простейший вариант)
         // B) Имитировать завершение через таймаут (как в заглушке ниже).
         // C) Использовать SDK агрегатора, если он предоставляет функцию отслеживания.
         // D) Реализовать опрос вашего бэкенда (если он мониторит).


         // --- ЗАГЛУШКА: Имитация ожидания подтверждения транзакции на исходной сети ---
         // (В реальном SDK executeRoute часто уже ждет первую транзакцию)
         console.log("Waiting for initial transaction confirmation...");
         const receipt = await tx.wait(); // Ждем 10 секунд в имитации
         console.log("Initial bridge transaction confirmed:", receipt);


         // --- ЗАГЛУШКА: Имитация ожидания завершения моста ---
          ui.updateBridgeStatus(`Транзакция подтверждена на ${currentBridgeQuote.fromChain.name}. Ожидание моста...`);
          // Модалка статуса транзакции может обновиться
          ui.showTransactionStatusModal(`Транзакция подтверждена на ${currentBridgeQuote.fromChain.name}. Мост в процессе...`, receipt.transactionHash, wallet.getExplorerUrl(currentBridgeQuote.fromChain.chainId) + receipt.transactionHash);

          console.log(`Имитация ожидания завершения моста через ${currentBridgeQuote.estimatedTime}...`);
          setTimeout(async () => {
              ui.updateBridgeStatus(`Мост на сеть ${currentBridgeQuote.toChain.name} успешно выполнен!`);
              // Модалка статуса транзакции может оставаться открытой или обновиться
               // В идеале, получить хэш транзакции на целевой сети и использовать его
               const targetTxHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '1'); // Имитация хэша на целевой сети
               const targetExplorerUrl = wallet.getExplorerUrl(currentBridgeQuote.toChain.chainId) + targetTxHash; // Ссылка на целевую сеть

              ui.showTransactionStatusModal(`Мост завершен на ${currentBridgeQuote.toChain.name}!`, targetTxHash, targetExplorerUrl);


               // TODO: ОПЦИОНАЛЬНО: Отправить информацию о завершении моста на бэкенд для Telegram уведомления
               // Например: utils.postData(`${utils.BACKEND_URL}/api/notify/bridge`, { wallet_address: account, from_tx_hash: receipt.transactionHash, to_tx_hash: targetTxHash, status: 'completed' });


               await updateCurrentBalances(); // Обновить баланс на исходной сети (уменьшился)
               // Баланс на целевой сети не обновится автоматически тут без специальной логики или WebSockets.

               // Очистить поля ввода и сбросить состояние
               ui.elements.bridgeFromAmount.value = '';
               ui.elements.bridgeToAmount.value = '';
               ui.updateBridgeDetails(null);
               ui.elements.approveBridgeBtn.classList.add('d-none');
               ui.elements.executeBridgeBtn.classList.add('d-none');
                currentBridgeQuote = null;

          }, 30000); // Имитация 30 секунд на мост (можно взять из currentBridgeQuote.estimatedTime если агрегатор дает число)
         // --- КОНЕЦ ЗАГЛУШКИ ---


    } catch (error) {
        console.error("Bridge execution failed:", error);
         let errorMessage = "Неизвестная ошибка выполнения моста.";
         let txHashForModal = null;

         if (error.code === 4001) {
             errorMessage = "Транзакция отклонена пользователем.";
         } else if (error.transactionHash) {
              // Ошибка первой транзакции на исходной сети
               errorMessage = `Транзакция на ${currentBridgeQuote.fromChain.name} не удалась: ${error.message || 'Проверьте в эксплорере'}`;
              txHashForModal = error.transactionHash;
         } else if (error.message) {
             errorMessage = `Ошибка: ${error.message.substring(0, 100)}...`;
         }

         ui.updateBridgeStatus(errorMessage);
          ui.showTransactionStatusModal(errorMessage, txHashForModal, txHashForModal ? wallet.getExplorerUrl(currentChainId) + txHashForModal : null); // Ссылка на эксплорер исходной сети

         // Очистить модалку через несколько секунд, если это ошибка пользователя
         if (error.code === 4001) {
              setTimeout(() => ui.hideTransactionStatusModal(), 5000);
         }

    } finally {
         ui.elements.executeBridgeBtn.disabled = false; // Включить кнопку
         ui.elements.approveBridgeBtn.disabled = false; // Включить апрув кнопку
    }
}

// Сброс состояния моста при смене сети или отключении кошелька
function resetState() {
    selectedFromChainId = null;
    selectedToChainId = null;
    selectedFromTokenBridge = null;
    selectedToTokenBridge = null;
    currentBridgeQuote = null;
    ui.elements.bridgeFromAmount.value = '';
    ui.elements.bridgeToAmount.value = '';
     // Сбрасываем текст кнопки выбора токена
    ui.elements.bridgeFromTokenBtn.innerHTML = 'Выберите Токен';
    ui.elements.bridgeToTokenBtn.innerHTML = 'Выберите Токен';

    ui.updateBridgeDetails(null); // Скрываем детали
    ui.updateBridgeStatus(""); // Очищаем статус
    ui.updateTokenBalanceDisplay('bridge-from-balance', null, 18); // Сбрасываем баланс
     ui.elements.approveBridgeBtn.classList.add('d-none'); // Скрываем кнопки
     ui.elements.executeBridgeBtn.classList.add('d-none');

     // Перезаполнить дропдауны сетей. Это также сбросит выбранные сети в UI и state
     populateNetworkSelects();

     // Обновляем балансы на всякий случай после сброса
     updateCurrentBalances();
}


// Экспорт функций (делаем их доступными в глобальной области под объектом bridge)
window.bridge = {
    populateNetworkSelects, // Экспортируем для инициализации из app.js и wallet.js
    handleNetworkChange, // Экспортируем для обработчика change
    handleTokenSelectClickBridge,
    handleGetBridgeQuote,
    handleApproveBridge,
    handleExecuteBridge,
    updateCurrentBalances, // Экспортируем для вызова из wallet.js
    resetState, // Экспортируем для вызова из wallet.js и app.js

     // Опционально: экспортировать переменные состояния
     selectedFromChainId: () => selectedFromChainId,
     selectedToChainId: () => selectedToChainId,
     selectedFromTokenBridge: () => selectedFromTokenBridge,
     selectedToTokenBridge: () => selectedToTokenBridge,
     currentBridgeQuote: () => currentBridgeQuote,
};