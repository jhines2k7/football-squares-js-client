let web3Provider;
let socket = null;
let contracts = {};
let accounts = [];
let web3 = null;
let playerId = null;
let gameIdH2 = null;
let playerIdH3 = null;
let gameNameH4 = null;
let gameId = null;

let heartbeatInterval;

// create a click event handler called claim square
// when a square is clicked, the user's address and the square's coordinates are sent to the server
// the server will then check if the square is available
// if it is, the server will send a transaction to the blockchain to claim the square
// if it is not, the server will send a message to the client that the square is not available
// the client will then display a message to the user that the square is not available
function claimSquare(event) {
  var row = event.target.getAttribute('data-row');
  var column = event.target.getAttribute('data-col');

  console.log('Clicked cell at row ' + row + ', col ' + column);

  event.target.textContent = playerId;
  event.target.removeEventListener('click', claimSquare);
  event.target.style.backgroundColor = 'yellow';

  socket.emit('claim_square', { row: row, column: column, player_id: playerId, game_id: gameId });
}

function selectTableCell(dataRow, dataColumn) {
  return document.querySelector(`td[data-row='${dataRow}'][data-col='${dataColumn}']`);
}

function generateGamesList(arr, ul) {
  // Loop through the array
  for (let i = 0; i < arr.length; i++) {
    // Create a new li for each item in the array
    let li = document.createElement('li');

    // Set the text content of the li to the name property of the current object
    li.textContent = arr[i].name;

    li.addEventListener('click', function () {
      joinGame(arr[i].game_id);
    });

    // Append the li to the ul
    ul.appendChild(li);
  }
}

function joinGame(gameId) {
  console.log("Clicked game with id: " + gameId);
  socket.emit('join_game', { game_id: gameId, player_id: playerId });
}

function registerSocketIOEventListeners() {
  socket.on('heartbeat_response', (data) => {
    console.log(`Heartbeat received: ${JSON.stringify(data)}`);
  });

  socket.on('connected', (data) => {
    console.log(`Player info: ${JSON.stringify(data.player)}`);
    console.log(`Games list: ${JSON.stringify(data.games_list)}`);
    const player = data.player;
    playerId = player.id;
    playerIdH3.textContent = `Player ID: ${playerId}`;

    generateGamesList(data.games_list, document.getElementById('games'));
  });

  socket.on('game_joined', (game) => {
    console.log(`Game joined: ${JSON.stringify(game)}`);
    gameId = game.id;
    gameIdH2.textContent = `Game ID: ${gameId}`;
    gameNameH4.textContent = `Game Name: ${game.name}`;
  });

  socket.on('square_claimed', (data) => {
    console.log(`Square claimed: ${JSON.stringify(data)}`);
    const cell = selectTableCell(data.row, data.column);
    cell.textContent = data.claimed_by;
    cell.removeEventListener('click', claimSquare);
    cell.style.backgroundColor = 'yellow';
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
    gameIdH2 = document.querySelector('#header h2');
    playerIdH3 = document.querySelector('#header h3');
    gameNameH4 = document.querySelector('#header h4');
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

        // Set data attributes for row and column numbers
        cell.setAttribute('data-row', i);
        cell.setAttribute('data-col', j);

        cell.addEventListener('click', claimSquare);

        row.appendChild(cell);
      }

      // Add the row to the table
      table.appendChild(row);
    }
    socket = io('http://67.205.128.30:8000',
      {
        transports: ['websocket']
      });

    registerSocketIOEventListeners();

    heartbeatInterval = setInterval(function () {
      socket.emit('heartbeat', { pulse: 'ping' })
    }, 20000); // Send heartbeat every 2 seconds
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
