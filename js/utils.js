// js/utils.js

// URL вашего Python бэкенда
const BACKEND_URL = 'http://127.0.0.1:8001'; // Убедитесь, что совпадает с портом FastAPI
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


// --- Вспомогательные функции ---

function formatAddress(address) {
    if (!address || typeof address !== 'string' || address.length < 10) return address || '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function formatTokenAmount(amount, decimals, fixed = 4) {
     if (amount === undefined || amount === null || decimals === undefined || decimals === null) {
        return 'N/A';
    }
    try {
        const isBigNumber = ethers.BigNumber.isBigNumber(amount);
        // Если это не BigNumber, но строка или число, пытаемся его использовать
        const amountToFormat = isBigNumber ? amount : ethers.BigNumber.from(String(amount));
        const etherAmount = ethers.utils.formatUnits(amountToFormat, decimals);
        const floatAmount = parseFloat(etherAmount);
        if (isNaN(floatAmount)) return 'N/A';
        return floatAmount.toFixed(fixed);
    } catch (error) {
        // console.error("Error formatting amount:", error, "Amount:", amount, "Decimals:", decimals);
        return String(amount); // Возвращаем как есть, если ошибка форматирования
    }
}

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
        throw new Error(`Некорректная сумма. Проверьте формат.`);
    }
}

async function postData(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error reading error response' }));
            const errorMessage = errorData.detail || response.statusText || 'Unknown error';
            console.error(`HTTP POST error to ${url}: Status ${response.status}, Detail: ${errorMessage}`);
            throw new Error(`Ошибка сервера (${response.status}): ${errorMessage}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error('Error posting data:', error);
        throw error;
    }
}

async function fetchData(url) {
    try {
        const response = await fetch(url);
         if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error reading error response' }));
             const errorMessage = errorData.detail || response.statusText || 'Unknown error';
             console.error(`HTTP GET error to ${url}: Status ${response.status}, Detail: ${errorMessage}`);
            throw new Error(`Ошибка сервера (${response.status}): ${errorMessage}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

async function getTokenList(chainId) {
    if (!chainId) {
        console.error("Cannot fetch token list: chainId is null or undefined.");
        return [];
    }
    console.log(`Fetching token list from backend for chainId: ${chainId}...`);
    try {
        const url = `${BACKEND_URL}/api/tokens/${chainId}`;
        const tokens = await fetchData(url);
        console.log(`Received ${tokens.length} tokens for chain ${chainId} from backend.`);
        return tokens.map(token => ({
            ...token,
            address: token.address === '0x0000000000000000000000000000000000000000' ? 'NATIVE' : token.address, // Для внутреннего использования 'NATIVE' удобнее
            logo_uri: token.logo_uri && typeof token.logo_uri === 'string' && token.logo_uri.startsWith('http')
                      ? token.logo_uri
                      : (token.logo_uri && typeof token.logo_uri === 'string' && token.logo_uri.startsWith('/static/'))
                          ? `${BACKEND_URL}${token.logo_uri}`
                          : `https://via.placeholder.com/24/007bff/fff?text=${token.symbol ? token.symbol[0].toUpperCase() : '?'}`
        }));
    } catch (error) {
        console.error(`Error fetching token list for chain ${chainId} from backend:`, error);
        return [];
    }
}

async function getTokenBalance(tokenAddress, walletAddress, provider, decimals) {
    if (!walletAddress || !provider) return ethers.constants.Zero;
    try {
        if (tokenAddress.toUpperCase() === 'NATIVE' || tokenAddress === ZERO_ADDRESS) {
            return await provider.getBalance(walletAddress);
        } else {
             try { ethers.utils.getAddress(tokenAddress); } catch (e) {
                 console.error(`Invalid token address format for balance check: ${tokenAddress}`, e);
                 return ethers.constants.Zero;
             }
            const erc20Abi = ["function balanceOf(address account) view returns (uint256)"];
            const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
            return await tokenContract.balanceOf(walletAddress);
        }
    } catch (error) {
        console.error(`Error fetching balance for ${tokenAddress} on chain ${provider?._network?.chainId || 'N/A'}:`, error);
        return ethers.constants.Zero;
    }
}

// Эти функции могут быть менее востребованы, т.к. approve будет частью executeSwap/Bridge
async function getTokenAllowance(tokenAddress, ownerAddress, spenderAddress, provider) {
    if (tokenAddress.toUpperCase() === 'NATIVE' || tokenAddress === ZERO_ADDRESS || !ownerAddress || !spenderAddress || !provider) {
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
        const erc20Abi = ["function allowance(address owner, address spender) view returns (uint256)"];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        return await tokenContract.allowance(ownerAddress, spenderAddress);
    } catch (error) {
         console.error(`Error fetching allowance for ${tokenAddress}:`, error);
         return ethers.constants.Zero;
    }
}

async function approveToken(tokenAddress, spenderAddress, amount, signer) {
    if (tokenAddress.toUpperCase() === 'NATIVE' || tokenAddress === ZERO_ADDRESS || !signer) {
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
        const erc20Abi = ["function approve(address spender, uint256 amount) returns (bool)"];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
        const tx = await tokenContract.approve(spenderAddress, amount);
        const currentChainId = await signer.getChainId();
        ui.showTransactionStatusModal("Ожидание подтверждения разрешения...", tx.hash, wallet.getExplorerUrl(currentChainId) + tx.hash);
        const receipt = await tx.wait();
        ui.showTransactionStatusModal("Разрешение подтверждено!", receipt.transactionHash, wallet.getExplorerUrl(currentChainId) + receipt.transactionHash);
        return receipt;
    } catch (error) {
        console.error(`Error approving token ${tokenAddress}:`, error);
         let errorMessage = "Неизвестная ошибка при разрешении токена.";
         if (error.code === 4001) errorMessage = "Транзакция отклонена пользователем.";
         else if (error.message) errorMessage = `Ошибка: ${error.message.substring(0, 100)}...`;
         ui.showTransactionStatusModal(errorMessage, error.transactionHash, error.transactionHash ? wallet.getExplorerUrl(error.chain?.id || wallet.getChainId()) + error.transactionHash : null);
         if (error.code === 4001) setTimeout(() => ui.hideTransactionStatusModal(), 5000);
        throw error;
    }
}

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
    ZERO_ADDRESS,
};