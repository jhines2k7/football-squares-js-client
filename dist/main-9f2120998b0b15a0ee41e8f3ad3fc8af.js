let web3Provider;
let socket = null;
let contracts = {};
let accounts = [];
let web3 = null;
let gameIdH2 = null;
let playerIdH3 = null;
let gameNameH4 = null;
let GAME_ID = null;
let PLAYER_CLAIMED_SQUARES = {};
const GRADIENT_COLORS = generateColorGradient();
let CURRENT_COLOR_IDX = 0;
const USD_PER_SQUARE = 20.00
let CONTRACT_ADDRESS = "0x40c6019F6D7b3328c3d0d3B49DD661FAc07c26F6";
let PLAYER_NONCE = "";

let heartbeatInterval;

const domain = 'https://fs.generalsolutions43.com';

const router = new Navigo('/', { hash: true });

function createIdenticon(hashValue, size) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttributeNS(null, "width", size);
  svg.setAttributeNS(null, "height", size);
  svg.setAttributeNS(null, "data-jdenticon-value", hashValue);
  return svg;
}

function appendIdenticon(hashValue, size, targetElement) {
  var identicon = createIdenticon(hashValue, size);
  document.querySelector(targetElement).appendChild(identicon);
  jdenticon.update(identicon);
}

function getPlayerId() {
  // Check if a GUID already exists in the cookie
  let guid = document.cookie.split('; ').find(row => row.startsWith('guid='));

  // If a GUID exists, split the string to get the value
  if (guid) {
    guid = guid.split('=')[1];
  } else {
    // If a GUID doesn't exist, generate a new one
    guid = generateGUID();

    // Save the new GUID and level to the cookie
    // This cookie expires in 1 year
    let date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    document.cookie = `guid=${guid}; level=1; expires=${date.toUTCString()}; path=/`;
  }

  return guid;
}

function generateGUID() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
};

function clearGUIDCookie() {
  document.cookie = "guid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function getCellPlayerId(cell) {
  return cell.firstChild.getAttribute('data-jdenticon-value');
}

function claimSquare(event) {
  const playerId = getPlayerId();
  const row = event.currentTarget.getAttribute('data-row');
  const column = event.currentTarget.getAttribute('data-col');
  const gameId = event.currentTarget.getAttribute('data-game-id');
  const weekId = event.currentTarget.getAttribute('data-week-id');

  console.log('Clicked cell at row ' + row + ', col ' + column);

  const cell = selectTableCell(row, column);
  const square = { 
    id: `${row}${column}`,
    away_points: column, 
    home_points: row,
    player_id: playerId,
    game_id: gameId,
    week_id: weekId
  };
  
  // is cell already claimed?
  if (cell.innerHTML !== '') {
    // is cell claimed by current player?
    if (getCellPlayerId(cell) === getPlayerId()) {
      console.log(`Cell at row ${row}, column ${column} is already marked by current player. Unclaiming square.`)
      // unclaim square
      unclaimSquare(square);
    }

    return;
  }

  PLAYER_CLAIMED_SQUARES[gameId].push(square);

  // add a new li to the beginning of the #your-squares list
  let yourSquares = document.getElementById('your-squares');
  let newSquareLi = document.createElement('li');
  newSquareLi.textContent = square.id;
  yourSquares.insertBefore(newSquareLi, yourSquares.firstChild);

  let rect = cell.getBoundingClientRect();
  let xPosition = rect.left + window.scrollX;
  let yPosition = rect.top + window.scrollY;

  const elementPos = {
    clientX: xPosition + 25,
    clientY: yPosition + 25
  };

  explode(elementPos);

  let identicon = createIdenticon(getPlayerId(), 50);

  event.target.appendChild(identicon);
  // console.log(`GRADIENT_COLOR: ${GRADIENT_COLORS[CURRENT_COLOR_IDX]}`);
  event.target.style.backgroundColor = 'yellow';
  CURRENT_COLOR_IDX++;

  socket.emit('claim_square', square);
}

function unclaimSquare(square) {
  let cell = selectTableCell(square.home_points, square.away_points);
  let rect = cell.getBoundingClientRect();
  let xPosition = rect.left + window.scrollX;
  let yPosition = rect.top + window.scrollY;

  const event = {
    clientX: xPosition + 25,
    clientY: yPosition + 25
  };

  explode(event);

  cell.style.backgroundColor = 'white';
  cell.innerHTML = '';
  cell.addEventListener('click', claimSquare);

  // remove square from PLAYER_CLAIMED_SQUARES
  const index = PLAYER_CLAIMED_SQUARES[square.game_id].findIndex(s => s.id === square.id);
  // get the square from the array
  const liToRemove = PLAYER_CLAIMED_SQUARES[square.game_id][index];
  
  PLAYER_CLAIMED_SQUARES[square.game_id].splice(index, 1);

  // remove square from #your-squares list
  let yourSquaresList = document.getElementById('your-squares');
  let items = yourSquaresList.getElementsByTagName('li');
  for (li in items) {
    if (items[li].textContent === liToRemove.id) {
      items[li].remove();
    }
  }

  console.log(`Unclaiming square: ${JSON.stringify(square)}`);
  socket.emit('unclaim_square', square);
}

function handleWeb3Error(error, contractAddress) {
  let dappError = {}

  if (error.innerError) {
    dappError['error'] = error.innerError
  } else {
    dappError['error'] = error.error
  }

  if (dappError.error.code === 4001) {
    console.error(dappError.error.message);
    // emit an event to the server to let the other player know you rejected the transaction
    socket.emit('contract_rejected', {
      game_id: gameId,
      player_id: getPlayerId(),
      contract_address: contractAddress,
      error: error
    });

    payStakeStatusP.innerText = "You decided not to accept the contract. Your opponent has been notified. " +
      "Refresh to start a new game.";

    payStakeStatusP.classList.remove('flashing');
  }

  if (dappError.error.code === -32000) {
    console.error(dappError.error.message);

    socket.emit('insufficient_funds', {
      game_id: gameId,
      player_id: getPlayerId(),
      contract_address: contractAddress,
      error: error
    });

    payStakeStatusP.innerText = "Check your account balance. Your wallet may have insufficient funds for gas * price + value. This " +
      " is sometimes due to a sudden increase in gas prices on the network. We've notified your opponent. Try again " +
      "in a few minutes or refresh now to start a new game.";

    payStakeStatusP.style.color = 'red';
    payStakeStatusP.classList.remove('flashing');
  }

  if (dappError.error.code === -32603) {
    console.error(dappError.error.message);

    socket.emit('rpc_error', {
      game_id: gameId,
      player_id: getPlayerId(),
      contract_address: contractAddress,
      error: error
    });

    payStakeStatusP.innerText = "An Internal JSON-RPC error has occured. You may need to restart your MetaMask app. We've notified your opponent.";

    payStakeStatusP.style.color = 'red';
    payStakeStatusP.classList.remove('flashing');

    clearGUIDCookie();
  }
}

function claimSquares() {
  console.log(`Claiming squares: ${JSON.stringify(PLAYER_CLAIMED_SQUARES[GAME_ID])}`);
  (async () => {
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

    // Fetch the FootballSquare contract abi
    const contractABI = await loadContractABI();
    const contract = new web3.eth.Contract(contractABI.abi, web3.utils.toChecksumAddress(CONTRACT_ADDRESS));

    const nonce = await web3.eth.getTransactionCount(accounts[0]);
    console.log(`The nonce for your address is ${nonce}`);

    const totalCostUSD = PLAYER_CLAIMED_SQUARES[GAME_ID].length * USD_PER_SQUARE;
    let totalCostInEther = await dollarsToEthereum(totalCostUSD);
    console.log(`The total cost in Ether is ${totalCostInEther}`);
    const totalCostInWei = web3.utils.toWei(totalCostInEther.toString(), 'ether');
    console.log(`The total cost in Wei is ${totalCostInWei}`);

    const playerMove = {
      'player_address': accounts[0],
      'game_id': GAME_ID,
      'claimed_squares': PLAYER_CLAIMED_SQUARES[GAME_ID],
      'total_cost_in_usd': totalCostUSD,
    }
    const playerMoveString = JSON.stringify(playerMove);

    PLAYER_NONCE = web3.utils.randomHex(16);
    console.log(`The playerMove as a string is ${playerMoveString + PLAYER_NONCE}`);

    const playerMoveHash = web3.utils.sha3(web3.utils.toHex(playerMoveString + PLAYER_NONCE), {encoding:"hex"});
    console.log(`The playerMoveHash is ${playerMoveHash}`);

    const encodedData = contract.methods.claimSquares(GAME_ID, accounts[0], playerMoveHash).encodeABI();
    const transaction = {
      'from': web3.utils.toChecksumAddress(accounts[0]),
      'to': web3.utils.toChecksumAddress(CONTRACT_ADDRESS),
      'value': '0x' + web3.utils.toBigInt(totalCostInWei).toString(16),
      'nonce': nonce,
      'data': encodedData,
    };

    try {
      const gasEstimate = await web3.eth.estimateGas(transaction);
      transaction['gas'] = gasEstimate;
      console.log(`The gas estimate is ${gasEstimate}`);
    } catch (error) {
      console.error(`Error estimating gas: ${error}`);
      
      handleWeb3Error(error, contractAddress);

      return;
    }

    const gasOracle = await getGasOracle();

    // socket.emit('paying_stake', {
    //   game_id: gameId,
    //   player_id: playerId,
    // });

    const maxPriorityFeePerGas = parseInt(gasOracle.FastGasPrice) - parseInt(gasOracle.suggestBaseFee);
    console.log(`The maxFeePerGas is ${maxPriorityFeePerGas}`);
    
    transaction['maxFeePerGas'] = web3.utils.toWei(gasOracle.SafeGasPrice, 'gwei');
    transaction['maxPriorityFeePerGas'] = web3.utils.toWei(maxPriorityFeePerGas.toString(), 'gwei');
    const txHash = web3.eth.sendTransaction(transaction);

    txHash.catch((error) => {
      console.error(JSON.stringify(error));

      handleWeb3Error(error, contractAddress);
    });

    txHash.on('transactionHash', function (hash) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction hash received. Waiting for transaction to be mined...';
      transactionStatusP.classList.add('flashing');
      // Transaction hash received
      console.log(`The transaction hash is ${hash}`);
      // socket.emit('pay_stake_hash', {
      //   game_id: gameId,
      //   transaction_hash: hash,
      //   player_id: playerId,
      //   contract_address: contractAddress,
      // });
    });

    txHash.on('receipt', function (receipt) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction receipt received. Transaction mined, waiting for confirmation...';
      // Transaction receipt received
      // console.log(`The receipt is ${receipt}`);
      // socket.emit('pay_stake_receipt', {
      //   game_id: gameId,
      //   player_id: playerId,
      //   address: accounts[0],
      //   contract_address: contractAddress,
      // });
    });

    txHash.on('confirmation', function (confirmation, receipt) {
      let transactionStatusP = document.getElementById('transaction-status');
      transactionStatusP.innerText = 'Transaction confirmed.';
      transactionStatusP.classList.remove('flashing');
      // Transaction confirmed
      // console.log(`The confirmation number is ${confirmation}`);
      // socket.emit('pay_stake_confirmation', {
      //   game_id: gameId,
      //   player_id: playerId,
      //   contract_address: contractAddress,
      // });
    });

    txHash.on('error', function (error) {
      // Transaction error occurred
      console.error(`An error occurred: ${error}`);
    });
  })();
}

function selectTableCell(dataRow, dataColumn) {
  return document.querySelector(`td[data-row='${dataRow}'][data-col='${dataColumn}']`);
}

function generateColorGradient() {
  // Generate a random color
  const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

  // Convert the random color to RGB values
  const randomRed = parseInt(randomColor.slice(1, 3), 16);
  const randomGreen = parseInt(randomColor.slice(3, 5), 16);
  const randomBlue = parseInt(randomColor.slice(5, 7), 16);

  // Calculate the step size for each RGB value
  const stepRed = Math.floor(randomRed / 400);
  const stepGreen = Math.floor(randomGreen / 400);
  const stepBlue = Math.floor(randomBlue / 400);

  // Create an array to store the gradient colors
  const gradientColors = [];

  // Generate the gradient colors
  for (let i = 0; i < 50; i++) {
    const red = randomRed - (stepRed * i);
    const green = randomGreen - (stepGreen * i);
    const blue = randomBlue - (stepBlue * i);

    // Convert the RGB values back to hexadecimal
    const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;

    // Add the color to the gradientColors array
    gradientColors.push(hexColor);
  }

  return gradientColors;
}

function generateGamesList(games, ul) {
  console.log(`Generating games list: ${JSON.stringify(games)}`);
  ul.innerHTML = '';
  for (let i = 0; i < games.length; i++) {
    let a = document.createElement('a');
    a.setAttribute('href', `#/game/${games[i].game_id}?week_id=${games[i].week_id}`);
    a.textContent = games[i].name;

    let li = document.createElement('li');
    li.appendChild(a);

    ul.appendChild(li);
  }
}

function joinGame(game) {
  console.log("Joining game with id: " + game.id);
  socket.emit('join_game', { week_id:game.week_id, game_id: game.id, player_address: "", player_id: getPlayerId() });

  // create the squares grid
  var table = document.getElementById('squares-grid');

  // Outer loop to create rows
  for (var i = 0; i < 10; i++) {
    var row = document.createElement('tr');

    // Inner loop to create cells
    for (var j = 0; j < 10; j++) {
      var cell = document.createElement('td');

      // Set data attributes for row and column numbers
      cell.setAttribute('data-row', i);
      cell.setAttribute('data-col', j);
      cell.setAttribute('data-game-id', game.id);
      cell.setAttribute('data-week-id', game.week_id);

      cell.addEventListener('click', claimSquare);

      row.appendChild(cell);
    }

    // Add the row to the table
    table.appendChild(row);
  }
}

async function loadTemplate(name, element) {
  return fetch(`templates/${name}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(data => {
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

  socket.on('game_not_found', (data) => {
    console.log(`Game not found: ${JSON.stringify(data)}`);
    router.navigate('');
  });

  socket.on('connected', (player) => {
    console.log(`Player info: ${player.id}`);
    // console.log(`Games list: ${JSON.stringify(data.games_list)}`);

    // const currentLocation = router.getCurrentLocation();
    // console.log(`Current route location: ${JSON.stringify(currentLocation)}`);

    // if (currentLocation.route.name === '#' || currentLocation.route.name === '') {
    //   loadGameList();
    // }
  });

  socket.on('connect', () => {
    console.log('Connected to the server.');
    if (socket.recovered) {
      console.log('Connection recovered. Replay events from last offset')
    } else {
      // new or unrecoverable session
    }
    router.getLast///
    console.log(`Current router state: ${JSON.stringify(router)}`);
    console.log(`Router last resolved: ${JSON.stringify(router.lastResolved)}`);
    
    const currentLocation = router.getCurrentLocation();
    console.log(`Current route location: ${JSON.stringify(currentLocation)}`);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from the server:', reason);
    // Handle disconnection
    // The 'reason' argument provides why the client disconnected
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected to the server after', attemptNumber, 'attempts');
    // Handle successful reconnection
  });

  socket.on('game_joined', (game) => {
    console.log(`Game joined: ${JSON.stringify(game)}`);
    console.log(`Color gradient: ${JSON.stringify(GRADIENT_COLORS)}`)
    GAME_ID = game.id;

    let gameIdH2 = document.querySelector('#app h2 span');
    let gameNameH4 = document.querySelector('#app h4 span');

    gameIdH2.textContent = game.id;
    gameNameH4.textContent = game.name;

    let yourIdenticon = createIdenticon(getPlayerId(), 80);
    let yourIdenticonSpan = document.getElementById('your-identicon');
    yourIdenticonSpan.appendChild(yourIdenticon);

    // mark squares
    const claimedSquares = game.claimed_squares;
    PLAYER_CLAIMED_SQUARES[game.id] = [];
    for (const square in claimedSquares) {
      const claimedBy = claimedSquares[square].player_id;

      if(claimedBy === getPlayerId()) {
        PLAYER_CLAIMED_SQUARES[game.id].push(claimedSquares[square]);
      }

      let [row, column] = claimedSquares[square].id.split('');
      const cell = selectTableCell(row, column);
      let identicon = createIdenticon(claimedBy, 50);
      cell.appendChild(identicon);
      cell.style.backgroundColor = 'yellow';
    }

    console.log(`Player claimed squares: ${JSON.stringify(PLAYER_CLAIMED_SQUARES)}`);

    // display claimed squares as list items in the #your-squares list
    let yourSquares = document.getElementById('your-squares');
    yourSquares.innerHTML = '';
    for(square in PLAYER_CLAIMED_SQUARES[game.id]) {
      let newSquareLi = document.createElement('li');
      newSquareLi.textContent = PLAYER_CLAIMED_SQUARES[game.id][square].id;
      yourSquares.appendChild(newSquareLi);
    }

    let claimSquaresButton = document.createElement('button');
    claimSquaresButton.textContent = 'Claim Squares';
    claimSquaresButton.addEventListener('click', claimSquares);

    let claimButtonLi = document.createElement('li');
    claimButtonLi.appendChild(claimSquaresButton);
    yourSquares.appendChild(claimButtonLi);

    // display players
    const players = game.players;
    let playerList = document.getElementById('player-list');
    playerList.innerHTML = '';

    for (const id in players) {
      if (players[id] !== getPlayerId()) {
        let newPlayerLi = document.createElement('li');

        let identicon = createIdenticon(players[id], 50);
        newPlayerLi.appendChild(identicon);

        playerList.appendChild(newPlayerLi);
      }
    }
  });

  socket.on('square_marked', (square) => {
    if(square.game_id === GAME_ID) {
      console.log(`Square marked: ${JSON.stringify(square)}`);
      // get digits from square.id
      let [row, column] = square.id.split('');
      const cell = selectTableCell(row, column);

      let rect = cell.getBoundingClientRect();
      let xPosition = rect.left + window.scrollX;
      let yPosition = rect.top + window.scrollY;

      const event = {
        clientX: xPosition + 25,
        clientY: yPosition + 25
      };

      explode(event);

      let identicon = createIdenticon(square.player_id, 50);
      cell.appendChild(identicon);
      cell.removeEventListener('click', claimSquare);
      cell.style.backgroundColor = 'yellow';
    }
  });

  socket.on('square_unmarked', (square) => {
    if(square.game_id === GAME_ID) {
      console.log(`Square unmarked: ${JSON.stringify(square)}`);
      unclaimSquare(square);
    }    
  });

  socket.on('new_player_joined', (data) => {
    if(data.game_id === GAME_ID) {
      console.log(`New player joined: ${JSON.stringify(data)}`);

      let playerList = document.getElementById('player-list');
      let newPlayerLi = document.createElement('li');
      newPlayerLi.classList.add('fade-in');

      let identicon = createIdenticon(data.player_id, 50);

      newPlayerLi.appendChild(identicon);
      playerList.appendChild(newPlayerLi);
    }
  });

  socket.on('player_left_game', (data) => {
    if (data.game_id === GAME_ID) {
      console.log(`Player left game: ${JSON.stringify(data.player_id)}`);

      const squaresToUnmark = data.squares_marked_by_leaving_player;

      let i = 1;
      for (let square in squaresToUnmark) {
        setTimeout(() => {
          unclaimSquare(squaresToUnmark[square]);
        }, i * 150);
        i++;
      }

      let playerList = document.getElementById('player-list');
      let players = playerList.getElementsByTagName('li');

      for (let i = 0; i < players.length; i++) {
        if (players[i].firstChild.getAttribute('data-jdenticon-value') === data.player_id) {
          setTimeout(() => {
            let rect = players[i].getBoundingClientRect();
            let xPosition = rect.left + window.scrollX;
            let yPosition = rect.top + window.scrollY;

            const event = {
              clientX: xPosition + 25,
              clientY: yPosition + 25
            };

            players[i].remove();
            explode(event);
          }, 1500);
        }
      }
    }
  });

  socket.on('square_match', (data, ack) => {
    if(GAME_ID === data.square.game_id) {
      // console.log(`Square match: ${JSON.stringify(data)}`);
      console.log(`Event num: ${data.event_num}`);

      // let rect = document.getElementById('app').getBoundingClientRect();
      // let xPosition = rect.left + window.scrollX;
      // let yPosition = rect.top + window.scrollY;
  
      // const event = {
      //   clientX: xPosition + 25,
      //   clientY: yPosition + 25
      // };
  
      // explode(event);
  
      let square = data.square;
      let cell = selectTableCell(square.home_points, square.away_points);
      cell.style.backgroundColor = 'green';
      cell.removeEventListener('click', claimSquare);

      ack_data = {
        // 'square': square,
        'player_id': getPlayerId(),
        'event_num': data.event_num,
        'event_name': 'mark_claimed_square_match'
      }
      // console.log(`Sending ack_data: ${JSON.stringify(ack_data)}`);
      ack(ack_data);
    }
  });

  socket.on('mark_claimed_square_match', (data) => {
    if(GAME_ID === data.square.game_id) {
      console.log(`Mark claimed square match: ${JSON.stringify(data)}`);

      // let rect = document.getElementById('app').getBoundingClientRect();
      // let xPosition = rect.left + window.scrollX;
      // let yPosition = rect.top + window.scrollY;
  
      // const event = {
      //   clientX: xPosition + 25,
      //   clientY: yPosition + 25
      // };
  
      // explode(event);
  
      let square = data.square;
      let cell = selectTableCell(square.home_points, square.away_points);
      cell.style.backgroundColor = 'red';
      cell.removeEventListener('click', claimSquare);

      ack_data = {
        'square': square,
        'player_id': getPlayerId(),
        'event_num': data.event_num,
        'event_name': 'mark_claimed_square_match'
      }
      console.log(`Sending ack_data: ${JSON.stringify(ack_data)}`);
      // callback(ack_data);
    }
  });

  socket.on('mark_unclaimed_square_match', (data, ack) => {
    if(GAME_ID === data.game_id) {
      // console.log(`Mark unclaimed square match: ${JSON.stringify(data)}`);
      console.log(`Event num: ${data.event_num}`);

      // let rect = document.getElementById('app').getBoundingClientRect();
      // let xPosition = rect.left + window.scrollX;
      // let yPosition = rect.top + window.scrollY;
  
      // const event = {
      //   clientX: xPosition + 25,
      //   clientY: yPosition + 25
      // };
  
      // explode(event);
  
      let square = data.square;
      let cell = selectTableCell(square.home_points, square.away_points);
      cell.style.backgroundColor = 'red';
      cell.removeEventListener('click', claimSquare);
      socket.auth.serverOffset = data.scoring_play.offset;
      socket.auth.game_id = data.square.game_id;
      socket.auth.week_id = data.square.week_id;

      ack_data = {
        // 'square': square,
        'player_id': getPlayerId(),
        'event_num': data.event_num,
        'event_name': 'mark_unclaimed_square_match'
      }
      // console.log(`Sending ack_data: ${JSON.stringify(ack_data)}`);
      ack(ack_data);
    }
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
  return fetch(`${domain}/ethereum-price?game_id=${GAME_ID}`)
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
  return fetch(`${domain}/gas-oracle?game_id=${GAME_ID}`)
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
      console.log(`The FootballSquares ABI is ${data.abi}`)
      return data;
    })
    .catch(error => {
      // Handle any potential errors
      console.error(`Error: ${error}`);
    });
}

async function loadGameList() {
  return fetch(`${domain}/games`)
    .then(response => response.json())
    .then(games => {
      generateGamesList(games, document.getElementById('games-list'));
    })
    .catch(error => {
      // Handle any potential errors
      console.error(`Error: ${error}`);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  socket = io(domain,
    {
      auth: {
        serverOffset: 0
      },
      transports: ['websocket'],
      query: {
        player_id: getPlayerId(),
      }
    });

  registerSocketIOEventListeners();

  router
    .on("/", (match) => {
      console.log(`Match value on home route: ${JSON.stringify(match)}`);
    }, {
      before(done) {
        (async () => {
          await loadTemplate("home-9be2cf88fade78a0626c8f0f1babebc4.html", document.getElementById('app'));
          await loadGameList();
          done();
        })();
      }
    })
    .on("/game/:gameId", (match) => {
      console.log(`Match value on game route: ${JSON.stringify(match)}`);

      const game = {
        id: match.data.gameId,
        week_id: match.params.week_id
      };

      joinGame(game);
    }, {
      before(done, match) {
        (async () => {
          await loadTemplate("game-66bc4833b7700cbde4525f72d3a10ca8.html", document.getElementById('app'));

          let a = document.createElement('a');
          a.setAttribute('href', `#/leave/${match.data.gameId}?week_id=${match.params.week_id}`);
          a.setAttribute('data-navigo', '')
          a.textContent = 'Leave Game';

          let nav = document.querySelector('#game-info .home');
          nav.appendChild(a);

          done();
        })();
      }
    })
    .on("/leave/:gameId", (match) => {
      console.log(`Match value on leave route: ${JSON.stringify(match)}`);

      router.navigate('');
    }, {
      before(done, match) {
        socket.emit('leave_game', { 
          game_id: match.data.gameId, 
          player_id: getPlayerId(), 
          week_id: match.params.week_id,
          player_address: ""
        });
        GAME_ID = null;
        done();
      }
    })
    .resolve();
});
