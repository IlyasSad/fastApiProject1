// js/utils.js

// URL вашего Python бэкенда
const BACKEND_URL = 'http://127.0.0.1:8001'; // Убедитесь, что совпадает с портом, на котором работает FastAPI

// --- Вспомогательные функции ---

// Форматирование адреса (0x1234...abcd)
function formatAddress(address) {
    if (!address) return '';
    if (typeof address !== 'string' || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Форматирование суммы токена с учетом десятичных знаков
function formatTokenAmount(amount, decimals, fixed = 4) {
     if (amount === undefined || amount === null || decimals === undefined || decimals === null) {
        return 'N/A';
    }
    try {
        const isBigNumber = ethers.BigNumber.isBigNumber(amount);
        const etherAmount = isBigNumber ? ethers.utils.formatUnits(amount, decimals) : String(amount);

        const floatAmount = parseFloat(etherAmount);
        if (isNaN(floatAmount)) return 'N/A';

        // Ограничиваем число знаков после запятой, но избегаем обрезания значимых нулей в конце, если fixed большое
        // Можно использовать более сложные форматеры, но для курсовой toFixed достаточно
        return floatAmount.toFixed(fixed);

    } catch (error) {
        console.error("Error formatting amount:", error);
        return 'Error';
    }
}

// Парсинг суммы из строки ввода в BigNumber с учетом десятичных знаков токена
function parseTokenAmount(amountString, decimals) {
    if (amountString === undefined || amountString === null || amountString === '' || decimals === undefined || decimals === null) {
         return ethers.constants.Zero;
    }
    try {
         if (isNaN(parseFloat(amountString))) {
             throw new Error("Invalid number format");
         }
        return ethers.utils.parseUnits(String(amountString), decimals);
    } catch (error) {
        console.error("Error parsing amount:", error);
        throw new Error("Некорректная сумма токена.");
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
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(`HTTP error! Status: ${response.status}, Detail: ${errorData.detail || response.statusText}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error('Error posting data:', error);
        throw error;
    }
}

// Получение данных GET запросом
async function fetchData(url) {
    try {
        const response = await fetch(url);
         if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(`HTTP error! Status: ${response.status}, Detail: ${errorData.detail || response.statusText}`);
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
        console.error("Cannot fetch token list: chainId is null.");
        return [];
    }
    console.log("Fetching token list from backend for chainId:", chainId);
    try {
        const url = `${BACKEND_URL}/api/tokens/${chainId}`;
        const tokens = await fetchData(url);
        console.log(`Received ${tokens.length} tokens for chain ${chainId} from backend.`);
        return tokens.map(token => ({
            ...token,
            logo_uri: token.logo_uri || 'https://via.placeholder.com/20/007bff/fff?text=' + (token.symbol ? token.symbol[0] : 'T')
        }));
    } catch (error) {
        console.error(`Error fetching token list for chain ${chainId} from backend:`, error);
        return [];
    }
}


// Получение баланса токена или нативной валюты
async function getTokenBalance(tokenAddress, walletAddress, provider, decimals) {
    if (!walletAddress || !provider) return ethers.constants.Zero;

    try {
        if (tokenAddress.toLowerCase() === 'native') { // Проверяем без учета регистра
            return await provider.getBalance(walletAddress);
        } else {
             try {
                 ethers.utils.getAddress(tokenAddress); // Валидация адреса
             } catch (e) {
                 console.error(`Invalid token address format: ${tokenAddress}`, e);
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
        return ethers.constants.Zero;
    }
}

// Проверка разрешения (allowance) для ERC-20 токена
async function getTokenAllowance(tokenAddress, ownerAddress, spenderAddress, provider) {
    if (tokenAddress.toLowerCase() === 'native' || !ownerAddress || !spenderAddress || !provider) {
        return ethers.constants.MaxUint256;
    }
     try {
         ethers.utils.getAddress(tokenAddress);
         ethers.utils.getAddress(ownerAddress);
         ethers.utils.getAddress(spenderAddress);
     } catch (e) {
          console.error(`Invalid address format for allowance check: ${e.message}`);
          return ethers.constants.Zero;
     }

    try {
        const erc20Abi = [
            "function allowance(address owner, address spender) view returns (uint256)"
        ];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        return await tokenContract.allowance(ownerAddress, spenderAddress);
    } catch (error) {
         console.error(`Error fetching allowance for ${tokenAddress} from ${ownerAddress} to ${spenderAddress}:`, error);
         return ethers.constants.Zero;
    }
}

// Запрос разрешения (approve) для ERC-20 токена
async function approveToken(tokenAddress, spenderAddress, amount, signer) {
    if (tokenAddress.toLowerCase() === 'native' || !signer) {
        throw new Error("Cannot approve native currency or signer not available.");
    }
     try {
         ethers.utils.getAddress(tokenAddress);
         ethers.utils.getAddress(spenderAddress);
     } catch (e) {
          console.error(`Invalid address format for approve: ${e.message}`);
          throw new Error(`Некорректный адрес: ${e.message}`);
     }
      if (!ethers.BigNumber.isBigNumber(amount)) {
          console.error("Approve amount is not BigNumber:", amount);
          throw new Error("Внутренняя ошибка: некорректная сумма для апрува.");
     }

    try {
        const erc20Abi = [
            "function approve(address spender, uint256 amount) returns (bool)"
        ];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

        // Определяем explorerUrl для текущей сети signer'а
        const chainId = await signer.getChainId();
        const explorerUrl = wallet.getExplorerUrl(chainId); // Используем wallet.getExplorerUrl

        const tx = await tokenContract.approve(spenderAddress, amount);

        ui.showTransactionStatusModal("Ожидание подтверждения разрешения...", tx.hash, explorerUrl ? explorerUrl + tx.hash : null);

        console.log("Approval transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("Approval transaction confirmed:", receipt);

         ui.showTransactionStatusModal("Разрешение подтверждено!", receipt.transactionHash, explorerUrl ? explorerUrl + receipt.transactionHash : null);

        return receipt;
    } catch (error) {
        console.error(`Error approving token ${tokenAddress}:`, error);
         let errorMessage = "Неизвестная ошибка при разрешении токена.";
         if (error.code === 4001) {
             errorMessage = "Транзакция отклонена пользователем.";
         } else if (error.message) {
             errorMessage = `Ошибка: ${error.message.substring(0, 100)}...`;
         }
         const chainId = signer ? await signer.getChainId().catch(() => null) : null;
         const explorerUrl = chainId ? wallet.getExplorerUrl(chainId) : null;


         ui.showTransactionStatusModal(errorMessage, error.transactionHash, error.transactionHash && explorerUrl ? explorerUrl + error.transactionHash : null);

         if (error.code === 4001) {
              setTimeout(() => ui.hideTransactionStatusModal(), 5000);
         }

        throw error;
    }
}

// Экспорт функций
window.utils = {
    formatAddress,
    formatTokenAmount,
    parseTokenAmount,
    postData,
    fetchData,
    getTokenList,
    getTokenBalance,
    getTokenAllowance,
    approveToken,
    BACKEND_URL,
};