let web3Provider;
let socket = null;
let contracts = {};
let accounts = [];
let web3 = null;
let gameIdH2 = null;
let playerIdH3 = null;
let gameNameH4 = null;
let gameId = null;
// let playerList = null;

let heartbeatInterval;

const domain = 'http://146.190.72.89:8000';

const playerId = saveGUIDToCookie();

function saveGUIDToCookie() {
  // Check if a GUID already exists in the cookie
  let guid = document.cookie.split('; ').find(row => row.startsWith('guid='));

  // If a GUID exists, split the string to get the value
  if (guid) {
    guid = guid.split('=')[1];
  } else {
    // If a GUID doesn't exist, generate a new one
    guid = generateGUID();

    // Save the new GUID to the cookie
    // This cookie expires in 1 year
    let date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    document.cookie = `guid=${guid}; expires=${date.toUTCString()}; path=/`;
  }

  return guid;
}

function generateGUID() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
};

function clearGUIDCookie() {
  // Set the GUID cookie to expire immediately
  document.cookie = "guid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// create a click event handler called claim square
// when a square is clicked, the user's address and the square's coordinates are sent to the server
// the server will then check if the square is available
// if it is, the server will send a transaction to the blockchain to claim the square
// if it is not, the server will send a message to the client that the square is not available
// the client will then display a message to the user that the square is not available
function claimSquare(event) {
  clearInterval(heartbeatInterval);

  var row = event.target.getAttribute('data-row');
  var column = event.target.getAttribute('data-col');

  console.log('Clicked cell at row ' + row + ', col ' + column);

  event.target.textContent = playerId;
  event.target.removeEventListener('click', claimSquare);
  event.target.style.backgroundColor = 'yellow';

  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(function () {
      socket.emit('heartbeat', { player_id: playerId, ping: 'ping' })
    }, 20000); // Send heartbeat every 20 seconds
  }

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
  
  // create the squares grid
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

  const gamesList = document.getElementById('games');
  gamesList.remove();

  // display the player list
  const playersDiv = document.getElementById('players');
  playersDiv.style.display = 'block';
}

function loadTemplate(name, element) {
  fetch(name)
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
  .then(data => {
      // document.getElementById('test').innerHTML = data;
      element.innerHTML = data;
  })
  .catch(error => {
    console.log('There has been a problem with your fetch operation: ', error);
  });
}

function registerSocketIOEventListeners() {
  socket.on('heartbeat_response', (data) => {
    console.log(`Heartbeat received: ${JSON.stringify(data)}`);
  });

  socket.on('connected', (data) => {
    console.log(`Player info: ${JSON.stringify(data.player)}`);
    console.log(`Games list: ${JSON.stringify(data.games_list)}`);
    const player = data.player;
    playerIdH3.textContent = `Player ID: ${player.player_id}`;

    generateGamesList(data.games_list, document.getElementById('games'));
  });

  socket.on('game_joined', (game) => {
    console.log(`Game joined: ${JSON.stringify(game)}`);
    gameId = game.game_id;
    gameIdH2.textContent = `Game ID: ${gameId}`;
    gameNameH4.textContent = `Game Name: ${game.name}`;

    // mark claimed squares
    const claimedSquares = game.claimed_squares;
    for(const [key, value] of Object.entries(claimedSquares)) {
      console.log(value);
      const claimedBy = value;
      let [row, column] = key.split('');
      const cell = selectTableCell(row, column);
      cell.textContent = claimedBy;
      cell.removeEventListener('click', claimSquare);
      cell.style.backgroundColor = 'yellow';
    }

    // display players
    const players = game.players;
    let playerList = document.getElementById('player-list');
    
    for (const player in players) {
      if(players[player].player_id !== playerId) {
        let newPlayerLi = document.createElement('li');
        newPlayerLi.textContent = players[player].player_id;
        playerList.appendChild(newPlayerLi);
      }
    }
  });

  socket.on('square_claimed', (data) => {
    console.log(`Square claimed: ${JSON.stringify(data)}`);
    const cell = selectTableCell(data.row, data.column);
    cell.textContent = data.claimed_by;
    cell.removeEventListener('click', claimSquare);
    cell.style.backgroundColor = 'yellow';
  });

  socket.on('new_player_joined', (player) => {
    console.log(`New player joined: ${JSON.stringify(player)}`);
    const newPlayer = player;

    let playerList = document.getElementById('player-list');
    let newPlayerLi = document.createElement('li');
    newPlayerLi.textContent = newPlayer.player_id;
    playerList.appendChild(newPlayerLi);
  });
}

async function dollarsToEthereum(dollars) {
  try {
    const ethInUSD = await getEthereumPrice();
    let ethInUsd = dollars / ethInUSD;
    console.log(`The value of $${dollars} in ETH is: ${ethInUsd}`);
    return ethInUsd;
  } catch (err) {
    return console.log(err);
  }
}

async function getEthereumPrice() {
  return fetch(`${domain}/ethereum-price?game_id=${gameId}`)
    .then(response => response.json())
    .then(data => {
      console.log(`The gas oracle is ${data}`)
      return data;
    })
    .catch(error => {
      console.error(`Error: ${error}`);
    });
}

async function getGasOracle() {
  return fetch(`${domain}/gas-oracle?game_id=${gameId}`)
    .then(response => response.json())
    .then(data => {
      console.log(`Gas oracle: ${data.result}`)
      return data.result;
    })
    .catch(error => {
      console.error(`Error: ${error}`);
    });
}

async function loadContractABI() {
  return fetch(`${domain}/fs-contract-abi`)
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

document.addEventListener('DOMContentLoaded', () => {
  gameIdH2 = document.querySelector('#header h2');
  playerIdH3 = document.querySelector('#header h3');
  gameNameH4 = document.querySelector('#header h4');
  
  socket = io(domain,
    {
      transports: ['websocket'],
      query: {
        player_id: playerId,
      }
    });

  registerSocketIOEventListeners();
});
