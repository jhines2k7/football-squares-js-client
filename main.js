let web3Provider;
let socket = null;
let contracts = {};
let accounts = [];
let web3 = null;

// create a click event handler called claim square
// when a square is clicked, the user's address and the square's coordinates are sent to the server
// the server will then check if the square is available
// if it is, the server will send a transaction to the blockchain to claim the square
// if it is not, the server will send a message to the client that the square is not available
// the client will then display a message to the user that the square is not available
function claimSquare(event) {
  event.target.textContent = "";
}

function registerSocketIOEventListeners() {
  socket.on('heartbeat_response', (data) => {
    console.log(`Heartbeat received: ${JSON.stringify(data)}`);
  });
}

async function dollarsToEthereum(dollars) {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    let ethInUsd = dollars / data.ethereum.usd;
    console.log(`The value of $${dollars} in ETH is: ${ethInUsd}`);
    return ethInUsd;
  } catch (err) {
    return console.log(err);
  }
}

async function loadContractABI() {
  return fetch("https://fsdev.generalsolutions43.com/rps-contract-abi")
    .then(response => response.json())
    .then(data => {
      // Use the loaded JSON data here
      console.log(`The RPSContract ABI is ${data.abi}`)
      return data;
    })
    .catch(error => {
      // Handle any potential errors
      console.error(`Error: ${error}`);
    });
}

async function getEtherPriceInUSD() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum.usd;
  } catch (err) {
    console.error(`An error occurred: ${err}`);
  }
}

async function convertUsdToEther(amountInUsd) {
  const priceOfEtherInUsd = await getEtherPriceInUSD();
  const amountInEther = amountInUsd / priceOfEtherInUsd;
  return amountInEther;
}

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    /*
        while (!window.ethereum) {
          console.log('Waiting for MetaMask...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
    
        // Request access to user's MetaMask accounts
        await window.ethereum.request({ method: 'eth_requestAccounts' })
    
        web3 = new Web3(window.ethereum);
    
        // Use web3.js
        accounts = await web3.eth.getAccounts();
    
        console.log(`Your accounts: ${accounts}`);
    */
    var table = document.getElementById('squares-grid');

    // Outer loop to create rows
    for (var i = 0; i < 10; i++) {
      var row = document.createElement('tr');

      // Inner loop to create cells
      for (var j = 0; j < 10; j++) {
        var cell = document.createElement('td');
        cell.textContent = 'Cell'; // Set content of the cell

        cell.addEventListener('click', claimSquare);

        row.appendChild(cell);
      }

      // Add the row to the table
      table.appendChild(row);
    }
    /*
        if(typeof accounts[0] !== 'undefined') {
          socket = io('https://fsdev.generalsolutions43.com',
          {
            transports: ['websocket'],
            query: {
              address: accounts[0]
            }
          });
    
          registerSocketIOEventListeners();
        }
    */
  })();
});
