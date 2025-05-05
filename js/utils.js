// js/utils.js

// URL вашего Python бэкенда FastAPI
const BACKEND_URL = 'http://127.0.0.1:8001'; // Убедитесь, что совпадает с портом, на котором работает FastAPI

// --- Вспомогательные функции ---

// Форматирование адреса (0x1234...abcd)
function formatAddress(address) {
    if (!address) return '';
    // Убедимся, что адрес выглядит как Ethereum-адрес перед форматированием
    if (typeof address !== 'string' || address.length !== 42 || !address.startsWith('0x')) return address; // Возвращаем исходный, если не похоже на адрес
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Форматирование суммы токена из BigNumber в строку с учетом десятичных знаков
function formatTokenAmount(amount, decimals, fixed = 4) {
     // Проверяем входные данные
     if (amount === undefined || amount === null || decimals === undefined || decimals === null) {
        return 'N/A';
    }
     // Если amount - строка или число, пытаемся преобразовать в BigNumber, если возможно, иначе используем как есть
      let amountBigNumber;
      try {
          if (typeof amount === 'string' || typeof amount === 'number') {
              // Пытаемся парсить как BigNumber, но ловим ошибку, если формат не подходит
              amountBigNumber = ethers.BigNumber.from(amount);
          } else if (ethers.BigNumber.isBigNumber(amount)) {
              amountBigNumber = amount;
          } else {
               console.warn("formatTokenAmount received non-BigNumber/non-string/non-number amount:", amount);
               return 'N/A';
          }
      } catch (e) {
          console.warn("Could not convert amount to BigNumber in formatTokenAmount:", amount, e);
          return 'Error'; // Не удалось преобразовать в BigNumber
      }


    try {
        // Проверяем, что decimals - число
        const numDecimals = parseInt(decimals, 10);
        if (isNaN(numDecimals) || numDecimals < 0) {
             console.error("Invalid decimals in formatTokenAmount:", decimals);
             return 'Error';
        }


        // Используем ethers.utils.formatUnits для перевода BigNumber в строку с плавающей точкой
        const etherAmountString = ethers.utils.formatUnits(amountBigNumber, numDecimals);

        // Используем toFixed для фиксированного числа знаков после запятой
        // parseFloat убирает лишние нули в конце, toFixed добавляет их
        // Можно использовать более продвинутые библиотеки для точного форматирования (например, decimal.js)
        const floatAmount = parseFloat(etherAmountString);
        if (isNaN(floatAmount)) return 'N/A';

        // toFixed может вернуть строку с избыточной точностью или округлить не совсем так, как ожидается
        // Для курсовой toFixed(fixed) обычно достаточно.
        return floatAmount.toFixed(fixed);

    } catch (error) {
        console.error("Error formatting amount:", error);
        return 'Error';
    }
}

// Парсинг суммы из строки ввода в BigNumber с учетом десятичных знаков токена
function parseTokenAmount(amountString, decimals) {
    if (amountString === undefined || amountString === null || amountString === '' || decimals === undefined || decimals === null) {
         return ethers.constants.Zero; // Возвращаем 0 в формате BigNumber для пустых/некорректных значений
    }
    try {
        // Проверяем, что строка ввода - число и больше или равно нулю
         const floatValue = parseFloat(amountString);
         if (isNaN(floatValue) || floatValue < 0) {
             throw new Error("Invalid or negative number format.");
         }
         // ethers.js parseUnits ожидает строку числа и количество десятичных знаков
        return ethers.utils.parseUnits(String(amountString), decimals);
    } catch (error) {
        console.error("Error parsing amount:", error);
        // В случае ошибки, бросаем ее дальше с более понятным сообщением
        throw new Error(`Некорректная сумма: ${error.message || ''}`); // Бросаем ошибку, чтобы ее обработать в вызывающем коде (swap/bridge)
    }
}


// Отправка POST запроса на бэкенд
async function postData(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        // Проверяем статус ответа
        if (!response.ok) {
            // Пытаемся прочитать детали ошибки из тела ответа бэкенда FastAPI
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error format' }));
            const errorMessage = errorData.detail || response.statusText || `HTTP error! Status: ${response.status}`;
            console.error(`Backend POST error to ${url}:`, response.status, errorData);
            throw new Error(errorMessage); // Бросаем ошибку с сообщением от бэкенда
        }
        // Пытаемся прочитать ответ в JSON, но если ответ пустой, возвращаем пустой объект
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error('Error posting data:', error);
        throw error; // Перебрасываем ошибку для обработки в вызывающем коде
    }
}

// Получение данных GET запросом
async function fetchData(url) {
    try {
        const response = await fetch(url);
         if (!response.ok) {
             // Пытаемся прочитать детали ошибки из тела ответа бэкенда FastAPI
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error format' }));
            const errorMessage = errorData.detail || response.statusText || `HTTP error! Status: ${response.status}`;
            console.error(`Backend GET error from ${url}:`, response.status, errorData);
            throw new Error(errorMessage); // Бросаем ошибку с сообщением от бэкенда
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

// Получение списка токенов с вашего бэкенда FastAPI
async function getTokenList(chainId) {
    if (!chainId) {
        console.error("Cannot fetch token list: chainId is null or undefined.");
        return [];
    }
    console.log("Fetching token list from backend for chainId:", chainId);
    try {
        const url = `${BACKEND_URL}/api/tokens/${chainId}`;
        const tokens = await fetchData(url);
        console.log(`Received ${tokens.length} tokens for chain ${chainId} from backend.`);
        // Убедимся, что у каждого токена есть logo_uri (можно предоставить дефолтный)
        return tokens.map(token => ({
            ...token,
            logo_uri: token.logo_uri || 'https://via.placeholder.com/20/007bff/fff?text=' + token.symbol[0] // Дефолтный лого
        }));
    } catch (error) {
        console.error(`Error fetching token list for chain ${chainId} from backend:`, error);
         // Возвращаем пустой список в случае ошибки, чтобы приложение не ломалось
        return [];
    }
}


// Получение баланса токена или нативной валюты
async function getTokenBalance(tokenAddress, walletAddress, provider, decimals) {
    if (!walletAddress || !provider || !tokenAddress) return ethers.constants.Zero;

    try {
        // Нормализация адреса токена (исключая 'NATIVE')
        const normalizedTokenAddress = tokenAddress.toLowerCase();

        if (normalizedTokenAddress === 'native') {
            // Баланс нативной валюты (ETH, MATIC и т.д.)
            return await provider.getBalance(walletAddress);
        } else {
            // Баланс ERC-20 токена
             // Проверяем, что адрес контракта валиден перед созданием контракта
             try {
                 ethers.utils.getAddress(tokenAddress); // Проверяем формат адреса
             } catch (e) {
                 console.error(`Invalid token address format for balance check: ${tokenAddress}`, e);
                 return ethers.constants.Zero;
             }
            const erc20Abi = [
                "function balanceOf(address account) view returns (uint256)"
            ];
            const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
            return await tokenContract.balanceOf(walletAddress);
        }
    } catch (error) {
        console.error(`Error fetching balance for ${tokenAddress} on chain ${provider?._network?.chainId || 'N/A'}:`, error);
        // Возвращаем 0 в формате BigNumber в случае ошибки, чтобы избежать ошибок в форматировании UI
        return ethers.constants.Zero;
    }
}


// Проверка разрешения (allowance) для ERC-20 токена
async function getTokenAllowance(tokenAddress, ownerAddress, spenderAddress, provider) {
     // Нативной валюте не нужен апрув, считаем разрешение максимальным
    if (!tokenAddress || tokenAddress.toLowerCase() === 'native' || !ownerAddress || !spenderAddress || !provider) {
        return ethers.constants.MaxUint256;
    }
     // Проверяем, что адреса валидны
     try {
         ethers.utils.getAddress(tokenAddress);
         ethers.utils.getAddress(ownerAddress);
         ethers.utils.getAddress(spenderAddress);
     } catch (e) {
          console.error(`Invalid address format for allowance check: ${e.message}`);
          return ethers.constants.Zero; // Возвращаем 0 в случае некорректных адресов
     }

    try {
        const erc20Abi = [
            "function allowance(address owner, address spender) view returns (uint256)"
        ];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        return await tokenContract.allowance(ownerAddress, spenderAddress);
    } catch (error) {
         console.error(`Error fetching allowance for ${tokenAddress} from ${ownerAddress} to ${spenderAddress}:`, error);
         return ethers.constants.Zero; // Возвращаем 0 в формате BigNumber в случае ошибки
    }
}

// Запрос разрешения (approve) для ERC-20 токена
async function approveToken(tokenAddress, spenderAddress, amount, signer) {
    if (!tokenAddress || tokenAddress.toLowerCase() === 'native' || !signer) {
        throw new Error("Cannot approve native currency or signer not available.");
    }
     // Проверяем, что адреса валидны
     try {
         ethers.utils.getAddress(tokenAddress);
         ethers.utils.getAddress(spenderAddress);
     } catch (e) {
          console.error(`Invalid address format for approve: ${e.message}`);
          throw new Error(`Некорректный адрес: ${e.message}`);
     }
      // Проверяем, что amount является BigNumber
     if (!ethers.BigNumber.isBigNumber(amount)) {
          console.error("Approve amount is not BigNumber:", amount);
          // Для апрува MaxUint256, можно обойти эту проверку, но лучше убедиться в типе
          if (amount === ethers.constants.MaxUint256) {
               // OK, MaxUint256 - это BigNumber
          } else {
               throw new Error("Внутренняя ошибка: некорректная сумма для апрува.");
          }
     }


    try {
        const erc20Abi = [
            // Использование MaxUint256 более удобно, чтобы не делать апрув при каждой сделке
            "function approve(address spender, uint256 amount) returns (bool)"
        ];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
        const tx = await tokenContract.approve(spenderAddress, amount);

        // Получаем Chain ID из signer, чтобы построить правильную ссылку на эксплорер
         const { chainId } = await signer.getChainId();
         const explorerUrl = wallet.getExplorerUrl(chainId);


        // Отображаем статус ожидания подтверждения транзакции
        ui.showTransactionStatusModal("Ожидание подтверждения разрешения...", tx.hash, explorerUrl + tx.hash);

        console.log("Approval transaction sent:", tx.hash);

        // Ждем подтверждения транзакции в блокчейне
        const receipt = await tx.wait();
        console.log("Approval transaction confirmed:", receipt);

        // Проверяем статус транзакции (поле `status` в receipt, 1 = успех, 0 = ошибка)
        if (receipt.status === 1) {
             ui.showTransactionStatusModal("Разрешение подтверждено!", receipt.transactionHash, explorerUrl + receipt.transactionHash);
        } else {
             // Транзакция была включена в блок, но выполнилась с ошибкой (reverted)
             ui.showTransactionStatusModal("Разрешение транзакции не удалось!", receipt.transactionHash, explorerUrl + receipt.transactionHash);
             throw new Error("Approval transaction failed on chain."); // Бросаем ошибку дальше
        }


        return receipt; // Возвращаем объект подтверждения

    } catch (error) {
        console.error(`Error approving token ${tokenAddress}:`, error);
         // Улучшенная обработка ошибок кошелька и транзакции
         let errorMessage = "Неизвестная ошибка при разрешении токена.";
         let txHashForModal = error.transactionHash || null; // Может быть хэш, даже если транзакция не удалась

         if (error.code === 4001) {
             errorMessage = "Транзакция отклонена пользователем.";
             txHashForModal = null; // Обычно нет хэша, если отклонено до отправки
         } else if (error.message) {
             errorMessage = `Ошибка: ${error.message.substring(0, 150)}...`; // Обрезаем длинные сообщения
              if (error.message.includes("insufficient funds")) {
                  errorMessage = "Недостаточно средств для оплаты газа.";
              }
               // Попытка найти revert reason в стандартных полях ошибки ethers
               if (error.data && error.data.message) {
                    errorMessage += ` Причина: ${error.data.message}`;
               } else if (error.reason) {
                    errorMessage += ` Причина: ${error.reason}`;
               }
         }

         // Получаем Chain ID из signer для построения ссылки, если signer доступен
         let explorerUrl = null;
         if (signer) {
              signer.getChainId().then(chainId => {
                  explorerUrl = wallet.getExplorerUrl(chainId);
                  // Обновляем модалку с ссылкой, если она уже открыта
                  // Или просто строим ссылку сразу, если txHashForModal есть
                  if (txHashForModal && explorerUrl) {
                      // ui.elements.transactionModalExplorerLink.href = explorerUrl + txHashForModal;
                      // ui.elements.transactionModalExplorerLink.classList.remove('d-none');
                  }
              }).catch(console.error);
         }


         ui.showTransactionStatusModal(errorMessage, txHashForModal, txHashForModal && explorerUrl ? explorerUrl + txHashForModal : null);

         // Очистить модалку через несколько секунд, если это ошибка пользователя или простая ошибка
         if (error.code === 4001 || !txHashForModal) { // Нет хэша => ошибка до отправки
              setTimeout(() => ui.hideTransactionStatusModal(), 5000);
         }


        throw error; // Перебрасываем ошибку для обработки в вызывающем коде (swap/bridge)
    }
}


// --- Экспорт функций ---
// Делаем объект utils доступным в глобальной области видимости
window.utils = {
    formatAddress,
    formatTokenAmount,
    parseTokenAmount,
    postData,
    fetchData,
    getTokenList, // Функция для получения списка токенов с бэкенда
    getTokenBalance,
    getTokenAllowance,
    approveToken,
    BACKEND_URL, // Экспортируем URL для использования в других модулях
};