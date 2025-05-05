let provider = null; // ethers.js Provider
let signer = null;   // ethers.js Signer (для подписания транзакций)
let currentAccount = null; // Адрес текущего аккаунта
let currentChainId = null; // ID текущей сети
let currentNetworkName = null; // Название текущей сети

// Список поддерживаемых сетей (Chain ID и название)
// Этот список должен соответствовать сетям, для которых у вас есть токены на бэкенде
const supportedNetworks = [
    { chainId: 1, name: 'Ethereum Mainnet', explorerUrl: 'https://etherscan.io/tx/' },
    { chainId: 5, name: 'Goerli Testnet', explorerUrl: 'https://goerli.etherscan.io/tx/' }, // Пример тестовой сети
    { chainId: 11155111, name: 'Sepolia Testnet', explorerUrl: 'https://sepolia.etherscan.io/tx/' }, // Новая тестовая сеть
    { chainId: 137, name: 'Polygon Mainnet', explorerUrl: 'https://polygonscan.com/tx/' },
    { chainId: 80001, name: 'Polygon Mumbai Testnet', explorerUrl: 'https://mumbai.polygonscan.com/tx/' }, // Тестовая сеть Polygon
    // Добавьте другие Chain ID, которые поддерживаются вашим приложением, агрегатором и кошельком
];

// Функция для получения URL эксплорера по Chain ID
function getExplorerUrl(chainId) {
    const network = supportedNetworks.find(n => n.chainId === chainId);
    return network ? network.explorerUrl : 'https://etherscan.io/tx/'; // Дефолт на Etherscan
}

async function connectWallet() {
    // Проверяем, установлен ли MetaMask (или другой Web3 провайдер)
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Запрашиваем доступ к аккаунтам
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length === 0) {
                 console.log("User denied account access.");
                 ui.updateWalletStatus(null);
                 return;
            }
            currentAccount = accounts[0];

            // Создаем провайдер из MetaMask
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();

            // Получаем текущую сеть
            const network = await provider.getNetwork();
            currentChainId = network.chainId;
            currentNetworkName = network.name; // ethers.js может давать generic names

             // Находим название сети из нашего списка, если есть
             const networkConfig = supportedNetworks.find(n => n.chainId === currentChainId);
             if (networkConfig) {
                 currentNetworkName = networkConfig.name;
             } else {
                 // Если сеть не поддерживается, предупреждаем пользователя
                 alert(`Сеть с ID ${currentChainId} (${currentNetworkName}) не поддерживается приложением. Пожалуйста, переключитесь на поддерживаемую сеть (например, Ethereum Mainnet, Polygon Mainnet).`);
                 // Можно сбросить подключение или оставить пользователя на этой сети, но заблокировать функции
                 ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId); // Обновить статус, но UI будет заблокирован
                 ui.updateUIState(false); // Заблокировать UI, так как сеть не поддерживается
                 return; // Выходим, не продолжая инициализацию функций
             }


            console.log("Wallet connected:", currentAccount, "Chain ID:", currentChainId, "Network:", currentNetworkName);

            // Обновляем UI
            ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);

            // Обновить состояние UI (разблокировать формы)
             ui.updateUIState(true);

             // Инициализация данных для активной вкладки после подключения
             // Определяем, какая вкладка активна
             const activeTab = document.querySelector('.tab-pane.active');
             if (activeTab) {
                 const tabId = activeTab.id.replace('-tab', ''); // swap, bridge, telegram
                 if (tabId === 'swap') {
                     swap.updateCurrentBalances();
                     // Обновить статус UI в зависимости от выбранных токенов
                      ui.updateSwapStatus(swap.selectedFromToken && swap.selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
                 } else if (tabId === 'bridge') {
                      // populateNetworkSelects уже вызывается в app.js при загрузке
                     bridge.updateCurrentBalances(); // Обновить балансы для bridge
                     // Обновить статус UI
                      ui.updateBridgeStatus(bridge.selectedFromTokenBridge && bridge.selectedToTokenBridge ? "Нажмите 'Найти лучший путь'" : "Выберите сети и токены");
                 } else if (tabId === 'telegram') {
                      telegram.checkTelegramStatus(); // Проверить статус телеграм для текущего аккаунта
                 }
             }


        } catch (error) {
            console.error("Error connecting wallet:", error);
             // Улучшенная обработка ошибок подключения кошелька
             let errorMessage = "Неизвестная ошибка подключения кошелька.";
             if (error.code === 4001) {
                 errorMessage = "Подключение отклонено пользователем.";
             } else if (error.message) {
                 errorMessage = `Ошибка: ${error.message}`;
             }
            alert(errorMessage);

            // Сброс состояния при ошибке
             currentAccount = null;
             currentChainId = null;
             currentNetworkName = null;
             provider = null;
             signer = null;
             ui.updateWalletStatus(null);
             ui.updateUIState(false); // Заблокировать UI
        }
    } else {
        alert('MetaMask или другой Web3 провайдер не обнаружен. Пожалуйста, установите его.');
        ui.updateWalletStatus(null);
        ui.updateUIState(false); // Заблокировать UI
    }
}

function disconnectWallet() {
     // В большинстве провайдеров нет стандартного метода "disconnect" со стороны dapp
     // Просто сбрасываем состояние приложения на фронтенде
    currentAccount = null;
    currentChainId = null;
    currentNetworkName = null;
    provider = null;
    signer = null;
    console.log("Wallet disconnected (frontend state reset)");

     // Обновляем UI
    ui.updateWalletStatus(null);
     // Обновить состояние UI (заблокировать формы)
     ui.updateUIState(false);

     // Сбросить состояние specific tabs
     swap.resetState();
     bridge.resetState();
     telegram.resetState(); // Сбросить статус телеграм
}

// Функция для запроса переключения сети в кошельке
async function switchChain(chainId) {
     if (typeof window.ethereum === 'undefined' || !chainId) {
         console.error("MetaMask is not installed or invalid chainId.");
         return false;
     }
     try {
         // Ethers.js v5: провайдер имеет доступ к request через _provider
         await window.ethereum.request({
             method: 'wallet_switchEthereumChain',
             params: [{ chainId: '0x' + chainId.toString(16) }], // Chain ID должен быть в Hex
         });
         // Событие 'chainChanged' сработает автоматически и обновит состояние в dapp
         console.log(`Requested switch to chain ID: ${chainId}`);
         return true;
     } catch (error) {
         console.error(`Failed to switch to chain ID ${chainId}:`, error);
         // Код 4902 означает, что сеть не добавлена в MetaMask, предлагаем добавить
         if (error.code === 4902) {
              alert(`Сеть с ID ${chainId} не добавлена в ваш кошелек. Пожалуйста, добавьте ее вручную.`);
              // В более сложном приложении можно предложить добавить сеть программно
              // await addEthereumChain(chainId); // Нужна функция добавления сети
         } else if (error.code === 4001) {
              alert("Запрос на переключение сети отклонен пользователем.");
         } else {
              alert(`Ошибка при переключении сети: ${error.message}`);
         }
         return false;
     }
}

// TODO: Добавить функцию addEthereumChain(chainId) для программного добавления сети (опционально для курсовой)


// --- Обработчики событий от Web3 провайдера (MetaMask) ---
// Эти обработчики должны быть установлены ОДИН РАЗ при загрузке страницы

if (typeof window.ethereum !== 'undefined') {
     // Событие при смене аккаунта в кошельке
    window.ethereum.on('accountsChanged', (accounts) => {
        console.log("MetaMask accounts changed:", accounts);
        if (accounts.length === 0) {
            // Пользователь отключил все аккаунты от сайта в MetaMask
            console.log("MetaMask accounts disconnected.");
            disconnectWallet(); // Сбрасываем состояние приложения
        } else {
            // Аккаунт изменился (например, пользователь выбрал другой аккаунт в MetaMask)
            currentAccount = accounts[0];
            console.log("MetaMask account changed to:", currentAccount);
            // Обновляем провайдера и signer, т.к. аккаунт изменился
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
             // UI обновится через chainChanged или принудительно обновить статус
            ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);

             // Обновить данные для текущей активной вкладки с новым аккаунтом
             const activeTab = document.querySelector('.tab-pane.active');
             if (activeTab) {
                 const tabId = activeTab.id.replace('-tab', '');
                 if (tabId === 'swap') {
                     swap.updateCurrentBalances();
                 } else if (tabId === 'bridge') {
                      bridge.updateCurrentBalances();
                 } else if (tabId === 'telegram') {
                      telegram.checkTelegramStatus();
                 }
             }
        }
    });

     // Событие при смене сети в кошельке
    window.ethereum.on('chainChanged', async (chainIdHex) => {
         const newChainId = parseInt(chainIdHex, 16); // Chain ID приходит в Hex
         console.log("MetaMask chain changed to:", newChainId);

         // Обновляем провайдера и signer для новой сети
         provider = new ethers.providers.Web3Provider(window.ethereum);
         signer = provider.getSigner();
         const network = await provider.getNetwork();
         currentChainId = newChainId;
         currentNetworkName = network.name;

          // Находим название сети из нашего списка, если есть
          const networkConfig = supportedNetworks.find(n => n.chainId === currentChainId);
          if (networkConfig) {
              currentNetworkName = networkConfig.name;
              // Сеть поддерживается - разблокируем UI
              ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId);
              ui.updateUIState(!!currentAccount); // Разблокировать, если аккаунт подключен
          } else {
              // Сеть не поддерживается - блокируем UI
              alert(`Сеть с ID ${currentChainId} (${currentNetworkName}) не поддерживается приложением. Пожалуйста, переключитесь на поддерживаемую сеть.`);
              ui.updateWalletStatus(currentAccount, currentNetworkName, currentChainId); // Обновить статус, но UI будет заблокирован
              ui.updateUIState(false); // Заблокировать UI
          }

         // Сбросить и обновить данные для новой сети
         swap.resetState(); // Сбросить состояние свапа при смене сети
         bridge.resetState(); // Сбросить состояние моста
         telegram.resetState(); // Сбросить статус телеграм

         // Обновить данные для текущей активной вкладки
          const activeTab = document.querySelector('.tab-pane.active');
          if (activeTab) {
              const tabId = activeTab.id.replace('-tab', '');
              if (tabId === 'swap') {
                  // swap.updateCurrentBalances() вызывается в resetState()
                  ui.updateSwapStatus(swap.selectedFromToken && swap.selectedToToken ? "Нажмите 'Получить курс'" : "Выберите токены и сумму");
              } else if (tabId === 'bridge') {
                   bridge.populateNetworkSelects(); // Перезаполнить дропдауны сетей
                   // bridge.updateCurrentBalances() вызывается в resetState()
                   ui.updateBridgeStatus(bridge.selectedFromTokenBridge && bridge.selectedToTokenBridge ? "Нажмите 'Найти лучший путь'" : "Выберите сети и токены");
              } else if (tabId === 'telegram') {
                   // telegram.checkTelegramStatus() вызывается в resetState()
              }
          }

    });

    // Событие при отключении кошелька (не всегда надежно срабатывает со стороны DApp)
    window.ethereum.on('disconnect', (error) => {
         console.log("MetaMask disconnected (event)");
         console.error(error);
         disconnectWallet(); // Принудительно сбрасываем состояние
    });

} else {
    console.warn("MetaMask not detected. Wallet features will not be available.");
}


// --- Геттеры для доступа к состоянию из других модулей ---
// Делаем их глобальными для простоты Vanilla JS
window.wallet = {
    connectWallet,
    disconnectWallet,
    getAccount: () => currentAccount, // Возвращаем текущий аккаунт
    getProvider: () => provider,     // Возвращаем текущий провайдер
    getSigner: () => signer,       // Возвращаем текущий signer
    getChainId: () => currentChainId,   // Возвращаем текущий chain ID
    getSupportedNetworks: () => supportedNetworks, // Возвращаем список поддерживаемых сетей
     getExplorerUrl, // Экспортируем функцию получения URL эксплорера
     switchChain, // Экспортируем функцию переключения сети (опционально)
};